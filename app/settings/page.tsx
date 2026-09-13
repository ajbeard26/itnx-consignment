import Shell from "@/components/Shell";
import AccountForm from "@/components/AccountForm";
import SettingsTabs, { settingsTab } from "@/components/SettingsTabs";
import EmailTemplateEditor from "@/components/EmailTemplateEditor";
import GoogleAddressTest from "@/components/GoogleAddressTest";
import MessageLog from "@/components/MessageLog";
import Pager from "@/components/Pager";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/urls";
import { METHOD_HINT, METHOD_LABEL, METHOD_OPTIONS, PLATFORMS } from "@/lib/labels";
import CommissionTable from "@/components/CommissionTable";
import { saveCompany, saveDeals, saveMessaging, saveEmail, saveEmailTemplates, sendTestSms, sendTestEmail } from "./actions";
import { smsTemplates } from "@/lib/sms";
import { emailConfigured, emailTemplates } from "@/lib/email";
import { telnyxConfigured } from "@/lib/telnyx";
import { pageNumber, paginate } from "@/lib/paging";

export const metadata = { title: "Settings" };

function secretPlaceholder(value: string | null | undefined) {
  return value ? "••••••••" : "";
}

function when(value: Date) {
  return value.toLocaleString();
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sms?: string; mail?: string; saved?: string; page?: string }>;
}) {
  const { tab: rawTab, sms, mail, saved, page: rawPage } = await searchParams;
  const tab = settingsTab(rawTab);
  const s = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const admin = await db.admin.findUnique({ where: { id: "staff" } });
  const templates = await smsTemplates();
  const email = await emailTemplates();
  const portal = appUrl();
  const webhook = `${portal}/api/telnyx/webhook`;
  const smsReady = telnyxConfigured(s);
  const mailReady = emailConfigured(s);
  const logPagerSeed = pageNumber(rawPage);
  const emailTotal = tab === "email" ? await db.emailMessage.count() : 0;
  const smsTotal = tab === "sms" ? await db.smsMessage.count() : 0;
  const emailPager = paginate(emailTotal, logPagerSeed);
  const smsPager = paginate(smsTotal, logPagerSeed);
  const emailLog =
    tab === "email"
      ? await db.emailMessage.findMany({
          include: { customer: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          skip: emailPager.skip,
          take: emailPager.take,
        })
      : [];
  const smsLog =
    tab === "sms"
      ? await db.smsMessage.findMany({
          include: { customer: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          skip: smsPager.skip,
          take: smsPager.take,
        })
      : [];

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
      </div>

      <SettingsTabs current={tab} />

      <div className={`settings-stack-wide ${tab === "email" || tab === "sms" ? "wide" : ""}`}>
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
                <label>Company website</label>
                <input name="website" defaultValue={s.website || ""} placeholder="https://itnx.tech" />
                <small className="muted">Shown in the email footer. This is not the customer payout link.</small>
              </div>
              <div className="field">
                <label>Customer portal</label>
                <input className="copy-input" readOnly value={portal} />
                <small className="muted">Email and SMS buttons open pages on this site ({portal}), not the company website.</small>
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
            <p className="muted">
              New consignments follow the published sale-price schedule unless you override a deal in writing.{" "}
              <a className="text-link" href="/consignment-agreement">
                Consignment agreement
              </a>
            </p>
            {saved === "1" ? <p className="form-ok">Deal defaults saved.</p> : null}
            {saved && saved !== "1" ? <p className="form-error">{saved}</p> : null}
            <CommissionTable staff />
            <div className="form" style={{ marginTop: 16 }}>
              <div className="field">
                <label>Default payout method</label>
                <select name="defaultMethod" defaultValue={s.defaultMethod}>
                  {METHOD_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {METHOD_LABEL[value]}
                    </option>
                  ))}
                </select>
                <small className="muted">{METHOD_HINT[s.defaultMethod]} Customer pages only ask for fields that match this method.</small>
              </div>
              <div className="field">
                <label>Default platform</label>
                <select name="defaultPlatform" defaultValue={s.defaultPlatform || ""}>
                  <option value="">None</option>
                  {PLATFORMS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label>Payout notes</label>
                <textarea
                  name="payoutNotes"
                  rows={3}
                  defaultValue={s.payoutNotes || ""}
                  placeholder="Check mailing notes, pickup hours, or anything the customer should see."
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="button" type="submit">
                Save defaults
              </button>
            </div>
          </form>
        ) : null}

        {tab === "email" ? (
          <>
            {mail === "sent" ? <p className="form-ok">Test email sent.</p> : null}
            {mail && mail !== "sent" ? <p className="form-error">{mail}</p> : null}
            <div className="settings-grid">
              <form action={saveEmail} className="card panel">
                <h2>SMTP</h2>
                <p className="muted">Mailbox customers see as From. Gmail needs an app password.</p>
                <div className="form">
                  <div className="field">
                    <label>Host</label>
                    <input name="smtpHost" defaultValue={s.smtpHost || ""} placeholder="smtp.gmail.com" />
                  </div>
                  <div className="field">
                    <label>Port</label>
                    <input name="smtpPort" type="number" min="1" max="65535" defaultValue={s.smtpPort || 587} />
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
                    SSL on port 465
                  </label>
                </div>
                <div className="form-actions">
                  <button className="button" type="submit">
                    Save SMTP
                  </button>
                </div>
              </form>

              <form action={sendTestEmail} className="card panel">
                <h2>Send a test</h2>
                <p className="muted">Uses the saved SMTP and template.</p>
                <div className="stack-form">
                  <div className="field">
                    <label>Send to</label>
                    <input name="testEmail" type="email" required placeholder="you@itnx.tech" />
                  </div>
                  <div className="field">
                    <label>Template</label>
                    <select name="kind" defaultValue="payout">
                      <option value="payout">Mailing info</option>
                      <option value="accept">Sign payout</option>
                      <option value="custom">Custom note</option>
                    </select>
                  </div>
                  <button className="button" type="submit" disabled={!mailReady}>
                    Send test email
                  </button>
                </div>
              </form>
            </div>

            <form action={saveEmailTemplates} className="card panel">
              <h2>HTML templates</h2>
              <p className="muted">The ITNX header, button, and footer wrap this HTML automatically. {"{link}"} always opens the customer portal, not itnx.tech.</p>
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

            <MessageLog
              title="Email log"
              empty="No emails yet. Send a test or mail a customer to see it here."
              items={emailLog.map((m) => ({
                id: m.id,
                tone: m.status === "failed" ? "fail" : "out",
                kicker: m.status === "failed" ? "Failed" : m.kind || "Sent",
                title: m.customer?.name || m.to,
                body: m.subject,
                meta: [m.to, when(m.createdAt), m.error].filter(Boolean).join(" · "),
                href: m.customer ? `/customers/${m.customer.id}` : null,
              }))}
            />
            <Pager
              page={emailPager.current}
              pages={emailPager.pages}
              total={emailPager.total}
              hrefFor={(p) => `/settings?tab=email${p > 1 ? `&page=${p}` : ""}`}
            />
          </>
        ) : null}

        {tab === "sms" ? (
          <>
            {sms === "sent" ? <p className="form-ok">Test text sent.</p> : null}
            {sms && sms !== "sent" ? <p className="form-error">{sms}</p> : null}
            <div className="settings-grid">
              <form action={saveMessaging} className="card panel">
                <h2>Telnyx</h2>
                <p className="muted">Customers can reply YES, STOP, or HELP.</p>
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
                  <div className="field full">
                    <label>Inbound webhook</label>
                    <input className="copy-input" readOnly value={webhook} />
                    <small className="muted">Paste this on the Telnyx messaging profile.</small>
                  </div>
                  <div className="field">
                    <label>Messaging profile ID</label>
                    <input name="telnyxMessagingProfileId" defaultValue={s.telnyxMessagingProfileId || ""} />
                  </div>
                  <div className="field">
                    <label>Webhook public key</label>
                    <input
                      name="telnyxPublicKey"
                      type="password"
                      defaultValue={secretPlaceholder(s.telnyxPublicKey)}
                      autoComplete="off"
                    />
                    <small className="muted">Recommended so inbound texts cannot be spoofed.</small>
                  </div>
                  <div className="field full">
                    <label>Consent text</label>
                    <textarea name="smsConsentTemplate" rows={2} defaultValue={templates.consent} />
                  </div>
                  <div className="field full">
                    <label>Check mailing text</label>
                    <textarea name="smsPayoutTemplate" rows={2} defaultValue={templates.payout} />
                  </div>
                  <div className="field full">
                    <label>Signature-link text</label>
                    <textarea name="smsAcceptTemplate" rows={2} defaultValue={templates.accept} />
                    <small className="muted">Placeholders: {"{brand}"} {"{link}"} {"{name}"}</small>
                  </div>
                </div>
                <div className="form-actions">
                  <button className="button" type="submit">
                    Save messaging
                  </button>
                </div>
              </form>

              <form action={sendTestSms} className="card panel">
                <h2>Send a test</h2>
                <p className="muted">Start with your own phone.</p>
                <div className="stack-form">
                  <div className="field">
                    <label>Phone</label>
                    <input name="testPhone" placeholder="(321) 555-0100" required />
                  </div>
                  <button className="button" type="submit" disabled={!smsReady}>
                    Send test text
                  </button>
                </div>
              </form>
            </div>

            <MessageLog
              title="SMS log"
              empty="No texts yet. Send a test or text a customer to see it here."
              items={smsLog.map((m) => ({
                id: m.id,
                tone: m.direction === "IN" ? "in" : m.status === "failed" ? "fail" : "out",
                kicker: m.direction === "IN" ? "In" : "Out",
                title: m.customer?.name || m.phone,
                body: m.body,
                meta: [m.phone, when(m.createdAt), m.status].filter(Boolean).join(" · "),
                href: m.customer ? `/customers/${m.customer.id}` : null,
              }))}
            />
            <Pager
              page={smsPager.current}
              pages={smsPager.pages}
              total={smsPager.total}
              hrefFor={(p) => `/settings?tab=sms${p > 1 ? `&page=${p}` : ""}`}
            />
          </>
        ) : null}

        {tab === "address" ? (
          <div className="card panel">
            <h2>Address verification</h2>
            <p className="muted">
              No API key is required. We look up US mailing addresses, including rural Michigan roads. A match has to use
              the same house number, city, and state — a nearby town will not auto-pass.
            </p>
            <GoogleAddressTest />
          </div>
        ) : null}

        {tab === "staff" ? (
          <div className="card panel">
            <h2>Staff login</h2>
            <p className="muted">Email and password for the home screen. Current password is required to change it.</p>
            {process.env.AUTH_SECRET ? null : (
              <p className="form-error">Add AUTH_SECRET to the server environment so login cookies cannot be forged.</p>
            )}
            <AccountForm email={admin?.email || ""} />
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
