import { stripHtml } from "@/lib/html";
import { safeHttpUrl } from "@/lib/safe";
import { appUrl } from "@/lib/urls";

export type EmailKind = "payout" | "accept" | "custom" | "sent";

export const EMAIL_PLACEHOLDERS = ["{brand}", "{legal}", "{name}", "{link}", "{email}", "{item}", "{amount}", "{message}"];

export const EMAIL_DEFAULTS = {
  payoutSubject: "{brand}: add your check mailing address",
  payoutHtml: `<p>Hello {name},</p>
<p>Please add the name to print on your check and the mailing address we should use.</p>
<p><b>This is only for mailing details.</b> It is not a request to sign a payout.</p>
<p>{item}</p>
<p style="text-align:center;margin:28px 0;">
  <a class="btn" href="{link}">Add mailing address</a>
</p>
<p style="font-size:13px;color:#667085;">If the button does not open, copy this link:<br>{link}</p>`,
  acceptSubject: "{brand}: review and sign{subjectAmount}",
  acceptHtml: `<p>Hello {name},</p>
<p>Your consignment is ready for you to review and sign.</p>
<p>{item}</p>
<p>{amount}</p>
<p><b>This is the signature page.</b> It is not the mailing-address form.</p>
<p style="text-align:center;margin:28px 0;">
  <a class="btn" href="{link}">Review and sign</a>
</p>
<p style="font-size:13px;color:#667085;">If the button does not open, copy this link:<br>{link}</p>`,
  customSubject: "A note from {brand}",
  customHtml: `<p>Hello {name},</p>
<p>{message}</p>
<p style="text-align:center;margin:28px 0;">
  <a class="btn" href="{link}">Open link</a>
</p>`,
  sentSubject: "{brand}: {sentHeadline}{subjectAmount}",
  sentHtml: `<p>Hello {name},</p>
<p>{sentLead}</p>
<p>{item}</p>
<p>{amount}</p>
<p>{checkLine}</p>
<p style="text-align:center;margin:28px 0;">
  <a class="btn" href="{link}">View payout</a>
</p>
<p style="font-size:13px;color:#667085;">If the button does not open, copy this link:<br>{link}</p>`,
};

export const EMAIL_KICKER: Record<EmailKind, string> = {
  payout: "Check mailing",
  accept: "Payout signature",
  custom: "Message",
  sent: "Payout sent",
};

export function emailKindLabel(kind?: string | null) {
  if (kind === "payout") return "Mailing";
  if (kind === "accept") return "Sign";
  if (kind === "custom") return "Note";
  if (kind === "sent") return "Sent";
  return "Email";
}

export function fillPlaceholders(template: string, vars: Record<string, string>, mode: "text" | "html" = "text") {
  let text = template || "";
  for (const [key, value] of Object.entries(vars)) {
    const raw = value || "";
    const next =
      key === "link"
        ? mode === "html"
          ? escapeAttr(raw)
          : raw
        : key === "message" && mode === "html"
          ? raw
          : mode === "html"
            ? escapeHtml(raw)
            : raw;
    text = text.replace(new RegExp(`\\{${key}\\}`, "g"), next);
  }
  return text.replace(/<p>\s*<\/p>/gi, "");
}

export function messageToHtml(value: string) {
  const parts = String(value || "")
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  return parts.map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`).join("\n");
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function rewritePortalHrefs(html: string) {
  const portal = appUrl();
  return html
    .replace(/href="https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/gi, `href="${portal}`)
    .replace(/href="https?:\/\/(?:www\.)?itnx\.tech(?=\/(?:info|sign)\/)/gi, `href="${portal}`)
    .replace(/href="\/(info|sign)\//gi, `href="${portal}/$1/`);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapEmailHtml(
  inner: string,
  opts: { brand: string; legal: string; website?: string | null; kicker?: string | null }
) {
  const site = safeHttpUrl(opts.website || "") || "https://itnx.tech";
  const siteLabel = site.replace(/^https?:\/\//, "");
  const body = rewritePortalHrefs(inner);
  const kicker = opts.kicker ? escapeHtml(opts.kicker) : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(opts.brand)}</title>
  <style>
    .btn {
      display: inline-block;
      background: #0b7ea8;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      padding: 12px 18px;
      border-radius: 10px;
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#122033;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fa;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6eaf0;">
          <tr>
            <td style="background:#07090d;padding:22px 28px;color:#ffffff;">
              <div style="font-size:18px;font-weight:800;letter-spacing:.08em;">ITNX</div>
              <div style="color:#5ce1ff;font-size:12px;margin-top:4px;">${escapeHtml(opts.brand)}</div>
              ${kicker ? `<div style="color:#9ec9d8;font-size:11px;margin-top:10px;letter-spacing:.08em;text-transform:uppercase;">${kicker}</div>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:16px;line-height:1.55;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;color:#667085;font-size:12px;line-height:1.5;border-top:1px solid #e6eaf0;">
              A service of ${escapeHtml(opts.legal)}<br>
              <a href="${escapeHtml(site)}" style="color:#0b7ea8;text-decoration:none;">${escapeHtml(siteLabel)}</a>
              · <a href="${escapeHtml(appUrl() + "/consignment-agreement")}" style="color:#0b7ea8;text-decoration:none;">Agreement</a>
              · <a href="${escapeHtml(appUrl() + "/terms")}" style="color:#0b7ea8;text-decoration:none;">Terms</a>
              · <a href="${escapeHtml(appUrl() + "/privacy")}" style="color:#0b7ea8;text-decoration:none;">Privacy</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailHtml(
  kind: EmailKind,
  templates: {
    brand: string;
    legal: string;
    website: string;
    payoutSubject: string;
    payoutHtml: string;
    acceptSubject: string;
    acceptHtml: string;
    customSubject: string;
    customHtml: string;
  },
  vars: Record<string, string>
) {
  const kicker = EMAIL_KICKER[kind];
  if (kind === "sent") {
    const subject = fillPlaceholders(EMAIL_DEFAULTS.sentSubject, vars, "text");
    const inner = fillPlaceholders(EMAIL_DEFAULTS.sentHtml, vars, "html");
    return {
      subject,
      html: wrapEmailHtml(inner, { ...templates, kicker }),
      text: stripHtml(inner),
    };
  }
  if (kind === "custom") {
    const subject = (vars.subject || fillPlaceholders(templates.customSubject, vars, "text")).trim() || "A note from ITNX";
    const messageHtml = vars.messageHtml || messageToHtml(vars.message || "");
    const button = vars.link
      ? `<p style="text-align:center;margin:28px 0;"><a class="btn" href="${escapeAttr(vars.link)}">${escapeHtml(vars.buttonLabel || "Open link")}</a></p>
<p style="font-size:13px;color:#667085;">If the button does not open, copy this link:<br>${escapeHtml(vars.link)}</p>`
      : "";
    const inner = `<p>Hello ${escapeHtml(vars.name || "")},</p>${messageHtml}${button}`;
    return {
      subject,
      html: wrapEmailHtml(inner, { ...templates, kicker }),
      text: stripHtml(inner),
    };
  }

  const subjectSrc = kind === "payout" ? templates.payoutSubject : templates.acceptSubject;
  const htmlSrc = kind === "payout" ? templates.payoutHtml : templates.acceptHtml;
  const subject = fillPlaceholders(subjectSrc, vars, "text");
  const inner = fillPlaceholders(htmlSrc, vars, "html");
  return {
    subject,
    html: wrapEmailHtml(inner, { ...templates, kicker }),
    text: stripHtml(inner),
  };
}
