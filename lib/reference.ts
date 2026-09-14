import { db } from "@/lib/db";

export const DEAL_ID_PREFIX = "CO-ITNX";
export const CUSTOMER_ID_PREFIX = "CU-ITNX";

export function formatDealId(year: number, seq: number) {
  return `${DEAL_ID_PREFIX}:${String(year).slice(-2)}-${String(seq).padStart(4, "0")}`;
}

export function formatCustomerId(year: number, seq: number) {
  return `${CUSTOMER_ID_PREFIX}:${String(year).slice(-2)}-${String(seq).padStart(4, "0")}`;
}

function searchNeedles(query: string, prefix: string) {
  const raw = String(query || "").trim();
  if (!raw) return [] as string[];
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  const tag = prefix.replace("-", "-?");
  const stripped = compact.replace(new RegExp(`^${tag}:?`), "");
  const needles = new Set<string>([raw, compact]);
  if (stripped && stripped !== compact) {
    needles.add(stripped);
    needles.add(`${prefix}:${stripped}`);
    needles.add(`${prefix}${stripped}`);
  }
  needles.add(compact.replace(/:/g, ""));
  return [...needles].filter((item) => item.length >= 2);
}

export function dealSearchNeedles(query: string) {
  return searchNeedles(query, DEAL_ID_PREFIX);
}

export function customerSearchNeedles(query: string) {
  return searchNeedles(query, CUSTOMER_ID_PREFIX);
}

async function sequenceForYear(year: number) {
  const prefix = `${DEAL_ID_PREFIX}:${String(year).slice(-2)}-`;
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const [count, latest] = await Promise.all([
    db.consignment.count({ where: { createdAt: { gte: start, lt: end } } }),
    db.consignment.findFirst({
      where: { reference: { startsWith: prefix } },
      orderBy: { reference: "desc" },
      select: { reference: true },
    }),
  ]);
  const fromLatest = latest ? Number(latest.reference.slice(prefix.length)) + 1 : 1;
  const seq = Math.max(count + 1, Number.isFinite(fromLatest) ? fromLatest : 1, 1);
  return seq;
}

export async function peekDealId(year = new Date().getFullYear()) {
  return formatDealId(year, await sequenceForYear(year));
}

export async function allocateDealId(year = new Date().getFullYear()) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const reference = formatDealId(year, (await sequenceForYear(year)) + attempt);
    const exists = await db.consignment.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) return reference;
  }
  throw new Error("Could not assign a deal ID. Try again.");
}

async function customerSequenceForYear(year: number) {
  const prefix = `${CUSTOMER_ID_PREFIX}:${String(year).slice(-2)}-`;
  const latest = await db.customer.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const fromLatest = latest ? Number(latest.reference.slice(prefix.length)) + 1 : 1;
  return Number.isFinite(fromLatest) && fromLatest > 0 ? fromLatest : 1;
}

export async function allocateCustomerId(year = new Date().getFullYear()) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const reference = formatCustomerId(year, (await customerSequenceForYear(year)) + attempt);
    const exists = await db.customer.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) return reference;
  }
  throw new Error("Could not assign a customer ID. Try again.");
}
