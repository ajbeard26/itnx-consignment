"use server";

import { Method } from "@prisma/client";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { text } from "@/lib/uploads";
import { sendSms, syncMessagingWebhook } from "@/lib/telnyx";
import { emailTemplates, renderEmail, sendEmail } from "@/lib/email";
import { portalHref } from "@/lib/urls";
import { limitText, publicError, validEmailAddress, validSmtpHost, validSmtpPort } from "@/lib/safe";

function method(value: FormDataEntryValue | null): Method {
  const v = String(value || "CHECK");
  if (v === Method.CASH || v === Method.ACH || v === Method.CHECK) return v;
  return Method.CHECK;
}

async function row() {
  return db.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

function keepSecret(incoming: FormDataEntryValue | null, existing: string | null) {
  const v = String(incoming || "").trim();
  if (!v || v === "••••••••") return existing;
  return v;
}

function settingsUrl(tab: string, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({ tab, ...extra });
  return `/settings?${q.toString()}`;
}

export async function saveCompany(fd: FormData) {
  await row();
  await db.settings.update({
    where: { id: 1 },
    data: {
      brandName: String(fd.get("brandName") || "ITNX Consignment").trim() || "ITNX Consignment",
      legalName: String(fd.get("legalName") || "NXRENT LLC").trim() || "NXRENT LLC",
      contactEmail: text(fd.get("contactEmail")),
      contactPhone: text(fd.get("contactPhone")),
      website: text(fd.get("website")),
      address: text(fd.get("address")),
    },
  });
  revalidatePath("/settings");
}

export async function saveDeals(fd: FormData) {
  try {
    await row();
    await db.settings.update({
      where: { id: 1 },
      data: {
        defaultCustomerPercentBps: 5000,
        defaultPlatform: text(fd.get("defaultPlatform")),
        defaultMethod: method(fd.get("defaultMethod")),
        payoutNotes: text(fd.get("payoutNotes")),
      },
    });
  } catch (error) {
    redirect(settingsUrl("deals", { saved: publicError(error, "Could not save deal defaults.") }));
  }
  revalidatePath("/consignments/new");
  redirect(settingsUrl("deals", { saved: "1" }));
}

export async function saveMessaging(fd: FormData) {
  const current = await row();
  await db.settings.update({
    where: { id: 1 },
    data: {
      telnyxApiKey: keepSecret(fd.get("telnyxApiKey"), current.telnyxApiKey),
      telnyxFromNumber: text(fd.get("telnyxFromNumber")),
      telnyxMessagingProfileId: text(fd.get("telnyxMessagingProfileId")),
      telnyxPublicKey: keepSecret(fd.get("telnyxPublicKey"), current.telnyxPublicKey),
      smsConsentTemplate: text(fd.get("smsConsentTemplate")),
      smsPayoutTemplate: text(fd.get("smsPayoutTemplate")),
      smsAcceptTemplate: text(fd.get("smsAcceptTemplate")),
    },
  });
  await syncMessagingWebhook();
  revalidatePath("/settings");
}

export async function saveEmail(fd: FormData) {
  const current = await row();
  const host = validSmtpHost(String(fd.get("smtpHost") || ""));
  const fromEmail = validEmailAddress(String(fd.get("smtpFromEmail") || current.contactEmail || ""));
  if (String(fd.get("smtpHost") || "").trim() && !host) {
    redirect(settingsUrl("email", { mail: "Enter a valid SMTP host like smtp.gmail.com." }));
  }
  if (String(fd.get("smtpFromEmail") || "").trim() && !fromEmail) {
    redirect(settingsUrl("email", { mail: "Enter a valid from-email address." }));
  }
  await db.settings.update({
    where: { id: 1 },
    data: {
      smtpHost: host || null,
      smtpPort: validSmtpPort(fd.get("smtpPort")),
      smtpSecure: String(fd.get("smtpSecure") || "") === "on",
      smtpUser: text(fd.get("smtpUser")),
      smtpPass: keepSecret(fd.get("smtpPass"), current.smtpPass),
      smtpFromName: text(fd.get("smtpFromName")) || current.brandName,
      smtpFromEmail: fromEmail || null,
    },
  });
  revalidatePath("/settings");
}

export async function saveEmailTemplates(fd: FormData) {
  await row();
  await db.settings.update({
    where: { id: 1 },
    data: {
      emailPayoutSubject: text(fd.get("emailPayoutSubject")),
      emailPayoutHtml: limitText(String(fd.get("emailPayoutHtml") || "").trim()) || null,
      emailAcceptSubject: text(fd.get("emailAcceptSubject")),
      emailAcceptHtml: limitText(String(fd.get("emailAcceptHtml") || "").trim()) || null,
      emailCustomSubject: text(fd.get("emailCustomSubject")),
      emailCustomHtml: limitText(String(fd.get("emailCustomHtml") || "").trim()) || null,
    },
  });
  revalidatePath("/settings");
}

export async function sendTestSms(fd: FormData) {
  try {
    const to = String(fd.get("testPhone") || "").trim();
    await sendSms({
      to,
      text: "ITNX test: your Telnyx SMS is connected. Reply STOP to opt out.",
      requireConsent: false,
    });
  } catch (error) {
    redirect(settingsUrl("sms", { sms: publicError(error, "Could not send test text.") }));
  }
  redirect(settingsUrl("sms", { sms: "sent" }));
}

export async function sendTestEmail(fd: FormData) {
  const to = validEmailAddress(String(fd.get("testEmail") || ""));
  if (!to) redirect(settingsUrl("email", { mail: "Enter a valid email address." }));
  const kindRaw = String(fd.get("kind") || "custom");
  const kind = kindRaw === "payout" || kindRaw === "accept" || kindRaw === "custom" ? kindRaw : "custom";
  try {
    const templates = await emailTemplates();
    const rendered = renderEmail(kind, templates, {
      brand: templates.brand,
      legal: templates.legal,
      name: "Test recipient",
      link: kind === "accept" ? portalHref("/sign/example") : portalHref("/info/example"),
      email: to,
      item: "Item: 2020 Kubota tractor",
      amount: "Your payout: $1,400.00",
      subjectAmount: " — $1,400.00",
      message: "This is a test of the custom note. Mailing and sign emails use different links.",
      subject: kind === "custom" ? "Test note from ITNX Consignment" : "",
      buttonLabel: kind === "accept" ? "Review and sign" : "Add mailing address",
    });
    await sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      kind,
    });
  } catch (error) {
    redirect(settingsUrl("email", { mail: publicError(error, "Could not send test email.") }));
  }
  redirect(settingsUrl("email", { mail: "sent" }));
}
