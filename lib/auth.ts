export const SESSION_COOKIE = "itnx_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  return process.env.AUTH_SECRET || "itnx-dev-secret";
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacHex(message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return hex(sig);
}

export async function signSession() {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = String(exp);
  return `${payload}.${await hmacHex(payload)}`;
}

export async function verifySession(token: string | undefined) {
  if (!token) return false;
  const i = token.indexOf(".");
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return equal(sig, await hmacHex(payload));
}

export function safeNextPath(value: FormDataEntryValue | string | null | undefined) {
  const path = String(value || "/dashboard");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/dashboard";
  if (path.startsWith("/login") || path === "/") return "/dashboard";
  return path;
}
