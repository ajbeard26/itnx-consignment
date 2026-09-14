export const SESSION_COOKIE = "itnx_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const DEV_SECRET = "itnx-dev-secret";

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (value && value !== DEV_SECRET) return value;
  if (process.env.NODE_ENV === "production") return null;
  return value || DEV_SECRET;
}

export function authSecretReady() {
  return Boolean(secret());
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function secretsEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacHex(message: string, keyText: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyText),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return hex(sig);
}

export async function signSession() {
  const keyText = secret();
  if (!keyText) throw new Error("AUTH_SECRET must be set in production.");
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = String(exp);
  return `${payload}.${await hmacHex(payload, keyText)}`;
}

export async function verifySession(token: string | undefined) {
  const keyText = secret();
  if (!token || !keyText) return false;
  const i = token.indexOf(".");
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return secretsEqual(sig, await hmacHex(payload, keyText));
}

export function safeNextPath(value: FormDataEntryValue | string | null | undefined) {
  const path = String(value || "/dashboard");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/dashboard";
  if (path.startsWith("/login") || path === "/") return "/dashboard";
  return path;
}
