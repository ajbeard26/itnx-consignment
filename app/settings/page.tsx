import Shell from "@/components/Shell";
import AccountForm from "@/components/AccountForm";
import SettingsTabs, { settingsTab } from "@/components/SettingsTabs";
import EmailTemplateEditor from "@/components/EmailTemplateEditor";
import GoogleAddressTest from "@/components/GoogleAddressTest";
import { db } from "@/lib/db";
import { PLATFORMS } from "@/lib/labels";
import { saveCompany, saveDeals, saveMessaging, saveEmail, saveEmailTemplates, sendTestSms, sendTestEmail } from "./actions";
import { smsTemplates } from "@/lib/sms";
import { emailConfigured, emailTemplates } from "@/lib/email";
import { telnyxConfigured } from "@/lib/telnyx";

export const metadata = { title: "Settings" };

function secretPlaceholder(value: string | null | undefined) {
  return value ? "••••••••" : "";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sms?: string; mail?: string }>;
}) {
  const { tab: rawTab, sms, mail } = await searchParams;
  const tab = settingsTab(rawTab);
  const s = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const admin = await db.admin.findUnique({ where: { id: "staff" } });
  const templates = await smsTemplates();
  const email = await emailTemplates();
  const webhook = `${(process.env.NEXT_PUBLIC_APP_URL || "https://co.itnx.tech").replace(/\/$/, "")}/api/telnyx/webhook`;
  const smsReady = telnyxConfigured(s);
  const mailReady = emailConfigured(s);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Workspace</p>
          <h1>Settings</h1>
          <p className="muted">Company, deals, email, texts, address checks, and staff login.</p>
        </div>
      </div>

      <div className="settings-pills">
        <span className={mailReady ? "badge badge-ok" : "badge"}>{mailReady ? "Email connected" : "Email not connected"}</span>
        <span className={smsReady ? "badge badge-ok" : "badge"}>{smsReady ? "Telnyx SMS connected" : "Telnyx not connected"}</span>
        <span className="badge badge-ok">Address verify on</span>
      </div>

      <SettingsTabs current={tab} />

      <div className={`settings-stack-wide ${tab === "email" ? "wide" : ""}`}>
        {tab === "company" ? (
          <form action={saveCompany} className="card panel">
            <h2>Company</h2>
            <p className="muted">Shown on customer payout pages, emails, and SMS as your brand.</p>
            <div className="form">
              <div className="field">
                <label>Brand name</label>
                <input name="brandName" defaultValue={s.brandName} required />
              </div>
              <div className="field">
                <label>Legal name</label>
                <input name="legalName" defaultValue={s.legalName} required />
              </div>
              <div className="field">
                <label>Contact email</label>
                <input name="contactEmail" type="email" defaultValue={s.contactEmail || ""} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input name="contactPhone" defaultValue={s.contactPhone || ""} />
              </div>
              <div className="field">
                <label>Website</label>
                <input name="website" defaultValue={s.website || ""} placeholder="https://itnx.tech" />
              </div>
              <div className="field">
                <label>Business address</label>
                <input name="address" defaultValue={s.address || ""} />
              </div>
            </div>
            <div className="form-actions">
              <button className="button">Save company</button>
            </div>
          </form>
        ) : null}

        {tab === "deals" ? (
          <form action={saveDeals} className="card panel">
            <h2>Deal defaults</h2>
            <p className="muted">These fill in on a new consignment. You can still change them per deal.</p>
            <div className="form">
              <div className="field">
                <label>Default customer percentage</label>
                <input
                  name="percent"
                  type="number"
                  min="0"
                  max="100"
                  step=".01"
                  defaultValue={s.defaultCustomerPercentBps / 100}
                />
                <small className="muted">50 is an even split. 60 pays the customer 60%.</small>
              </div>
              <div className="field">
                <label>Default payout method</label>
                <select name="defaultMethod" defaultValue={s.defaultMethod}>
                  <option value="ACH">ACH</option>
                  <option value="CHECK">Check</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div className="field">
                <label>Default platform</label>
                <select name="defaultPlatform" defaultValue={s.defaultPlatform || ""}>
                  <option value="">None</option>
                  {PLATFORMS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label>Payout notes</label>
                <textarea
                  name="payoutNotes"
                  rows={3}
                  defaultValue={s.payoutNotes || ""}
                  placeholder="ACH timing, check pickup, or anything the customer should see."
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="button">Save defaults</button>
            </div>
          </form>
        ) : null}

        {tab === "email" ? (
          <>
            {mail === "sent" ? <p className="form-ok">Test email sent.</p> : null}
            {mail && mail !== "sent" ? <p className="form-error">{mail}</p> : null}
            <form action={saveEmail} className="card panel">
              <h2>SMTP sender</h2>
              <p className="muted">Use Gmail, Microsoft 365, or any SMTP mailbox. This is the From address customers will see.</p>
              <div className="form">
                <div className="field">
                  <label>SMTP host</label>
                  <input name="smtpHost" defaultValue={s.smtpHost || ""} placeholder="smtp.gmail.com" />
                </div>
                <div className="field">
                  <label>Port</label>
                  <input name="smtpPort" type="number" defaultValue={s.smtpPort || 587} />
                </div>
                <div className="field">
                  <label>Username</label>
                  <input name="smtpUser" defaultValue={s.smtpUser || ""} autoComplete="off" />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input
                    name="smtpPass"
                    type="password"
                    defaultValue={secretPlaceholder(s.smtpPass)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="field">
                  <label>From name</label>
                  <input name="smtpFromName" defaultValue={s.smtpFromName || s.brandName} />
                </div>
                <div className="field">
                  <label>From email</label>
                  <input name="smtpFromEmail" type="email" defaultValue={s.smtpFromEmail || s.contactEmail || ""} />
                </div>
                <label className="check-line full">
                  <input name="smtpSecure" type="checkbox" defaultChecked={s.smtpSecure} />
                  Use SSL (port 465). Leave off for TLS on 587.
                </label>
              </div>
              <div className="form-actions">
                <button className="button" type="submit">
                  Save SMTP
                </button>
              </div>
            </form>

            <form action={saveEmailTemplates} className="card panel">
              <h2>HTML templates</h2>
              <p className="muted">Edit the email body as HTML. The ITNX header, button style, and footer are added automatically.</p>
              <EmailTemplateEditor
                brand={email.brand}
                legal={email.legal}
                website={email.website}
                payoutSubject={email.payoutSubject}
                payoutHtml={email.payoutHtml}
                acceptSubject={email.acceptSubject}
                acceptHtml={email.acceptHtml}
                customSubject={email.customSubject}
                customHtml={email.customHtml}
              />
              <div className="form-actions">
                <button className="button" type="submit">
                  Save templates
                </button>
              </div>
            </form>

            <form action={sendTestEmail} className="card panel">
              <h2>Send a test email</h2>
              <p className="muted">Uses the saved SMTP and the selected template.</p>
              <div className="form">
                <div className="field">
                  <label>Send to</label>
                  <input name="testEmail" type="email" required placeholder="you@itnx.tech" />
                </div>
                <div className="field">
                  <label>Template</label>
                  <select name="kind" defaultValue="custom">
                    <option value="payout">Payout link</option>
                    <option value="accept">Signature</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button className="button ghost" type="submit" disabled={!mailReady}>
                  Send test
                </button>
              </div>
            </form>
          </>
        ) : null}

        {tab === "sms" ? (
          <>
            {sms === "sent" ? <p className="form-ok">Test text sent.</p> : null}
            {sms && sms !== "sent" ? <p className="form-error">{sms}</p> : null}
            <form action={saveMessaging} className="card panel">
              <h2>Telnyx SMS</h2>
              <p className="muted">Text customers a consent ask, then their payout or signature link. They can reply YES, STOP, or HELP.</p>
              <div className="form">
                <div className="field">
                  <label>API key</label>
                  <input
                    name="telnyxApiKey"
                    type="password"
                    defaultValue={secretPlaceholder(s.telnyxApiKey)}
                    placeholder="KEY..."
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <label>From number</label>
                  <input name="telnyxFromNumber" defaultValue={s.telnyxFromNumber || ""} placeholder="+1321..." />
                </div>
                <div className="field">
                  <label>Messaging profile ID (optional)</label>
                  <input name="telnyxMessagingProfileId" defaultValue={s.telnyxMessagingProfileId || ""} />
                </div>
                <div className="field">
                  <label>Webhook public key (optional)</label>
                  <input
                    name="telnyxPublicKey"
                    type="password"
                    defaultValue={secretPlaceholder(s.telnyxPublicKey)}
                    autoComplete="off"
                  />
                </div>
                <div className="field full">
                  <label>Inbound webhook</label>
                  <input className="copy-input" readOnly value={webhook} />
                  <small className="muted">Paste this on the Telnyx messaging profile as the webhook URL.</small>
                </div>
                <div className="field full">
                  <label>Consent text</label>
                  <textarea name="smsConsentTemplate" rows={2} defaultValue={templates.consent} />
                  <small className="muted">Placeholders: {"{brand}"} {"{link}"} {"{name}"}</small>
                </div>
                <div className="field full">
                  <label>Payout-info text</label>
                  <textarea name="smsPayoutTemplate" rows={2} defaultValue={templates.payout} />
                </div>
                <div className="field full">
                  <label>Signature-link text</label>
                  <textarea name="smsAcceptTemplate" rows={2} defaultValue={templates.accept} />
                </div>
              </div>
              <div className="form-actions">
                <button className="button" type="submit">
                  Save messaging
                </button>
              </div>
            </form>
            <form action={sendTestSms} className="card panel">
              <h2>Send a test text</h2>
              <p className="muted">Uses the Telnyx number above. Start with your own phone.</p>
              <div className="import-row">
                <input name="testPhone" placeholder="(321) 555-0100" required />
                <button className="button ghost" type="submit" disabled={!smsReady}>
                  Send test
                </button>
              </div>
            </form>
          </>
        ) : null}

        {tab === "address" ? (
          <div className="card panel">
            <h2>Address verification</h2>
            <p className="muted">
              No API key is required. We confirm the exact house number and city. Street ranges and misspelled cities will not pass.
            </p>
            <h3>Test a US address</h3>
            <p className="muted">This does not save the test address.</p>
            <GoogleAddressTest />
          </div>
        ) : null}

        {tab === "staff" ? (
          <div className="card panel">
            <h2>Staff login</h2>
            <p className="muted">Email and password for the home screen. Current password is required to change it.</p>
            <AccountForm email={admin?.email || ""} />
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
