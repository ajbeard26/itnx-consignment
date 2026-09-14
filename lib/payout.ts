import type { Method } from "@prisma/client";

export type ConsignorMailing = {
  name: string;
  payoutName?: string | null;
  checkPayableTo?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  address?: string | null;
  payoutAddress?: string | null;
  payoutCity?: string | null;
  payoutState?: string | null;
  payoutZip?: string | null;
  bankName?: string | null;
  accountLast4?: string | null;
};

export function payableTo(c: ConsignorMailing) {
  return (c.checkPayableTo || c.payoutName || c.name).trim();
}

export function mailingParts(c: ConsignorMailing) {
  return {
    street: (c.payoutAddress || c.street || "").trim(),
    city: (c.payoutCity || c.city || "").trim(),
    state: (c.payoutState || c.state || "").trim(),
    zip: (c.payoutZip || c.zip || "").trim(),
    fallback: (c.address || "").trim(),
  };
}

export function mailingLines(c: ConsignorMailing) {
  const { street, city, state, zip, fallback } = mailingParts(c);
  const locality = [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : "");
  const lines = [street, locality.trim()].filter(Boolean);
  if (lines.length) return lines;
  return fallback ? [fallback] : [];
}

export function mailingReady(c: ConsignorMailing) {
  const { street, city, state, zip, fallback } = mailingParts(c);
  return Boolean((street && city && state && zip) || fallback);
}

export function bankLine(c: ConsignorMailing) {
  if (c.bankName && c.accountLast4) return `${c.bankName} · ••••${c.accountLast4}`;
  if (c.bankName) return c.bankName;
  if (c.accountLast4) return `••••${c.accountLast4}`;
  return "";
}

export function payoutReadyFor(method: Method, c: ConsignorMailing) {
  if (method === "CHECK") return Boolean(payableTo(c) && mailingReady(c));
  if (method === "ACH") return Boolean(bankLine(c));
  return Boolean(payableTo(c));
}
