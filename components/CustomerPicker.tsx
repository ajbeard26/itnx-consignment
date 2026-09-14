"use client";

import { useRef, useState } from "react";
import { searchCustomers } from "@/app/consignments/new/actions";
import AddressFields from "@/components/AddressFields";

type Option = {
  id: string;
  reference: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
};

export default function CustomerPicker() {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Option[]>([]);
  const [selected, setSelected] = useState<Option | null>(null);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function lookup(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        setHits(await searchCustomers(q));
      } finally {
        setSearching(false);
      }
    }, 250);
  }

  return (
    <div className="picker">
      <div className="seg" role="tablist">
        <button type="button" className={mode === "existing" ? "on" : undefined} onClick={() => setMode("existing")}>
          Find customer
        </button>
        <button type="button" className={mode === "new" ? "on" : undefined} onClick={() => setMode("new")}>
          Add new
        </button>
      </div>

      {mode === "existing" ? (
        <>
          {selected ? <input type="hidden" name="customerId" value={selected.id} /> : (
            <input className="sr-only" name="name" required tabIndex={-1} aria-hidden="true" defaultValue="" />
          )}
          {selected ? (
            <div className="picked">
              <div>
                {selected.reference ? <div className="deal-id-line">{selected.reference}</div> : null}
                <b>{selected.name}</b>
                <div className="muted">
                  {[selected.company, selected.email, selected.phone].filter(Boolean).join(" · ") || "No contact on file"}
                </div>
              </div>
              <button type="button" className="button ghost" onClick={() => setSelected(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <div className="field full">
                <label>Search name, email, phone, customer ID, or deal ID</label>
                <input
                  value={query}
                  onChange={(e) => lookup(e.target.value)}
                  placeholder="Type at least 2 characters"
                  autoComplete="off"
                />
              </div>
              <div className="pick-list">
                {searching ? <p className="muted">Searching…</p> : null}
                {!searching && query.trim().length < 2 ? (
                  <p className="muted">Search to find an existing customer, or switch to Add new.</p>
                ) : null}
                {!searching && query.trim().length >= 2 && hits.length === 0 ? (
                  <p className="muted">No match. Switch to Add new if this is a first-time customer.</p>
                ) : null}
                {hits.map((c) => (
                  <button key={c.id} type="button" className="pick-row" onClick={() => setSelected(c)}>
                    <span>
                      {c.reference ? <span className="deal-id-line">{c.reference}</span> : null}
                      <b>{c.name}</b>
                      {c.company ? <span className="muted"> · {c.company}</span> : null}
                    </span>
                    <span className="muted">{c.email || c.phone || "No contact"}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
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
        </div>
        <AddressFields required={false} />
        </>
      )}
    </div>
  );
}
