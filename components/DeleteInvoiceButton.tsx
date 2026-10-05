"use client";

import { useState } from "react";
import { deleteInvoice } from "@/app/invoices/actions";

export default function DeleteInvoiceButton({
  id,
  reference,
  keptInStripe = false,
}: {
  id: string;
  reference: string;
  keptInStripe?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="button danger" type="button" onClick={() => setOpen(true)}>
        Delete invoice
      </button>
    );
  }

  return (
    <form action={deleteInvoice} className="invoice-delete">
      <input type="hidden" name="id" value={id} />
      <p>
        Delete <b>{reference}</b> from ITNX? This cannot be undone.
        {keptInStripe ? " Stripe still keeps the voided invoice." : ""}
      </p>
      <div className="account-danger-actions">
        <button className="button ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="button danger" type="submit">
          Delete
        </button>
      </div>
    </form>
  );
}
