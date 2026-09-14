"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { text } from "@/lib/uploads";
import { verifyAddress, formatAddress } from "@/lib/address";
import { toE164 } from "@/lib/phone";
import { fillTemplate, smsTemplates } from "@/lib/sms";
import { sendSms } from "@/lib/telnyx";
import { ensureInfoToken, infoUrl, signUrl } from "@/lib/customer";
import { emailTemplates, renderEmail, sendEmail } from "@/lib/email";
import { safeHttpUrl } from "@/lib/safe";
import { calc } from "@/lib/commission";
import { money } from "@/lib/money";
import { requireStaff } from "@/lib/staff";

async function verifiedFromForm(fd: FormData, prefix: "contact" | "payout") {
  const street = prefix === "contact" ? String(fd.get("street") || "") : String(fd.get("payoutAddress") || "");
  const city = prefix === "contact" ? String(fd.get("city") || "") : String(fd.get("payoutCity") || "");
  const state = prefix === "contact" ? String(fd.get("state") || "") : String(fd.get("payoutState") || "");
  const zip = prefix === "contact" ? String(fd.get("zip") || "") : String(fd.get("payoutZip") || "");
  if (!street.trim()) {
    return { street: "", city: "", state: "", zip: "", formatted: null as string | null, verified: false, source: null };
  }
  const result = await verifyAddress({ street, city, state, zip });
  return {
    street: result.street || street,
    city: result.city || city,
    state: result.state || state,
    zip: result.zip || zip,
    formatted: formatAddress(result),
    verified: result.ok,
    source: result.ok ? result.source : null,
  };
}

