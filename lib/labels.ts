import type { Status } from "@prisma/client";

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
