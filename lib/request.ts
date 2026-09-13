import { headers } from "next/headers";

export type RequestAudit = {
  ip: string | null;
  forwarded: string | null;
  userAgent: string | null;
  country: string | null;
};

export async function requestAudit(): Promise<RequestAudit> {
  const h = await headers();
  const forwarded = (h.get("x-forwarded-for") || "").trim();
  const ip = (
    h.get("cf-connecting-ip") ||
    h.get("true-client-ip") ||
    h.get("x-real-ip") ||
    forwarded.split(",")[0] ||
    h.get("x-client-ip") ||
    ""
  )
    .trim()
    .slice(0, 120);
  const country = (h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || "").trim().toUpperCase();
  return {
    ip: ip || null,
    forwarded: forwarded.slice(0, 400) || null,
    userAgent: (h.get("user-agent") || "").slice(0, 500) || null,
    country: country && country !== "XX" ? country.slice(0, 8) : null,
  };
}
