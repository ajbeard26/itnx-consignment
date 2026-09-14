"use client";

import { useState, useTransition } from "react";
import PhotoInput from "@/components/PhotoInput";
import CustomerPicker from "@/components/CustomerPicker";
import { CATEGORIES, CONDITIONS, METHOD_HINT, METHOD_LABEL, METHOD_OPTIONS, PLATFORMS, STATUS_LABEL } from "@/lib/labels";
import { create, importListing } from "@/app/consignments/new/actions";
import type { Method } from "@prisma/client";
import {
  auctionFeeCents,
  calc,
  dollarsFromCents,
  tierForSale,
} from "@/lib/commission";
import { money } from "@/lib/money";
import CommissionTable from "@/components/CommissionTable";

type Defaults = {
  title: string;
  description: string;
  category: string;
  condition: string;
  serial: string;
  location: string;
  sale: string;
  asking: string;
  fee: string;
  platform: string;
  listingUrl: string;
  percent: number;
  method: Method;
  status: string;
  notes: string;
  photoUrls: string[];
};

export default function ConsignmentForm({
  percent,
  method,
  platform,
}: {
  percent: number;
  method: Method;
  platform: string;
}) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [useSchedule, setUseSchedule] = useState(true);

  function applySchedule(sale: string, asking: string, prevFee: string, prevPercent: number, lock = useSchedule) {
    const saleCents = Math.round(Number(sale || 0) * 100);
    const askingCents = Math.round(Number(asking || 0) * 100);
    const tier = tierForSale(saleCents || askingCents);
    if (!lock) {
      return { percent: prevPercent, fee: prevFee };
    }
    const feeBase = saleCents || askingCents;
    return {
      percent: tier.consignorPercent,
      fee: feeBase ? dollarsFromCents(auctionFeeCents(feeBase)) : prevFee,
    };
  }

  const [values, setValues] = useState<Defaults>({
    title: "",
    description: "",
    category: "",
    condition: "",
    serial: "",
    location: "",
    sale: "",
    asking: "",
    fee: "0",
    platform: platform || "",
    listingUrl: "",
    percent,
    method,
    status: "RECEIVED",
    notes: "",
    photoUrls: [],
  });

  function pull() {
    setError("");
    start(async () => {
      const result = await importListing(url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const listing = result.listing;
      setValues((prev) => ({
        ...prev,
        title: listing.title || prev.title,
        description: listing.description || prev.description,
        category: CATEGORIES.includes(listing.category as (typeof CATEGORIES)[number])
          ? listing.category
          : listing.category
            ? "Other"
            : prev.category,
        condition: CONDITIONS.find((item) => item.toLowerCase() === listing.condition.toLowerCase()) || prev.condition,
        serial: listing.serial || prev.serial,
        location: listing.location || prev.location,
        asking: listing.sale || prev.asking,
        platform: listing.platform || prev.platform,
        listingUrl: listing.listingUrl || url,
        status: prev.status === "RECEIVED" ? "LISTED" : prev.status,
        photoUrls: listing.photoUrls,
        ...applySchedule(prev.sale, listing.sale || prev.asking, prev.fee, prev.percent),
      }));
      setFormKey((n) => n + 1);
    });
  }

  return (
    <form action={create} className="compose">
      <section className="compose-section">
        <div className="compose-head">
          <div>
            <h2>Customer</h2>
            <p className="muted">Find by name, phone, or a deal ID like CO-ITNX:26-0021.</p>
          </div>
        </div>
        <CustomerPicker />
      </section>

      <section className="compose-section">
        <div className="compose-head">
          <div>
            <h2>Item</h2>
            <p className="muted">Pull a GovDeals listing or enter the item yourself.</p>
          </div>
        </div>
        <div className="import-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.govdeals.com/asset/…"
            inputMode="url"
          />
          <button className="button ghost" type="button" onClick={pull} disabled={pending || !url.trim()}>
            {pending ? "Pulling…" : "Pull listing"}
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}

        <div key={formKey} className="form" style={{ marginTop: 18 }}>
          <div className="field full">
            <label>Item title</label>
            <input name="title" required defaultValue={values.title} placeholder="2020 Kubota tractor" />
          </div>
          <div className="field">
            <label>Category</label>
            <select name="category" defaultValue={values.category}>
              <option value="">Select</option>
              {CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Condition</label>
            <select name="condition" defaultValue={values.condition}>
              <option value="">Select</option>
              {CONDITIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Serial / VIN</label>
            <input name="serial" defaultValue={values.serial} />
          </div>
          <div className="field">
            <label>Storage</label>
            <input name="location" defaultValue={values.location} placeholder="Yard, warehouse, lot" />
          </div>
          <div className="field">
            <label>Date listed</label>
            <input name="listedAt" type="date" />
          </div>
          <div className="field full">
            <label>Description</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={values.description}
              placeholder="Hours, attachments, known issues."
            />
          </div>
          <div className="field full">
            <label>Photos</label>
            {values.photoUrls.length ? (
              <div className="photo-grid">
                {values.photoUrls.map((src) => (
                  <div key={src} className="photo-tile">
                    <input type="hidden" name="importedPhotos" value={src} />
                    <img src={src} alt="" />
                    <button
                      className="photo-remove"
                      type="button"
                      onClick={() =>
                        setValues((prev) => ({ ...prev, photoUrls: prev.photoUrls.filter((url) => url !== src) }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {values.photoUrls.length < 8 ? (
              <PhotoInput max={8 - values.photoUrls.length} />
            ) : (
              <p className="muted">8 photos max. Remove one to add another.</p>
            )}
          </div>
        </div>
      </section>

      <section className="compose-section">
        <div className="compose-head">
          <div>
            <h2>Sale & payout</h2>
            <p className="muted">Consignor share is of the final sale. Auction fees come out of ITNX’s commission.</p>
          </div>
        </div>
        <details className="compose-details">
          <summary>Commission schedule</summary>
          <CommissionTable active={tierForSale(Math.round(Number(values.sale || values.asking || 0) * 100))} staff />
        </details>
        <div key={`sale-${formKey}`} className="form" style={{ marginTop: 16 }}>
          <div className="field">
            <label>Sale price ($)</label>
            <input
              name="sale"
              type="number"
              step=".01"
              min="0"
              value={values.sale}
              onChange={(e) => {
                const sale = e.target.value;
                setValues((prev) => ({ ...prev, sale, ...applySchedule(sale, prev.asking, prev.fee, prev.percent) }));
              }}
              placeholder="0.00"
            />
            <small className="muted">Leave blank until it sells.</small>
          </div>
          <div className="field">
            <label>Asking price ($)</label>
            <input
              name="asking"
              type="number"
              step=".01"
              min="0"
              value={values.asking}
              onChange={(e) => {
                const asking = e.target.value;
                setValues((prev) => ({
                  ...prev,
                  asking,
                  ...(!prev.sale ? applySchedule(prev.sale, asking, prev.fee, prev.percent) : {}),
                }));
              }}
              placeholder="0.00"
            />
          </div>
          <div className="field">
            <label>Auction fee ($)</label>
            <input
              name="fee"
              type="number"
              step=".01"
              min="0"
              value={values.fee}
              onChange={(e) => {
                setUseSchedule(false);
                setValues((prev) => ({ ...prev, fee: e.target.value }));
              }}
            />
            <small className="muted">Default 12.5%. ITNX pays this.</small>
          </div>
          <div className="field">
            <label>Platform</label>
            <select
              name="platform"
              value={values.platform}
              onChange={(e) => setValues((prev) => ({ ...prev, platform: e.target.value }))}
            >
              <option value="">Select</option>
              {PLATFORMS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Listing URL</label>
            <input name="listingUrl" defaultValue={values.listingUrl} placeholder="https://www.govdeals.com/asset/…" inputMode="url" />
          </div>
          <div className="field">
            <label>Consignor share (%)</label>
            <input
              name="percent"
              type="number"
              min="0"
              max="100"
              step="1"
              value={values.percent}
              onChange={(e) => {
                setUseSchedule(false);
                setValues((prev) => ({ ...prev, percent: Number(e.target.value) }));
              }}
            />
          </div>
          <label className="check-line full">
            <input
              type="checkbox"
              checked={useSchedule}
              onChange={(e) => {
                const on = e.target.checked;
                setUseSchedule(on);
                if (on) {
                  setValues((prev) => ({ ...prev, ...applySchedule(prev.sale, prev.asking, prev.fee, prev.percent, true) }));
                }
              }}
            />
            Use the published sale-price schedule
          </label>
          {Number(values.sale || values.asking) > 0 ? (
            <div className="split-preview full">
              {(() => {
                const saleCents = Math.round(Number(values.sale || values.asking || 0) * 100);
                const feeCents = Math.round(Number(values.fee || 0) * 100);
                const split = calc(saleCents, Math.round(Number(values.percent || 0) * 100), feeCents);
                const sold = Boolean(Number(values.sale));
                return (
                  <>
                    <div className="row">
                      <span>{sold ? "Final sale" : "Estimated on asking"}</span>
                      <b>{money(split.sale)}</b>
                    </div>
                    <div className="row">
                      <span>Consignor receives ({split.consignorPercent}%)</span>
                      <b>{money(split.customer)}</b>
                    </div>
                    <div className="row">
                      <span>ITNX commission ({split.consigneePercent}%)</span>
                      <b>{money(split.gross)}</b>
                    </div>
                    <div className="row">
                      <span>Auction fee (ITNX pays)</span>
                      <b>-{money(split.fee)}</b>
                    </div>
                    <div className="row big">
                      <span>ITNX net</span>
                      <span>{money(split.net)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
          <div className="field">
            <label>Payout method</label>
            <select
              name="method"
              value={values.method}
              onChange={(e) => setValues((prev) => ({ ...prev, method: e.target.value as Method }))}
            >
              {METHOD_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {METHOD_LABEL[value]}
                </option>
              ))}
            </select>
            <small className="muted">{METHOD_HINT[values.method]}</small>
          </div>
          <div className="field">
            <label>Status</label>
            <select name="status" defaultValue={values.status}>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label>Internal notes</label>
            <textarea name="notes" rows={3} defaultValue={values.notes} placeholder="Payout instructions, pickup, or staff notes." />
          </div>
        </div>
      </section>

      <div className="compose-foot">
        <button className="button" type="submit">
          Create consignment
        </button>
      </div>
    </form>
  );
}