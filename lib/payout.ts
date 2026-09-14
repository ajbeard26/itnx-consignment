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

const CHECK_TZ = "America/Detroit";

function civilDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHECK_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: n("year"), m: n("month"), d: n("day") };
}

export function nextCheckRun(now = new Date()) {
  return nextProcessDay(now);
}

export function nextProcessDay(now = new Date()) {
  const { y, m, d } = civilDate(now);
  if (d === 1 || d === 15) return { y, m, d };
  if (d < 15) return { y, m, d: 15 };
  if (m === 12) return { y: y + 1, m: 1, d: 1 };
  return { y, m: m + 1, d: 1 };
}

export function checkRunForSale(finalized?: Date | string | null) {
  const when = finalized ? new Date(finalized) : new Date();
  const { y, m, d } = civilDate(Number.isNaN(when.getTime()) ? new Date() : when);
  if (d < 15) return { y, m, d: 15 };
  if (m === 12) return { y: y + 1, m: 1, d: 1 };
  return { y, m: m + 1, d: 1 };
}

export function formatCheckRun(run: { y: number; m: number; d: number }) {
  return new Date(Date.UTC(run.y, run.m - 1, run.d, 12)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function nextCheckRunLabel(now = new Date()) {
  return formatCheckRun(nextProcessDay(now));
}

export function checkRunLabelForSale(finalized?: Date | string | null) {
  return formatCheckRun(checkRunForSale(finalized));
}

export function checkDateMdY(finalized?: Date | string | null) {
  const run = checkRunForSale(finalized);
  return `${String(run.m).padStart(2, "0")}/${String(run.d).padStart(2, "0")}/${run.y}`;
}
