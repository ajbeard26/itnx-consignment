const PORTAL_URL = "https://co.itnx.tech";

export function appUrl() {
  const raw = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return PORTAL_URL;
    if (host === "localhost" || host === "127.0.0.1") return PORTAL_URL;
    if (host === "itnx.tech" || host === "www.itnx.tech") return PORTAL_URL;
    return `${url.protocol}//${url.host}`;
  } catch {
    return PORTAL_URL;
  }
}

export function infoUrl(token: string | null | undefined) {
  if (!token) return "";
  return `${appUrl()}/info/${token}`;
}

export function signUrl(token: string | null | undefined) {
  if (!token) return "";
  return `${appUrl()}/sign/${token}`;
}

export function portalHref(path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${appUrl()}${clean}`;
}
