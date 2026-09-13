import type { Method, Status } from "@prisma/client";

export const STATUS_LABEL: Record<Status, string> = {
  RECEIVED: "Received",
  LISTED: "Listed",
  SOLD: "Sold",
  AWAITING_ACCEPTANCE: "Awaiting acceptance",
  ACCEPTED: "Accepted",
  PAYOUT_DUE: "Payout due",
  PAID: "Paid",
  COMPLETED: "Completed",
};

export function statusClass(status: Status) {
  if (status === "PAID" || status === "COMPLETED") return "badge badge-ok";
  if (status === "PAYOUT_DUE" || status === "AWAITING_ACCEPTANCE") return "badge badge-warn";
  if (status === "SOLD" || status === "ACCEPTED") return "badge badge-info";
  return "badge";
}

export const CATEGORIES = [
  "Equipment",
  "Vehicle",
  "Electronics",
  "Tools",
  "Furniture",
  "Industrial",
  "Other",
];

export const CONDITIONS = ["New", "Like new", "Good", "Fair", "For parts"];

export const PLATFORMS = ["GovDeals", "eBay", "Facebook", "Direct sale", "Other"];

export const METHOD_LABEL: Record<Method, string> = {
  CHECK: "Check (mailed)",
  ACH: "ACH / bank",
  CASH: "Cash",
};

export const METHOD_HINT: Record<Method, string> = {
  CHECK: "We issue a check and mail it to the address on file.",
  ACH: "Bank transfer. Collect bank name and account last 4 only — never a full account number.",
  CASH: "Paid in person. No mailing address required.",
};

export const METHOD_OPTIONS: Method[] = ["CHECK", "ACH", "CASH"];

export function methodLabel(value?: string | null) {
  if (value === "ACH" || value === "CASH" || value === "CHECK") return METHOD_LABEL[value];
  return METHOD_LABEL.CHECK;
}
