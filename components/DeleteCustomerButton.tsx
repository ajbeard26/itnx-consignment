"use client";

import { deleteCustomer } from "@/app/customers/actions";

export default function DeleteCustomerButton({
  id,
  name,
  deals,
}: {
  id: string;
  name: string;
  deals: number;
}) {
  return (
    <form
      action={deleteCustomer.bind(null, id)}
      onSubmit={(e) => {
        const ok = window.confirm(
          deals
            ? `Delete ${name} and ${deals} consignment${deals === 1 ? "" : "s"}? This cannot be undone.`
            : `Delete ${name}? This cannot be undone.`
        );
        if (!ok) e.preventDefault();
      }}
    >
      <button className="button danger" type="submit">
        Delete customer
      </button>
    </form>
  );
}