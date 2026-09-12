import Shell from "@/components/Shell";
import AccountForm from "@/components/AccountForm";
import { db } from "@/lib/db";
import { PLATFORMS } from "@/lib/labels";
import { saveCompany, saveDeals, saveMessaging, sendTestSms } from "./actions";
import GoogleAddressTest from "@/components/GoogleAddressTest";
import { smsTemplates } from "@/lib/sms";
import { telnyxConfigured } from "@/lib/telnyx";

export const metadata = { title: "Settings" };

function secretPlaceholder(value: string | null | undefined) {
  return value ? "••••••••" : "";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ sms?: string }>;
}) {
  const { sms } = await searchParams;
  const s = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const admin = await db.admin.findUnique({ where: { id: "staff" } });
  const templates = await smsTemplates();
  const webhook = `${(process.env.NEXT_PUBLIC_APP_URL || "https://co.itnx.tech").replace(/\/$/, "")}/api/telnyx/webhook`;
  const smsReady = telnyxConfigured(s);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Workspace</p>
          <h1>Settings</h1>
          <p className="muted">Company identity, address checks, and Telnyx texts for customer consent.</p>
        </div>
      </div>

      <div className="settings-pills">
        <span className="badge badge-ok">Address verify on</span>
        <span className={smsReady ? "badge badge-ok" : "badge"}>
          {smsReady ? "Telnyx SMS connected" : "Telnyx not connected"}
        </span>
      </div>
      {sms === "sent" ? <p className="form-ok">Test text sent.</p> : null}
      {sms && sms !== "sent" ? <p className="form-error">{sms}</p> : null}

      <div className="settings-stack-wide">
        <form action={saveCompany} className="card panel">
          <h2>Company</h2>
          <p className="muted">Shown on customer payout pages and SMS templates as your brand.</p>
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

        <div className="card panel">
          <h2>Address verification</h2>
          <p className="muted">
            No API key is required. We confirm the exact house number and city. Street ranges and misspelled cities will not pass.
          </p>
          <h3>Test a US address</h3>
          <p className="muted">This does not save the test address.</p>
          <GoogleAddressTest />
        </div>

        <form action={saveMessaging} className="card panel">
          <h2>Telnyx SMS</h2>
          <p className="muted">
            Text customers a consent ask, then their payout or signature link. They can reply YES, STOP, or HELP.
          </p>
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

        <div className="card panel">
          <h2>Staff login</h2>
          <p className="muted">Email and password for the home screen. Current password is required to change it.</p>
          <AccountForm email={admin?.email || ""} />
        </div>
      </div>
    </Shell>
  );
}