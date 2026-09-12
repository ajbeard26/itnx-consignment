import Shell from "@/components/Shell";
import AccountForm from "@/components/AccountForm";
import { db } from "@/lib/db";
import { PLATFORMS } from "@/lib/labels";
import { save } from "./actions";

export const metadata = { title: "Settings" };

export default async function Page() {
  const s = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const admin = await db.admin.findUnique({ where: { id: "staff" } });

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Workspace</p>
          <h1>Settings</h1>
          <p className="muted">Company details, deal defaults, and the staff login for this portal.</p>
        </div>
      </div>
      <div className="settings-grid">
        <form action={save} className="card panel">
          <h2>Company</h2>
          <p className="muted">Shown on the customer acceptance page and used as your portal identity.</p>
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
          <h2>Deal defaults</h2>
          <p className="muted">These fill in when you create a consignment. You can still change them per deal.</p>
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
                placeholder="ACH timing, check pickup, or anything staff should remember."
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="button">Save settings</button>
          </div>
        </form>
        <div className="card panel">
          <h2>Staff login</h2>
          <p className="muted">
            This is the email and password for the home screen. Current password is required to
            make a change.
          </p>
          <AccountForm email={admin?.email || ""} />
        </div>
      </div>
    </Shell>
  );
}
