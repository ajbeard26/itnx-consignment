"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, X } from "lucide-react";
import { CATEGORIES, CONDITIONS } from "@/lib/labels";
import { updateItem } from "@/app/consignments/[id]/actions";

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

export default function DealItemCard({
  id,
  title,
  category,
  condition,
  serial,
  location,
  listingUrl,
  description,
  notes,
}: {
  id: string;
  title: string;
  category: string;
  condition: string;
  serial: string;
  location: string;
  listingUrl: string;
  description: string;
  notes: string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <form action={updateItem.bind(null, id)} className="account-stack">
      <SaveWatcher onSaved={() => setEditing(false)} />
      <section className="account-section">
        <div className="account-section-head">
          <h2>Item</h2>
          <button className="edit-btn" type="button" onClick={() => setEditing((v) => !v)}>
            {editing ? <X size={14} /> : <Pencil size={14} />}
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
        {editing ? (
          <>
            <div className="form">
              <div className="field full">
                <label>Title</label>
                <input name="title" required defaultValue={title} />
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
              <div className="field full">
                <label>Listing URL</label>
                <input name="listingUrl" inputMode="url" defaultValue={listingUrl} />
              </div>
              <div className="field full">
                <label>Description</label>
                <textarea name="description" rows={4} defaultValue={description} />
              </div>
              <div className="field full">
                <label>Internal notes</label>
                <textarea name="notes" rows={3} defaultValue={notes} />
              </div>
            </div>
            <div className="form-actions">
              <SaveButton />
            </div>
          </>
        ) : (
          <dl className="fact-grid">
            <div className="full">
              <dt>Title</dt>
              <dd>{dash(title)}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{dash(category)}</dd>
            </div>
            <div>
              <dt>Condition</dt>
              <dd>{dash(condition)}</dd>
            </div>
            <div>
              <dt>Serial / VIN</dt>
              <dd>{dash(serial)}</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>{dash(location)}</dd>
            </div>
            <div className="full">
              <dt>Listing</dt>
              <dd>
                {listingUrl ? (
                  <a className="text-link" href={listingUrl} target="_blank" rel="noreferrer">
                    Open listing
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {description ? (
              <div className="full">
                <dt>Description</dt>
                <dd className="pre">{description}</dd>
              </div>
            ) : null}
            {notes ? (
              <div className="full">
                <dt>Notes</dt>
                <dd className="pre">{notes}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </section>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save item"}
    </button>
  );
}
