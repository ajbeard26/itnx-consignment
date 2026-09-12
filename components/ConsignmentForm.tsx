"use client";

import { useState, useTransition } from "react";
import PhotoInput from "@/components/PhotoInput";
import CustomerPicker from "@/components/CustomerPicker";
import { CATEGORIES, CONDITIONS, PLATFORMS, STATUS_LABEL } from "@/lib/labels";
import { create, importListing } from "@/app/consignments/new/actions";
import type { Method } from "@prisma/client";

type CustomerOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
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
  percent: number;
  method: Method;
  status: string;
  notes: string;
  photoUrls: string[];
};

export default function ConsignmentForm({
  customers,
  percent,
  method,
  platform,
}: {
  customers: CustomerOption[];
  percent: number;
  method: Method;
  platform: string;
}) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
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
      }));
      setFormKey((n) => n + 1);
    });
  }

  return (
    <form action={create} className="stack">
      <section className="card panel">
        <h2>GovDeals listing</h2>
        <p className="muted">Paste the listing URL to fill title, description, price, and photos.</p>
        <div className="import-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.govdeals.com/asset/…"
            inputMode="url"
          />
          <button className="button" type="button" onClick={pull} disabled={pending || !url.trim()}>
            {pending ? "Pulling…" : "Pull listing"}
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </section>

      <section className="card panel">
        <h2>Customer</h2>
        <p className="muted">Use an existing customer or add someone new. They can later fill payout details on their private link.</p>
        <CustomerPicker customers={customers} />
      </section>

      <div key={formKey} className="stack">

      <section className="card panel">
        <h2>Item</h2>
        <div className="form">
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
            <label>Serial / VIN / asset tag</label>
            <input name="serial" defaultValue={values.serial} />
          </div>
          <div className="field">
            <label>Storage location</label>
            <input name="location" defaultValue={values.location} placeholder="Yard, warehouse, lot" />
          </div>
          <div className="field full">
            <label>Description</label>
            <textarea
              name="description"
              rows={4}
              defaultValue={values.description}
              placeholder="Hours, attachments, known issues, included parts."
            />
          </div>
          <div className="field full">
            <label>Photos</label>
            {values.photoUrls.map((src) => (
              <input key={src} type="hidden" name="importedPhotos" value={src} />
            ))}
            {values.photoUrls.length ? (
              <div className="photo-grid">
                {values.photoUrls.map((src) => (
                  <img key={src} src={src} alt="" />
                ))}
              </div>
            ) : null}
            <PhotoInput />
          </div>
        </div>
      </section>

      <section className="card panel">
        <h2>Sale & payout</h2>
        <div className="form">
          <div className="field">
            <label>Sale price ($)</label>
            <input name="sale" type="number" step=".01" min="0" defaultValue={values.sale} placeholder="0.00" />
            <small className="muted">What it actually sold for. Leave blank until it sells.</small>
          </div>
          <div className="field">
            <label>Asking price ($)</label>
            <input name="asking" type="number" step=".01" min="0" defaultValue={values.asking} placeholder="0.00" />
            <small className="muted">List / start price on GovDeals or other platforms.</small>
          </div>
          <div className="field">
            <label>Platform / selling fee ($)</label>
            <input name="fee" type="number" step=".01" min="0" defaultValue={values.fee} />
          </div>
          <div className="field">
            <label>Platform</label>
            <select name="platform" defaultValue={values.platform}>
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
            <label>Customer share (%)</label>
            <input
              name="percent"
              type="number"
              min="0"
              max="100"
              step=".01"
              defaultValue={values.percent}
            />
            <small className="muted">50 = 50/50. 60 pays the customer 60% and ITNX 40%.</small>
          </div>
          <div className="field">
            <label>Payout method</label>
            <select name="method" defaultValue={values.method}>
              <option value="ACH">ACH</option>
              <option value="CHECK">Check</option>
              <option value="CASH">Cash</option>
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
          <div className="field full">
            <label>Internal notes</label>
            <textarea name="notes" rows={3} defaultValue={values.notes} placeholder="Payout instructions, pickup, or staff notes." />
          </div>
        </div>
      </section>
      </div>

      <div className="form-actions">
        <button className="button" type="submit">
          Create consignment
        </button>
      </div>
    </form>
  );
}