export async function createCustomer(fd: FormData) {
  await requireStaff();
  const name = String(fd.get("name") || "").trim();
  if (!name) throw new Error("Name is required");
  const phone = text(fd.get("phone"));
  const addr = await verifiedFromForm(fd, "contact");
  const customer = await db.customer.create({
    data: {
      name,
      email: text(fd.get("email")),
      phone,
      phoneE164: toE164(phone || ""),
      company: text(fd.get("company")),
      street: addr.street || null,
      city: addr.city || null,
      state: addr.state || null,
      zip: addr.zip || null,
      address: addr.formatted,
      addressVerified: addr.verified,
      addressVerifiedAt: addr.verified ? new Date() : null,
      addressVerifiedSource: addr.source,
      infoToken: randomBytes(24).toString("hex"),
    },
  });
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(id: string, fd: FormData) {
  await requireStaff();
  const phone = text(fd.get("phone"));
  const addr = await verifiedFromForm(fd, "contact");
  await db.customer.update({
    where: { id },
    data: {
      name: String(fd.get("name") || "").trim(),
      email: text(fd.get("email")),
      phone,
      phoneE164: toE164(phone || "") || undefined,
      company: text(fd.get("company")),
      street: addr.street || null,
      city: addr.city || null,
      state: addr.state || null,
      zip: addr.zip || null,
      address: addr.formatted,
      addressVerified: addr.verified,
      addressVerifiedAt: addr.verified ? new Date() : null,
      addressVerifiedSource: addr.source,
    },
  });
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
}

export async function deleteCustomer(id: string) {
  await requireStaff();
  const customer = await db.customer.findUnique({
    where: { id },
    include: { _count: { select: { consignments: true } } },
  });
  if (!customer) redirect("/customers");
  await db.consignment.deleteMany({ where: { customerId: id } });
  await db.customer.delete({ where: { id } });
  revalidatePath("/customers");
  revalidatePath("/consignments");
  revalidatePath("/dashboard");
  redirect("/customers");
}

export async function sendCustomerSms(customerId: string, kind: "consent" | "payout" | "accept") {
  await requireStaff();
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: { consignments: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  if (!customer) return { error: "Customer not found." };
  const to = customer.phoneE164 || customer.phone || customer.payoutPhone;
  if (!to) return { error: "Add a phone number first." };

  const templates = await smsTemplates();
  const token = await ensureInfoToken(customer.id);
  const payout = infoUrl(token);
  const unsigned = customer.consignments.find((x) => x.acceptanceToken && !x.acceptedAt) || customer.consignments[0];
  const accept = signUrl(unsigned?.acceptanceToken);

  const vars = { brand: templates.brand, name: customer.name, link: kind === "accept" ? accept : payout };

  try {
    if (kind === "consent") {
      await sendSms({
        to,
        text: fillTemplate(templates.consent, templates.defaults.consent, vars),
        customerId: customer.id,
        requireConsent: false,
      });
      revalidatePath(`/customers/${customer.id}`);
      return { ok: "Consent text sent. They can reply YES." };
    }
    if (kind === "payout") {
      if (!payout) return { error: "Could not create a payout link. Try again." };
      await sendSms({
        to,
        text: fillTemplate(templates.payout, templates.defaults.payout, { ...vars, link: payout }),
        customerId: customer.id,
        requireConsent: false,
      });
      revalidatePath(`/customers/${customer.id}`);
      return { ok: "Payout link sent." };
    }
    if (!accept) return { error: "This customer does not have a consignment to sign yet." };
    await sendSms({
      to,
      text: fillTemplate(templates.accept, templates.defaults.accept, { ...vars, link: accept }),
      customerId: customer.id,
      requireConsent: true,
    });
    revalidatePath(`/customers/${customer.id}`);
    return { ok: "Signature link sent." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send that text." };
  }
}

export async function sendCustomerEmail(
  customerId: string,
  kind: "payout" | "accept" | "custom",
  extra?: { subject?: string; message?: string; include?: "none" | "payout" | "sign" }
) {
  await requireStaff();
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: { consignments: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  if (!customer) return { error: "Customer not found." };
  const to = customer.email || customer.payoutEmail;
  if (!to) return { error: "Add an email address first." };

  const templates = await emailTemplates();
  const token = await ensureInfoToken(customer.id);
  const payout = infoUrl(token);
  const unsigned = customer.consignments.find((x) => x.acceptanceToken && !x.acceptedAt) || customer.consignments[0];
  const accept = signUrl(unsigned?.acceptanceToken);
  const split = unsigned ? calc(unsigned.salePriceCents, unsigned.customerPercentBps, unsigned.feeCents) : null;
  const item = unsigned?.title ? `Item: ${unsigned.title}` : "";
  const amount = unsigned?.salePriceCents && split ? `Your payout: ${money(split.customer)}` : "";
  const subjectAmount = unsigned?.salePriceCents && split ? ` — ${money(split.customer)}` : "";

  let link = "";
  let buttonLabel = "Open link";
  if (kind === "payout") {
    link = payout;
    buttonLabel = "Add mailing address";
    if (!link) return { error: "Could not create a mailing link. Try again." };
  } else if (kind === "accept") {
    link = accept;
    buttonLabel = "Review and sign";
    if (!link) return { error: "This customer does not have a consignment to sign yet." };
  } else {
    const include = extra?.include || "none";
    if (!String(extra?.message || "").trim()) return { error: "Write a message before sending a custom email." };
    if (include === "sign") {
      link = accept;
      buttonLabel = "Review and sign";
      if (!link) return { error: "This customer does not have a consignment to sign yet." };
    } else if (include === "payout") {
      link = payout;
      buttonLabel = "Add mailing address";
      if (!link) return { error: "Could not create a mailing link. Try again." };
    }
  }

  const abs = link ? safeHttpUrl(link) : "";
  if (link && (!abs || !abs.startsWith("https://"))) {
    return { error: "Customer links must go to the consignment portal. Check Settings → Company." };
  }

  try {
    const rendered = renderEmail(kind, templates, {
      brand: templates.brand,
      legal: templates.legal,
      name: customer.name,
      link: abs,
      email: to,
      item,
      amount,
      subjectAmount,
      subject: extra?.subject || "",
      message: extra?.message || "",
      buttonLabel,
    });
    await sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      customerId: customer.id,
      kind,
    });
    revalidatePath(`/customers/${customer.id}`);
    return {
      ok: kind === "payout" ? "Mailing-info email sent." : kind === "accept" ? "Sign-link email sent." : "Custom email sent.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send that email." };
  }
}