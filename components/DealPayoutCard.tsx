"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, X } from "lucide-react";
import { METHOD_HINT, METHOD_LABEL, METHOD_OPTIONS, PLATFORMS, STATUS_LABEL, statusClass } from "@/lib/labels";
import { dollarsFromCents } from "@/lib/commission";
import { isArchivedStatus } from "@/lib/deals";
import { updatePayout } from "@/app/consignments/[id]/actions";
import { dateInputValue, shortDate } from "@/lib/dates";
import type { Method, Status } from "@prisma/client";

function SaveWatcher({ onSaved }: { onSaved: () => void }) {
  const { pending } = useFormStatus();
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending) onSaved();
    was.current = pending;
  }, [pending, onSaved]);
  return null;
}

export default function DealPayoutCard({
  id,
  status,
  platform,
  method,
  salePriceCents,
  askingPriceCents,
  completedAt,
}: {
  id: string;
  status: Status;
  platform: string;
  method: Method;
  salePriceCents: number;
  askingPriceCents: number;
  completedAt?: Date | string | null;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <form action={updatePayout.bind(null, id)} className="account-section">
      <SaveWatcher onSaved={() => setEditing(false)} />
      <div className="account-section-head">
        <h2>Sale</h2>
        <button className="edit-btn" type="button" onClick={() => setEditing((v) => !v)}>
          {editing ? <X size={14} /> : <Pencil size={14} />}
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {editing ? (
        <>
          <div className="form">
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
              <label>Sale</label>
              <input name="sale" inputMode="decimal" defaultValue={salePriceCents ? dollarsFromCents(salePriceCents) : ""} />
            </div>
            <div className="field">
              <label>Asking</label>
              <input name="asking" inputMode="decimal" defaultValue={askingPriceCents ? dollarsFromCents(askingPriceCents) : ""} />
            </div>
            <div className="field">
              <label>Date completed</label>
              <input name="completedAt" type="date" defaultValue={dateInputValue(completedAt)} />
            </div>
          </div>
          <div className="form-actions">
            <SaveButton />
          </div>
        </>
      ) : (
        <dl className="fact-grid">
          <div>
            <dt>Status</dt>
            <dd>
              <span className={statusClass(status)}>{STATUS_LABEL[status]}</span>
            </dd>
          </div>
          <div>
            <dt>Platform</dt>
            <dd>{platform || "—"}</dd>
          </div>
          <div>
            <dt>Payout method</dt>
            <dd>{METHOD_LABEL[method]}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{shortDate(completedAt)}</dd>
          </div>
        </dl>
      )}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save payout"}
    </button>
  );
}
