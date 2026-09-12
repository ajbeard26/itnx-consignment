import { stripHtml } from "@/lib/html";

export type EmailKind = "payout" | "accept" | "custom";

export const EMAIL_PLACEHOLDERS = ["{brand}", "{legal}", "{name}", "{link}", "{email}"];

export const EMAIL_DEFAULTS = {
  payoutSubject: "{brand}: add your payout information",
  payoutHtml: `<p>Hello {name},</p>
<p>Please confirm how we should send payment when your consignment is sold.</p>
<p style="text-align:center;margin:28px 0;">
  <a class="btn" href="{link}">Add payout information</a>
</p>
<p>If you did not expect this email, you can ignore it.</p>`,
  acceptSubject: "{brand}: review and sign your payout",
  acceptHtml: `<p>Hello {name},</p>
<p>Your consignment payout is ready for review. Open the link below to confirm the terms and sign.</p>
<p style="text-align:center;margin:28px 0;">
  <a class="btn" href="{link}">Review and sign</a>
</p>
<p>Questions? Reply to this email and we will help.</p>`,
  customSubject: "A note from {brand}",
  customHtml: `<p>Hello {name},</p>
<p>Write your message here.</p>
<p style="text-align:center;margin:28px 0;">
  <a class="btn" href="{link}">Open your page</a>
</p>`,
};

export function fillPlaceholders(template: string, vars: Record<string, string>) {
  let text = template || "";
  for (const [key, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, "g"), value || "");
  }
  return text;
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
  opts: { brand: string; legal: string; website?: string | null }
) {
  const site = (opts.website || "https://itnx.tech").replace(/\/$/, "");
  const siteLabel = site.replace(/^https?:\/\//, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(opts.brand)}</title>
  <style>
    .btn {
      display: inline-block;
      background: #122033;
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
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:16px;line-height:1.55;">
              ${inner}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;color:#667085;font-size:12px;line-height:1.5;border-top:1px solid #e6eaf0;">
              A service of ${escapeHtml(opts.legal)}<br>
              <a href="${escapeHtml(site)}" style="color:#0b7ea8;text-decoration:none;">${escapeHtml(siteLabel)}</a>
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
  const subjectSrc =
    kind === "payout" ? templates.payoutSubject : kind === "accept" ? templates.acceptSubject : templates.customSubject;
  const htmlSrc =
    kind === "payout" ? templates.payoutHtml : kind === "accept" ? templates.acceptHtml : templates.customHtml;
  const subject = fillPlaceholders(subjectSrc, vars);
  const inner = fillPlaceholders(htmlSrc, vars);
  return {
    subject,
    html: wrapEmailHtml(inner, templates),
    text: stripHtml(inner),
  };
}
