import { CATEGORIES, CONDITIONS, METHOD_HINT, METHOD_LABEL, METHOD_OPTIONS, PLATFORMS, STATUS_LABEL } from "@/lib/labels";
import { dollarsFromCents } from "@/lib/commission";
import { isArchivedStatus } from "@/lib/deals";
import { updateDeal } from "@/app/consignments/[id]/actions";
import type { Method, Status } from "@prisma/client";

export default function DealSettings({
  id,
  title,
  status,
  category,
  condition,
  serial,
  location,
  platform,
  listingUrl,
  method,
  salePriceCents,
  askingPriceCents,
  notes,
}: {
  id: string;
  title: string;
  status: Status;
  category: string;
  condition: string;
  serial: string;
  location: string;
  platform: string;
  listingUrl: string;
  method: Method;
  salePriceCents: number;
  askingPriceCents: number;
  notes: string;
}) {
  return (
    <form action={updateDeal.bind(null, id)} className="card panel">
      <h2>Deal</h2>
      <p className="muted">
        Change status, sale, or payout here. Completed and Paid archive the deal automatically.
      </p>
      <div className="form">
        <div className="field full">
          <label>Title</label>
          <input name="title" required defaultValue={title} />
        </div>
        <div className="field">
          <label>Status</label>
          <select name="status" defaultValue={status}>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
                {isArchivedStatus(value as Status) ? " · archives" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Platform</label>
          <select name="platform" defaultValue={platform}>
            <option value="">Select</option>
            {PLATFORMS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Payout method</label>
          <select name="method" defaultValue={method}>
            {METHOD_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {METHOD_LABEL[item]}
              </option>
            ))}
          </select>
          <small className="muted">{METHOD_HINT[method]}</small>
        </div>
        <div className="field">
          <label>Category</label>
          <select name="category" defaultValue={category}>
            <option value="">Select</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Condition</label>
          <select name="condition" defaultValue={condition}>
            <option value="">Select</option>
            {CONDITIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Serial / VIN</label>
          <input name="serial" defaultValue={serial} />
        </div>
        <div className="field">
          <label>Storage location</label>
          <input name="location" defaultValue={location} />
        </div>
        <div className="field">
          <label>Sale</label>
          <input name="sale" inputMode="decimal" defaultValue={salePriceCents ? dollarsFromCents(salePriceCents) : ""} />
        </div>
        <div className="field">
          <label>Asking</label>
          <input name="asking" inputMode="decimal" defaultValue={askingPriceCents ? dollarsFromCents(askingPriceCents) : ""} />
        </div>
        <div className="field full">
          <label>Listing URL</label>
          <input name="listingUrl" inputMode="url" defaultValue={listingUrl} />
        </div>
        <div className="field full">
          <label>Internal notes</label>
          <textarea name="notes" rows={3} defaultValue={notes} />
        </div>
      </div>
      <div className="form-actions" style={{ marginTop: 16 }}>
        <button className="button" type="submit">
          Save deal
        </button>
      </div>
    </form>
  );
}
