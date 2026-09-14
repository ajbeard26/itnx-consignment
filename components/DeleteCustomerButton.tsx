"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteCustomer } from "@/app/customers/actions";

export default function DeleteCustomerButton({
  id,
  name,
  deals,
  variant = "button",
}: {
  id: string;
  name: string;
  deals: number;
  variant?: "button" | "nav";
}) {
  const [open, setOpen] = useState(false);
  const warn = deals
    ? `Delete ${name} and ${deals} consignment${deals === 1 ? "" : "s"}? This cannot be undone.`
    : `Delete ${name}? This cannot be undone.`;

  if (!open) {
    return (
      <button
        className={variant === "nav" ? "account-danger" : "button danger"}
        type="button"
        onClick={() => setOpen(true)}
      >
        {variant === "nav" ? <Trash2 size={15} /> : null}
        Delete
      </button>
    );
  }

  if (variant === "nav") {
    return (
      <form action={deleteCustomer.bind(null, id)} className="account-danger-box">
        <p>{warn}</p>
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

  return (
    <form action={deleteCustomer.bind(null, id)} className="account-danger-box wide">
      <p>{warn}</p>
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
