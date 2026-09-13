"use client";

import { deleteConsignment } from "@/app/consignments/[id]/actions";

export default function DeleteConsignmentButton({
  id,
  title,
  reference,
}: {
  id: string;
  title: string;
  reference: string;
}) {
  return (
    <form
      action={deleteConsignment.bind(null, id)}
      onSubmit={(e) => {
        const ok = window.confirm(`Delete ${reference} (${title})? This cannot be undone.`);
        if (!ok) e.preventDefault();
      }}
    >
      <button className="account-danger" type="submit">
        Delete consignment
      </button>
    </form>
  );
}
