"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="account-danger" type="button" onClick={() => setOpen(true)}>
        <Trash2 size={15} />
        Delete
      </button>
    );
  }

  return (
    <form action={deleteConsignment.bind(null, id)} className="account-danger-box">
      <p>
        Delete <b>{reference}</b>
        {title ? ` · ${title}` : ""}? This cannot be undone.
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
