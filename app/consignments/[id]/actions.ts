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
import { emailConfigured, emailTemplates, renderEmail, sendEmail } from "@/lib/email";
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
  const payoutReference = String(fd.get("ref") || "").trim() || null;
  const x = await db.consignment.update({
    where: { id },
    data: {
      paid: true,
      status: "COMPLETED",
      completedAt: new Date(),
      payoutReference,
    },
    include: { customer: true },
  });
  await notifyPayoutSent(x);
  await touchDeal(id);
}

async function notifyPayoutSent(x: {
  id: string;
  title: string;
  method: "CHECK" | "ACH" | "CASH";
  payoutReference: string | null;
  salePriceCents: number;
  customerPercentBps: number;
  feeCents: number;
  acceptanceToken: string | null;
  customerId: string;
  customer: { name: string; email: string | null; payoutEmail: string | null };
}) {
  const how = x.method === "ACH" || x.method === "CASH" ? x.method : "CHECK";
  const to = x.customer.email || x.customer.payoutEmail;
  if (how === "CASH") return;
  if (!to) {
    await logDealEvent({
      consignmentId: x.id,
      kind: "email",
      summary: "Marked sent — no email on file",
    });
    return;
  }
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!emailConfigured(settings)) {
    await logDealEvent({
      consignmentId: x.id,
      kind: "email",
      summary: "Marked sent — SMTP is not configured",
    });
    return;
  }
  const link = signUrl(x.acceptanceToken);
  const abs = link ? safeHttpUrl(link) : "";
  if (!abs || !abs.startsWith("https://")) {
    await logDealEvent({
      consignmentId: x.id,
      kind: "email",
      summary: "Marked sent — payout link is not ready",
    });
    return;
  }
  const split = calc(x.salePriceCents, x.customerPercentBps, x.feeCents);
  const check = x.payoutReference || "";
  const sentHeadline = how === "ACH" ? "your transfer is on the way" : "your check is on the way";
  const sentLead =
    how === "ACH"
      ? "The bank transfer for this payout has been sent."
      : check
        ? `Check ${check} has been issued and is in the mail.`
        : "Your check has been issued and is in the mail.";
  try {
    const templates = await emailTemplates();
    const rendered = renderEmail("sent", templates, {
      brand: templates.brand,
      legal: templates.legal,
      name: x.customer.name,
      link: abs,
      email: to,
      item: `Item: ${x.title}`,
      amount: x.salePriceCents ? `Your payout: ${money(split.customer)}` : "",
      subjectAmount: x.salePriceCents ? ` — ${money(split.customer)}` : "",
      sentHeadline,
      sentLead,
      checkLine: how === "CHECK" && check ? `Check number: ${check}` : "",
      buttonLabel: "View payout",
      subject: "",
      message: "",
    });
    await sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      customerId: x.customerId,
      kind: "sent",
    });
    await logDealEvent({
      consignmentId: x.id,
      kind: "email",
      summary: how === "ACH" ? `Transfer-sent email to ${to}` : `Check-sent email to ${to}`,
    });
  } catch (error) {
    await logDealEvent({
      consignmentId: x.id,
      kind: "email",
      summary: `Marked sent — email failed${error instanceof Error ? `: ${error.message}` : ""}`.slice(0, 240),
    });
  }
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
