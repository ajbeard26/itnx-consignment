"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import PhotoInput from "@/components/PhotoInput";
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
import { todayInput } from "@/lib/dates";
import CommissionTable from "@/components/CommissionTable";
import { initials } from "@/lib/initials";

type Customer = {
  id: string;
  reference: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
};

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
  listedAt: string;
  percent: number;
  method: Method;
  status: string;
  notes: string;
  photoUrls: string[];
};

export default function ConsignmentForm({
  customer,
  percent,
  method,
  platform,
}: {
  customer: Customer;
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
    fee: "",
    platform: platform || "",
    listingUrl: "",
    listedAt: "",
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
        listedAt: prev.listedAt || todayInput(),
        status: prev.status === "RECEIVED" ? "LISTED" : prev.status,
        photoUrls: listing.photoUrls,
        ...applySchedule(prev.sale, listing.sale || prev.asking, prev.fee, prev.percent),
      }));
      setFormKey((n) => n + 1);
    });
  }

  return (
    <form action={create} className="compose">
      <input type="hidden" name="customerId" value={customer.id} />

      <section className="compose-section">
        <div className="picked compose-customer">
          <div className="deal-thumb placeholder" aria-hidden>
            {initials(customer.name) || "•"}
          </div>
          <div>
            {customer.reference ? <div className="deal-id-line">{customer.reference}</div> : null}
            <b>{customer.name}</b>
            <div className="muted">
              {[customer.company, customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact on file"}
            </div>
          </div>
          <Link className="button ghost" href="/consignments/new">
            Change
          </Link>
        </div>
      </section>

      <section className="compose-section">
        <div className="compose-head">
          <div>
            <h2>Auction details</h2>
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
                        setValues((prev) => ({ ...prev, photoUrls: prev.photoUrls.filter((photo) => photo !== src) }))
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
            <h2>Listing</h2>
            <p className="muted">Where it is selling and when it went live.</p>
          </div>
        </div>
        <div key={`sale-${formKey}`} className="form">
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
            <label>Status</label>
            <select name="status" defaultValue={values.status}>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Date listed</label>
            <input name="listedAt" type="date" defaultValue={values.listedAt} />
          </div>
          <div className="field">
            <label>Asking</label>
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
              placeholder="If listed"
            />
          </div>
          <div className="field full">
            <label>Listing URL</label>
            <input
              name="listingUrl"
              defaultValue={values.listingUrl}
              placeholder="https://www.govdeals.com/asset/…"
              inputMode="url"
            />
          </div>
        </div>
      </section>

      <section className="compose-section">
        <div className="compose-head">
          <div>
            <h2>Sale & payout</h2>
            <p className="muted">Leave sale blank until it sells. Auction fees come out of ITNX’s commission.</p>
          </div>
        </div>

        <div className="form">
          <div className="field">
            <label>Sale</label>
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
              placeholder="Final sold price"
            />
          </div>
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
        </div>

        <div className="compose-block">
          <div className="compose-block-head">
            <h3>Split</h3>
            <label className="check-line quiet">
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
              Use published schedule
            </label>
          </div>
          <div className="form">
            <div className="field">
              <label>Consignor share</label>
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
            <div className="field">
              <label>Auction fee</label>
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
                placeholder="ITNX pays"
              />
            </div>
          </div>
          {Number(values.sale || values.asking) > 0 ? (
            <SplitPreview sale={values.sale} asking={values.asking} percent={values.percent} fee={values.fee} />
          ) : null}
          <details className="compose-details">
            <summary>Commission schedule</summary>
            <CommissionTable active={tierForSale(Math.round(Number(values.sale || values.asking || 0) * 100))} staff />
          </details>
        </div>

        <div className="compose-block">
          <h3>Internal notes</h3>
          <div className="field full">
            <textarea name="notes" rows={3} defaultValue={values.notes} placeholder="Pickup, mailing, or staff notes." />
          </div>
        </div>
      </section>

      <div className="compose-foot">
        <Link className="text-link" href="/consignments/new">
          Back to customer
        </Link>
        <button className="button" type="submit">
          Create consignment
        </button>
      </div>
    </form>
  );
}

function SplitPreview({
  sale,
  asking,
  percent,
  fee,
}: {
  sale: string;
  asking: string;
  percent: number;
  fee: string;
}) {
  const saleCents = Math.round(Number(sale || asking || 0) * 100);
  const feeCents = Math.round(Number(fee || 0) * 100);
  const split = calc(saleCents, Math.round(Number(percent || 0) * 100), feeCents);
  const sold = Boolean(Number(sale));
  return (
    <dl className="split-preview">
      <div>
        <dt>{sold ? "Sale" : "Asking"}</dt>
        <dd>{money(split.sale)}</dd>
      </div>
      <div>
        <dt>Consignor ({split.consignorPercent}%)</dt>
        <dd>{money(split.customer)}</dd>
      </div>
      <div>
        <dt>ITNX commission</dt>
        <dd>{money(split.gross)}</dd>
      </div>
      <div>
        <dt>Auction fee</dt>
        <dd>-{money(split.fee)}</dd>
      </div>
      <div className="net">
        <dt>ITNX net</dt>
        <dd>{money(split.net)}</dd>
      </div>
    </dl>
  );
}
