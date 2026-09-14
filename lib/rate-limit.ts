import { requestAudit } from "@/lib/request";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 400) return;
  for (const [key, row] of buckets) {
    if (row.resetAt < now) buckets.delete(key);
  }
}

export function allowAttempt(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  prune(now);
  const row = buckets.get(key);
  if (!row || row.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

export async function allowIp(scope: string, limit: number, windowMs: number) {
  const { ip } = await requestAudit();
  return allowAttempt(`${scope}:${ip || "unknown"}`, limit, windowMs);
}
