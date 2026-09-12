import type { Status } from "@prisma/client";
import { STATUS_LABEL, statusClass } from "@/lib/labels";

export default function StatusBadge({ status }: { status: Status }) {
  return <span className={statusClass(status)}>{STATUS_LABEL[status]}</span>;
}
