import { Method, Status } from "@prisma/client";

export const DEAL_VIEWS = [
  { id: "active", label: "Active" },
  { id: "payout", label: "To pay" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
] as const;

export type DealView = (typeof DEAL_VIEWS)[number]["id"];

export function dealView(value?: string | null): DealView {
  return DEAL_VIEWS.some((view) => view.id === value) ? (value as DealView) : "active";
}

export function isArchivedStatus(status: Status) {
  return status === "PAID" || status === "COMPLETED";
}

export function needsPayout(status: Status, paid: boolean) {
  if (paid || isArchivedStatus(status)) return false;
  return status === "SOLD" || status === "AWAITING_ACCEPTANCE" || status === "ACCEPTED" || status === "PAYOUT_DUE";
}

export function matchesDealView(view: DealView, status: Status, paid: boolean) {
  if (view === "all") return true;
  if (view === "archived") return isArchivedStatus(status);
  if (view === "payout") return needsPayout(status, paid);
  return !isArchivedStatus(status);
}

export function parseStatus(value: FormDataEntryValue | null, fallback: Status = Status.RECEIVED): Status {
  const status = String(value || fallback);
  if ((Object.values(Status) as string[]).includes(status)) return status as Status;
  return fallback;
}

export function parseMethod(value: FormDataEntryValue | null, fallback: Method = Method.CHECK): Method {
  const method = String(value || fallback);
  if (method === Method.CASH || method === Method.ACH || method === Method.CHECK) return method;
  return fallback;
}

export function statusWrite(status: Status) {
  return {
    status,
    paid: isArchivedStatus(status),
  };
}
