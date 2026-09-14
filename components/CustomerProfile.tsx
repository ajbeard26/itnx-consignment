"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, X } from "lucide-react";
import AddressFields from "@/components/AddressFields";
import DealId from "@/components/DealId";
import { updateCustomer } from "@/app/customers/actions";
import { initials } from "@/lib/initials";

type Customer = {
  id: string;
  reference: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  alreadyVerified: boolean;
  payoutReady: boolean;
  mapsVerified: boolean;
};

function dash(value: string) {
  return value.trim() || "—";
}

function SaveWatcher({ onSaved }: { onSaved: () => void }) {
  const { pending } = useFormStatus();
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending) onSaved();
    was.current = pending;
  }, [pending, onSaved]);
  return null;
}

function SaveButton({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export default function CustomerProfile(c: Customer) {
  const [editing, setEditing] = useState(false);
  const meta = [c.company, [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ");

  return (
    <form action={updateCustomer.bind(null, c.id)} className="account-stack">
      <SaveWatcher onSaved={() => setEditing(false)} />

      <section className="account-section profile-ident">
        <div className="avatar" aria-hidden>
          {initials(c.name) || "•"}
        </div>
        <div className="profile-ident-copy">
          <DealId value={c.reference} label="Customer ID" />
          <h2>{c.name}</h2>
          {meta ? <p className="profile-meta">{meta}</p> : null}
          <div className="profile-pills">
            <span className={c.payoutReady ? "badge badge-ok" : "badge badge-warn"}>
              {c.payoutReady ? "Payout on file" : "Needs payout info"}
            </span>
            <span className={c.mapsVerified ? "badge badge-ok" : "badge"}>
              {c.mapsVerified ? "Address verified" : "Address not verified"}
            </span>
          </div>
        </div>
      </section>

      <section className="account-section">
        <div className="account-section-head">
          <h2>Contact</h2>
          <button className="edit-btn" type="button" onClick={() => setEditing((v) => !v)}>
            {editing ? <X size={14} /> : <Pencil size={14} />}
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
        {editing ? (
          <>
            <div className="form">
              <div className="field">
                <label>Full name</label>
                <input name="name" required defaultValue={c.name} />
              </div>
              <div className="field">
                <label>Company</label>
                <input name="company" defaultValue={c.company} />
              </div>
              <div className="field">
                <label>Email</label>
                <input name="email" type="email" defaultValue={c.email} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input name="phone" defaultValue={c.phone} />
              </div>
            </div>
            <AddressFields
              street={c.street}
              city={c.city}
              state={c.state}
              zip={c.zip}
              alreadyVerified={c.alreadyVerified}
              required={false}
            />
            <div className="form-actions" style={{ marginTop: 16 }}>
              <SaveButton label="Save contact" />
            </div>
          </>
        ) : (
          <dl className="fact-grid">
            <div>
              <dt>Email</dt>
              <dd>{dash(c.email)}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{dash(c.phone)}</dd>
            </div>
            <div className="full">
              <dt>Street</dt>
              <dd>{dash(c.street)}</dd>
            </div>
            <div>
              <dt>City / township</dt>
              <dd>{dash(c.city)}</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>{dash(c.state)}</dd>
            </div>
            <div>
              <dt>Postal code</dt>
              <dd>{dash(c.zip)}</dd>
            </div>
          </dl>
        )}
      </section>
    </form>
  );
}
