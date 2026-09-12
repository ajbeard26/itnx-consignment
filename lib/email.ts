import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { stripHtml } from "@/lib/html";
import { EMAIL_DEFAULTS, renderEmailHtml, type EmailKind } from "@/lib/email-html";

export { EMAIL_PLACEHOLDERS, fillPlaceholders, wrapEmailHtml, renderEmailHtml, type EmailKind } from "@/lib/email-html";

export function emailConfigured(s: { smtpHost?: string | null; smtpFromEmail?: string | null } | null | undefined) {
  return Boolean(s?.smtpHost && s.smtpFromEmail);
}

export async function emailTemplates() {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  return {
    brand: s?.brandName || "ITNX Consignment",
    legal: s?.legalName || "NXRENT LLC",
    website: s?.website || "https://itnx.tech",
    payoutSubject: s?.emailPayoutSubject || EMAIL_DEFAULTS.payoutSubject,
    payoutHtml: s?.emailPayoutHtml || EMAIL_DEFAULTS.payoutHtml,
    acceptSubject: s?.emailAcceptSubject || EMAIL_DEFAULTS.acceptSubject,
    acceptHtml: s?.emailAcceptHtml || EMAIL_DEFAULTS.acceptHtml,
    customSubject: s?.emailCustomSubject || EMAIL_DEFAULTS.customSubject,
    customHtml: s?.emailCustomHtml || EMAIL_DEFAULTS.customHtml,
    defaults: EMAIL_DEFAULTS,
  };
}

export function renderEmail(
  kind: EmailKind,
  templates: Awaited<ReturnType<typeof emailTemplates>>,
  vars: Record<string, string>
) {
  return renderEmailHtml(kind, templates, vars);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  customerId?: string | null;
  kind?: EmailKind | null;
}) {
  const s = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  if (!s.smtpHost || !s.smtpFromEmail) {
    throw new Error("Add SMTP host and from-email in Settings → Email.");
  }
  const to = opts.to.trim();
  if (!to || !to.includes("@")) throw new Error("Enter a valid email address.");

  const fromName = s.smtpFromName || s.brandName || "ITNX Consignment";
  const transporter = nodemailer.createTransport({
    host: s.smtpHost,
    port: s.smtpPort || 587,
    secure: Boolean(s.smtpSecure) || s.smtpPort === 465,
    auth: s.smtpUser && s.smtpPass ? { user: s.smtpUser, pass: s.smtpPass } : undefined,
  });

  try {
    const info = await transporter.sendMail({
      from: `"${fromName.replace(/"/g, "")}" <${s.smtpFromEmail}>`,
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || stripHtml(opts.html),
    });
    await db.emailMessage.create({
      data: {
        customerId: opts.customerId || null,
        to,
        subject: opts.subject,
        body: opts.text || stripHtml(opts.html),
        kind: opts.kind || null,
        status: info.accepted?.length ? "sent" : "queued",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send email.";
    await db.emailMessage.create({
      data: {
        customerId: opts.customerId || null,
        to,
        subject: opts.subject,
        body: opts.text || stripHtml(opts.html),
        kind: opts.kind || null,
        status: "failed",
        error: message.slice(0, 500),
      },
    });
    throw new Error(message);
  }
}
