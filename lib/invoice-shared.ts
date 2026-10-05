import type { InvoiceKind, InvoiceStatus } from "@prisma/client";

export const INVOICE_KINDS: InvoiceKind[] = [
  "SHIPPING",
  "HANDLING",
  "PACKAGING",
  "STORAGE",
  "PICKUP",
  "INSURANCE",
  "OTHER",
];

export const INVOICE_KIND_LABEL: Record<InvoiceKind, string> = {
  SHIPPING: "Shipping",
  HANDLING: "Handling",
  PACKAGING: "Packaging",
  STORAGE: "Storage",
  PICKUP: "Pickup / delivery",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Awaiting payment",
  PAID: "Paid",
  VOID: "Void",
  UNCOLLECTIBLE: "Uncollectible",
};

export function invoiceStatusClass(status: InvoiceStatus) {
  if (status === "PAID") return "badge badge-ok";
  if (status === "OPEN" || status === "UNCOLLECTIBLE") return "badge badge-warn";
  if (status === "DRAFT") return "badge badge-info";
  return "badge";
}

export function invoiceKind(value: string): InvoiceKind {
  return INVOICE_KINDS.includes(value as InvoiceKind) ? (value as InvoiceKind) : "OTHER";
}

export function clampInvoiceDays(value: unknown, fallback = 14) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(90, Math.max(1, Math.round(n)));
}

export function centsFromDollars(value: string) {
  const raw = value.trim().replace(/[$,\s]/g, "");
  if (!raw || !/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [dollars, coins = ""] = raw.split(".");
  const cents = Number(dollars) * 100 + Number(coins.padEnd(2, "0").slice(0, 2));
  if (!Number.isFinite(cents) || cents <= 0 || cents > 1_000_000_00) return null;
  return cents;
}

export type DraftLine = {
  kind: InvoiceKind;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  sort: number;
};

export function readInvoiceLines(fd: FormData): DraftLine[] {
  const kinds = fd.getAll("lineKind").map(String);
  const descriptions = fd.getAll("lineDescription").map(String);
  const qtys = fd.getAll("lineQty").map(String);
  const amounts = fd.getAll("lineAmount").map(String);
  const count = Math.max(kinds.length, descriptions.length, qtys.length, amounts.length);
  if (count > 30) throw new Error("An invoice can have up to 30 charges.");

  const lines: DraftLine[] = [];
  for (let i = 0; i < count; i++) {
    const description = (descriptions[i] || "").trim();
    const amountRaw = (amounts[i] || "").trim();
    if (!description && !amountRaw) continue;
    if (!description) throw new Error("Each charge needs a description.");
    if (description.length > 200) throw new Error("Charge descriptions must be 200 characters or less.");
    const quantity = Number(qtys[i] || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new Error("Quantity must be a whole number from 1 to 999.");
    }
    const unitAmountCents = centsFromDollars(amountRaw);
    if (unitAmountCents == null) throw new Error(`Enter a price greater than $0 for “${description}”.`);
    lines.push({
      kind: invoiceKind(kinds[i] || "OTHER"),
      description,
      quantity,
      unitAmountCents,
      amountCents: unitAmountCents * quantity,
      sort: lines.length,
    });
  }
  if (!lines.length) throw new Error("Add at least one charge.");
  const total = lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (total > 1_000_000_00) throw new Error("Invoice total must be $1,000,000 or less.");
  return lines;
}
