import Shell from "@/components/Shell";
import PhotoInput from "@/components/PhotoInput";
import { db } from "@/lib/db";
import { CATEGORIES, CONDITIONS, PLATFORMS, STATUS_LABEL } from "@/lib/labels";
import { create } from "./actions";

export const metadata = { title: "New consignment" };

export default async function Page() {
  const s = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Deals</p>
          <h1>New consignment</h1>
          <p className="muted">Customer, item photos, split, and payout details for this deal.</p>
        </div>
      </div>
      <form action={create} className="stack">
        <section className="card panel">
          <h2>Customer</h2>
          <div className="form">
            <div className="field">
              <label>Full name</label>
              <input name="name" required placeholder="Jane Smith" />
            </div>
            <div className="field">
              <label>Company</label>
              <input name="company" placeholder="Optional" />
            </div>
            <div className="field">
              <label>Email</label>
              <input name="email" type="email" placeholder="name@email.com" />
            </div>
            <div className="field">
              <label>Phone</label>
              <input name="phone" placeholder="(555) 555-5555" />
            </div>
            <div className="field full">
              <label>Address</label>
              <input name="address" placeholder="Street, city, state, ZIP" />
            </div>
          </div>
        </section>

        <section className="card panel">
          <h2>Item</h2>
          <div className="form">
            <div className="field full">
              <label>Item title</label>
              <input name="title" required placeholder="2020 Kubota tractor" />
            </div>
            <div className="field">
              <label>Category</label>
              <select name="category" defaultValue="">
                <option value="">Select</option>
                {CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Condition</label>
              <select name="condition" defaultValue="">
                <option value="">Select</option>
                {CONDITIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Serial / VIN / asset tag</label>
              <input name="serial" />
            </div>
            <div className="field">
              <label>Storage location</label>
              <input name="location" placeholder="Yard, warehouse, lot" />
            </div>
            <div className="field full">
              <label>Description</label>
              <textarea name="description" rows={4} placeholder="Hours, attachments, known issues, included parts." />
            </div>
            <div className="field full">
              <label>Photos</label>
              <PhotoInput />
            </div>
          </div>
        </section>

        <section className="card panel">
          <h2>Sale & payout</h2>
          <div className="form">
            <div className="field">
              <label>Sale price ($)</label>
              <input name="sale" type="number" step=".01" min="0" required />
            </div>
            <div className="field">
              <label>Platform / selling fee ($)</label>
              <input name="fee" type="number" step=".01" min="0" defaultValue="0" />
            </div>
            <div className="field">
              <label>Platform</label>
              <select name="platform" defaultValue={s.defaultPlatform || ""}>
                <option value="">Select</option>
                {PLATFORMS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Listing URL</label>
              <input name="listingUrl" type="url" placeholder="https://" />
            </div>
            <div className="field">
              <label>Customer share (%)</label>
              <input
                name="percent"
                type="number"
                min="0"
                max="100"
                step=".01"
                defaultValue={s.defaultCustomerPercentBps / 100}
              />
              <small className="muted">50 = 50/50. 60 pays the customer 60% and ITNX 40%.</small>
            </div>
            <div className="field">
              <label>Payout method</label>
              <select name="method" defaultValue={s.defaultMethod}>
                <option value="ACH">ACH</option>
                <option value="CHECK">Check</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select name="status" defaultValue="PAYOUT_DUE">
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label>Internal notes</label>
              <textarea name="notes" rows={3} placeholder="Payout instructions, pickup, or staff notes." />
            </div>
          </div>
        </section>

        <div className="form-actions">
          <button className="button" type="submit">
            Create consignment
          </button>
        </div>
      </form>
    </Shell>
  );
}
