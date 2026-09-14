import { Method, Status } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { dayEnd, dayStart } from "@/lib/dates";

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

export function dealViewWhere(view: DealView): Prisma.ConsignmentWhereInput {
  if (view === "archived") return { status: { in: ["PAID", "COMPLETED"] } };
  if (view === "payout") {
    return { paid: false, status: { in: ["SOLD", "AWAITING_ACCEPTANCE", "ACCEPTED", "PAYOUT_DUE"] } };
  }
  if (view === "all") return {};
  return { NOT: { status: { in: ["PAID", "COMPLETED"] } } };
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

export const DATE_FILTERS = [
  { id: "opened", label: "Opened", field: "createdAt" },
  { id: "listed", label: "Listed", field: "listedAt" },
  { id: "signed", label: "Signed", field: "acceptedAt" },
  { id: "completed", label: "Completed", field: "completedAt" },
] as const;

export type DateFilter = (typeof DATE_FILTERS)[number]["id"];

export function dateFilter(value?: string | null, view: DealView = "active"): DateFilter {
  if (DATE_FILTERS.some((item) => item.id === value)) return value as DateFilter;
  if (view === "archived") return "completed";
  if (view === "payout") return "signed";
  return "opened";
}

export function dateFilterWhere(
  when: DateFilter,
  from?: string | null,
  to?: string | null
): Prisma.ConsignmentWhereInput {
  const start = dayStart(from);
  const end = dayEnd(to);
  if (!start && !end) return {};
  const field = DATE_FILTERS.find((item) => item.id === when)?.field || "createdAt";
  return {
    [field]: {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    },
  };
}

export function dateFilterOrder(when: DateFilter): Prisma.ConsignmentOrderByWithRelationInput {
  if (when === "listed") return { listedAt: { sort: "desc", nulls: "last" } };
  if (when === "signed") return { acceptedAt: { sort: "desc", nulls: "last" } };
  if (when === "completed") return { completedAt: { sort: "desc", nulls: "last" } };
  return { createdAt: "desc" };
}

export function statusWrite(status: Status, completedAt?: Date | null) {
  const archived = isArchivedStatus(status);
  return {
    status,
    paid: archived,
    completedAt: archived ? completedAt ?? new Date() : null,
  };
}
