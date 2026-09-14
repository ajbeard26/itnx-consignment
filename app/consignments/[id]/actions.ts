"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { text, removeLocalPhoto } from "@/lib/uploads";
import { auctionFeeCents, consignorBps, tierForSale } from "@/lib/commission";
import { parseMethod, parseStatus, statusWrite } from "@/lib/deals";
import { signUrl } from "@/lib/customer";
import { fillTemplate, smsTemplates } from "@/lib/sms";
import { sendSms } from "@/lib/telnyx";
import { emailTemplates, renderEmail, sendEmail } from "@/lib/email";
import { safeHttpUrl, safeListingUrl } from "@/lib/safe";
import { calc } from "@/lib/commission";
import { money } from "@/lib/money";
import { logDealEvent } from "@/lib/events";
import { parseDay } from "@/lib/dates";
import { requireStaff } from "@/lib/staff";

async function touchDeal(id: string) {
  const x = await db.consignment.findUnique({ where: { id }, select: { id: true, customerId: true } });
  if (!x) return;
  revalidatePath(`/consignments/${id}`);
  revalidatePath("/consignments");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${x.customerId}`);
}

export async function paid(id: string, fd: FormData) {
  await requireStaff();
  await db.consignment.update({
    where: { id },
    data: {
      paid: true,
      status: "COMPLETED",
      completedAt: new Date(),
      payoutReference: String(fd.get("ref") || "") || null,
    },
  });
  await touchDeal(id);
}

export async function updateStatus(id: string, fd: FormData) {
  await requireStaff();
  const current = await db.consignment.findUnique({ where: { id } });
  if (!current) return;
  const status = parseStatus(fd.get("status"), current.status);
  await db.consignment.update({
    where: { id },
    data: statusWrite(status, current.completedAt),
  });
  await touchDeal(id);
}

export async function updateItem(id: string, fd: FormData) {
  await requireStaff();
  const current = await db.consignment.findUnique({ where: { id } });
  if (!current) return;
  await db.consignment.update({
    where: { id },
    data: {
      title: String(fd.get("title") || current.title).trim() || current.title,
      category: text(fd.get("category")),
      condition: text(fd.get("condition")),
      serialNumber: text(fd.get("serial")),
      location: text(fd.get("location")),
      notes: text(fd.get("notes")),
      listingUrl: safeListingUrl(fd.get("listingUrl")),
      listedAt: parseDay(fd.get("listedAt")),
      description: text(fd.get("description")),
    },
  });
  await touchDeal(id);
}

export async function updatePayout(id: string, fd: FormData) {
  await requireStaff();
  const current = await db.consignment.findUnique({ where: { id } });
  if (!current) return;
  const status = parseStatus(fd.get("status"), current.status);
  const method = parseMethod(fd.get("method"), current.method);
  const salePriceCents = Math.round(Number(fd.get("sale") || 0) * 100);
  const askingPriceCents = Math.round(Number(fd.get("asking") || 0) * 100);
  const moneyChanged = salePriceCents !== current.salePriceCents;
  const tier = tierForSale(salePriceCents || askingPriceCents);
  await db.consignment.update({
    where: { id },
    data: {
      ...statusWrite(status, parseDay(fd.get("completedAt")) ?? current.completedAt),
      method,
      platform: text(fd.get("platform")),
      salePriceCents,
      askingPriceCents,
      ...(moneyChanged
        ? {
            customerPercentBps: consignorBps(tier.consignorPercent),
            feeCents: auctionFeeCents(salePriceCents || askingPriceCents),
          }
        : {}),
    },
  });
  await touchDeal(id);
}

export async function deletePhoto(consignmentId: string, imageId: string) {
  await requireStaff();
  const img = await db.consignmentImage.findFirst({
    where: { id: imageId, consignmentId },
  });
  if (!img) return;
  await db.consignmentImage.delete({ where: { id: imageId } });
  await removeLocalPhoto(img.path);
  await touchDeal(consignmentId);
}

export async function deleteConsignment(id: string) {
  await requireStaff();
  const current = await db.consignment.findUnique({ where: { id }, select: { customerId: true } });
  if (!current) redirect("/consignments");
  await db.consignment.delete({ where: { id } });
  revalidatePath("/consignments");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${current.customerId}`);
  redirect("/consignments");
}

export async function sendDealInvite(id: string, channel: "email" | "sms") {
  await requireStaff();
  const x = await db.consignment.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!x) return { error: "Deal not found." };
  const link = signUrl(x.acceptanceToken);
  const abs = link ? safeHttpUrl(link) : "";
  if (!abs || !abs.startsWith("https://")) {
    return { error: "Customer links must go to the consignment portal. Check Settings → Company." };
  }
  const split = calc(x.salePriceCents, x.customerPercentBps, x.feeCents);
  const name = x.customer.name;

  try {
    if (channel === "email") {
      const to = x.customer.email || x.customer.payoutEmail;
      if (!to) return { error: "Add an email on the customer profile first." };
      const templates = await emailTemplates();
      const rendered = renderEmail("accept", templates, {
        brand: templates.brand,
        legal: templates.legal,
        name,
        link: abs,
        email: to,
        item: `Item: ${x.title}`,
        amount: x.salePriceCents ? `Your payout: ${money(split.customer)}` : "",
        subjectAmount: x.salePriceCents ? ` — ${money(split.customer)}` : "",
        subject: "",
        message: "",
        buttonLabel: "Review and sign",
      });
      await sendEmail({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        customerId: x.customerId,
        kind: "accept",
      });
      await logDealEvent({
        consignmentId: x.id,
        kind: "email",
        summary: `Payout page emailed to ${to}`,
      });
      await touchDeal(x.id);
      return { ok: `Emailed ${to}.` };
    }

    const to = x.customer.phoneE164 || x.customer.phone || x.customer.payoutPhone;
    if (!to) return { error: "Add a phone number on the customer profile first." };
    const templates = await smsTemplates();
    await sendSms({
      to,
      text: fillTemplate(templates.accept, templates.defaults.accept, {
        brand: templates.brand,
        name,
        link: abs,
      }),
      customerId: x.customerId,
      requireConsent: true,
    });
    await logDealEvent({
      consignmentId: x.id,
      kind: "sms",
      summary: "Payout page texted",
    });
    await touchDeal(x.id);
    return { ok: "Text sent." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send." };
  }
}
