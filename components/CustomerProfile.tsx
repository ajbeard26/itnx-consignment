"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, X } from "lucide-react";
import AddressFields from "@/components/AddressFields";
import { updateCustomer } from "@/app/customers/actions";
import { initials } from "@/lib/initials";

type Customer = {
  id: string;
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

function EditButton({ onClick, open }: { onClick: () => void; open: boolean }) {
  return (
    <button className="edit-btn" type="button" onClick={onClick}>
      {open ? <X size={14} /> : <Pencil size={14} />}
      {open ? "Cancel" : "Edit"}
    </button>
  );
}

export default function CustomerProfile(c: Customer) {
  const [editing, setEditing] = useState<"info" | "address" | null>(null);
  const location = [c.city, c.state].filter(Boolean).join(", ");

  return (
    <form action={updateCustomer.bind(null, c.id)} className="account-stack">
      <SaveWatcher onSaved={() => setEditing(null)} />

      <section className="account-section profile-ident">
        <div className="avatar" aria-hidden>
          {initials(c.name) || "•"}
        </div>
        <div className="profile-ident-copy">
          <h2>{c.name}</h2>
          <p>{c.company || "Individual"}</p>
          {location ? <p className="muted">{location}</p> : null}
          <div className="head-badges" style={{ justifyContent: "flex-start", marginTop: 10 }}>
            <span className={c.payoutReady ? "badge badge-ok" : "badge badge-warn"}>
              {c.payoutReady ? "Payout info received" : "Waiting on payout info"}
            </span>
            <span className={c.mapsVerified ? "badge badge-ok" : "badge"}>
              {c.mapsVerified ? "Address verified" : "Address not verified"}
            </span>
          </div>
        </div>
      </section>

      <section className="account-section">
        <div className="account-section-head">
          <h2>Personal information</h2>
          <EditButton open={editing === "info"} onClick={() => setEditing(editing === "info" ? null : "info")} />
        </div>
        {editing === "info" ? (
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
                <label>Email address</label>
                <input name="email" type="email" defaultValue={c.email} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input name="phone" defaultValue={c.phone} />
              </div>
            </div>
            <input type="hidden" name="street" value={c.street} />
            <input type="hidden" name="city" value={c.city} />
            <input type="hidden" name="state" value={c.state} />
            <input type="hidden" name="zip" value={c.zip} />
            <div className="form-actions" style={{ marginTop: 16 }}>
              <SaveButton label="Save contact" />
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="name" value={c.name} />
            <input type="hidden" name="company" value={c.company} />
            <input type="hidden" name="email" value={c.email} />
            <input type="hidden" name="phone" value={c.phone} />
            {editing !== "address" ? (
              <>
                <input type="hidden" name="street" value={c.street} />
                <input type="hidden" name="city" value={c.city} />
                <input type="hidden" name="state" value={c.state} />
                <input type="hidden" name="zip" value={c.zip} />
              </>
            ) : null}
            <dl className="fact-grid">
              <div>
                <dt>Full name</dt>
                <dd>{dash(c.name)}</dd>
              </div>
              <div>
                <dt>Company</dt>
                <dd>{dash(c.company)}</dd>
              </div>
              <div>
                <dt>Email address</dt>
                <dd>{dash(c.email)}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{dash(c.phone)}</dd>
              </div>
            </dl>
          </>
        )}
      </section>

      <section className="account-section">
        <div className="account-section-head">
          <h2>Address</h2>
          <EditButton open={editing === "address"} onClick={() => setEditing(editing === "address" ? null : "address")} />
        </div>
        {editing === "address" ? (
          <>
            <AddressFields
              street={c.street}
              city={c.city}
              state={c.state}
              zip={c.zip}
              alreadyVerified={c.alreadyVerified}
              required={false}
            />
            <div className="form-actions" style={{ marginTop: 16 }}>
              <SaveButton label="Save address" />
            </div>
          </>
        ) : (
          <dl className="fact-grid">
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
