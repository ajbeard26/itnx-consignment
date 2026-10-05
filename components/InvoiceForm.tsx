"use client";

import { useState } from "react";
import Link from "next/link";
import type { InvoiceKind } from "@prisma/client";
import { searchCustomers } from "@/app/consignments/new/actions";
import { customerDeals } from "@/app/invoices/actions";
import { dollarsFromCents } from "@/lib/commission";
import { money } from "@/lib/money";
import { INVOICE_KIND_LABEL, INVOICE_KINDS, centsFromDollars } from "@/lib/invoice-shared";

type CustomerOption = {
  id: string;
  reference: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
};

type DealOption = { id: string; reference: string; title: string };

type LineDraft = { kind: InvoiceKind; description: string; quantity: string; amount: string };

const QUICK: InvoiceKind[] = ["SHIPPING", "HANDLING", "PACKAGING", "STORAGE", "PICKUP", "INSURANCE", "OTHER"];

function blank(kind: InvoiceKind = "SHIPPING"): LineDraft {
  return { kind, description: INVOICE_KIND_LABEL[kind], quantity: "1", amount: "" };
}

export default function InvoiceForm({
  action,
  invoiceId,
  customer,
  lockCustomer = false,
  deals,
  consignmentId,
  memo,
  daysUntilDue,
  lines,
  submitLabel,
  cancelHref,
}: {
  action: (fd: FormData) => void;
  invoiceId?: string;
  customer: CustomerOption | null;
  lockCustomer?: boolean;
  deals: DealOption[];
  consignmentId?: string;
  memo?: string;
  daysUntilDue: number;
  lines?: { kind: InvoiceKind; description: string; quantity: number; unitAmountCents: number }[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [picked, setPicked] = useState<CustomerOption | null>(customer);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [dealOptions, setDealOptions] = useState(deals);
  const [dealId, setDealId] = useState(consignmentId || "");
  const [formError, setFormError] = useState("");
  const [rows, setRows] = useState<LineDraft[]>(
    lines?.length
      ? lines.map((line) => ({
          kind: line.kind,
          description: line.description,
          quantity: String(line.quantity),
          amount: dollarsFromCents(line.unitAmountCents),
        }))
      : [blank("SHIPPING"), blank("HANDLING")]
  );

  async function lookup(value: string) {
    setQuery(value);
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      setHits(
        (await searchCustomers(q)).map((hit) => ({
          id: hit.id,
          reference: hit.reference,
          name: hit.name,
          email: hit.email || hit.payoutEmail,
          phone: hit.phone,
          company: hit.company,
        }))
      );
    } finally {
      setSearching(false);
    }
  }

  async function choose(option: CustomerOption) {
    setPicked(option);
    setHits([]);
    setQuery("");
    setDealId("");
    setDealOptions(await customerDeals(option.id));
  }

  function patch(index: number, next: Partial<LineDraft>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...next } : row)));
  }

  function add(kind: InvoiceKind) {
    setRows((current) => [...current, blank(kind)]);
  }

  function remove(index: number) {
    setRows((current) => (current.length === 1 ? [blank(current[0].kind)] : current.filter((_, i) => i !== index)));
  }

  const total = rows.reduce((sum, row) => {
    const qty = Number(row.quantity);
    const cents = centsFromDollars(row.amount);
    if (!cents || !Number.isInteger(qty) || qty < 1) return sum;
    return sum + cents * qty;
  }, 0);

  return (
    <form
      action={action}
      className="card panel"
      onSubmit={(event) => {
        if (!picked) {
          event.preventDefault();
          setFormError("Choose a customer.");
        }
      }}
    >
      {invoiceId ? <input type="hidden" name="id" value={invoiceId} /> : null}
      <h2>{invoiceId ? "Edit draft" : "New invoice"}</h2>
      <p className="muted">Charge for shipping, handling, packaging, storage, or any other service. Save a draft, then send it through Stripe.</p>
      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="form">
        <div className="field full">
          <label>Customer</label>
          {picked ? <input type="hidden" name="customerId" value={picked.id} /> : null}
          {picked ? (
            <div className="picked">
              <div>
                {picked.reference ? <div className="deal-id-line">{picked.reference}</div> : null}
                <b>{picked.name}</b>
                <div className="muted">
                  {[picked.company, picked.email, picked.phone].filter(Boolean).join(" · ") || "No contact on file"}
                </div>
                {picked.email ? null : (
                  <div className="form-error">Add an email on this customer before you send the invoice. You can still save a draft.</div>
                )}
              </div>
              {lockCustomer ? null : (
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => {
                    setPicked(null);
                    setDealOptions([]);
                    setDealId("");
                  }}
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <>
              <input value={query} onChange={(event) => lookup(event.target.value)} placeholder="Search name, email, phone, or customer ID" />
              <div className="pick-list">
                {searching ? <p className="muted">Searching…</p> : null}
                {!searching && query.trim().length >= 2 && hits.length === 0 ? <p className="muted">No matching customer.</p> : null}
                {hits.map((hit) => (
                  <button key={hit.id} type="button" className="pick-row" onClick={() => choose(hit)}>
                    <span>
                      {hit.reference ? <span className="deal-id-line">{hit.reference}</span> : null}
                      <b>{hit.name}</b>
                    </span>
                    <span className="muted">{[hit.email, hit.phone].filter(Boolean).join(" · ") || "No contact"}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="field">
          <label>Consignment</label>
          <select name="consignmentId" value={dealId} onChange={(event) => setDealId(event.target.value)} disabled={!picked}>
            <option value="">Not tied to a deal</option>
            {dealOptions.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.reference} · {deal.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Days until due</label>
          <input name="daysUntilDue" type="number" min={1} max={90} defaultValue={daysUntilDue} required />
        </div>
        <div className="field full">
          <label>Memo</label>
          <textarea name="memo" rows={2} maxLength={500} defaultValue={memo || ""} placeholder="Shown on the Stripe invoice" />
        </div>
      </div>

      <div className="invoice-lines">
        <div className="invoice-line-head">
          <h3>Charges</h3>
          <div className="invoice-quick">
            {QUICK.map((kind) => (
              <button key={kind} type="button" className="button ghost" onClick={() => add(kind)}>
                + {INVOICE_KIND_LABEL[kind]}
              </button>
            ))}
          </div>
        </div>
        {rows.map((row, index) => (
          <div className="invoice-line" key={index}>
            <div className="field">
              <label>Service</label>
              <select
                name="lineKind"
                value={row.kind}
                onChange={(event) => {
                  const kind = event.target.value as InvoiceKind;
                  patch(index, {
                    kind,
                    description: row.description === INVOICE_KIND_LABEL[row.kind] ? INVOICE_KIND_LABEL[kind] : row.description,
                  });
                }}
              >
                {INVOICE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {INVOICE_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field desc">
              <label>Description</label>
              <input
                name="lineDescription"
                value={row.description}
                maxLength={200}
                onChange={(event) => patch(index, { description: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Qty</label>
              <input
                name="lineQty"
                inputMode="numeric"
                value={row.quantity}
                onChange={(event) => patch(index, { quantity: event.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
              />
            </div>
            <div className="field">
              <label>Each</label>
              <input
                name="lineAmount"
                inputMode="decimal"
                placeholder="0.00"
                value={row.amount}
                onChange={(event) => patch(index, { amount: event.target.value })}
              />
            </div>
            <button type="button" className="button ghost invoice-remove" onClick={() => remove(index)} aria-label="Remove charge">
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="summary invoice-total">
        <div className="row big">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </div>

      <div className="form-actions">
        <button className="button" type="submit">
          {submitLabel}
        </button>
        <Link className="button ghost" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
