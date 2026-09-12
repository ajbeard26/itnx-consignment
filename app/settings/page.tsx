import Shell from "@/components/Shell";
import AccountForm from "@/components/AccountForm";
import { db } from "@/lib/db";
import { save } from "./actions";

export default async function Page() {
  const s = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const admin = await db.admin.findUnique({ where: { id: "staff" } });

  return (
    <Shell>
      <h1>Settings</h1>
      <div className="settings-stack">
        <div className="card">
          <h2>Deals</h2>
          <form action={save}>
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
              <small className="muted">
                Default is 50%. This only affects new consignments and can be overridden on each
                deal.
              </small>
            </div>
            <br />
            <button className="button">Save</button>
          </form>
        </div>
        <div className="card">
          <h2>Staff login</h2>
          <p className="muted">
            Change the email and password used on the home screen. Current password is required.
          </p>
          <br />
          <AccountForm email={admin?.email || ""} />
        </div>
      </div>
    </Shell>
  );
}
