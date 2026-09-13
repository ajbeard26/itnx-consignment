"use client";

import { useTransition } from "react";
import type { Status } from "@prisma/client";
import { STATUS_LABEL } from "@/lib/labels";
import { isArchivedStatus } from "@/lib/deals";
import { updateStatus } from "@/app/consignments/[id]/actions";

export default function DealStatusSelect({ id, status }: { id: string; status: Status }) {
  const [pending, start] = useTransition();

  return (
    <label className="status-picker">
      <span className="sr-only">Status</span>
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        className={isArchivedStatus(status) ? "archived" : undefined}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("status", e.target.value);
          start(async () => {
            await updateStatus(id, fd);
          });
        }}
      >
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
