export function publicError(error: unknown, fallback = "Something went wrong.") {
  const raw = error instanceof Error ? error.message : fallback;
  if (/auth|invalid login|535|password/i.test(raw)) return "Login failed. Check the username and password.";
  if (/enotfound|econnrefused|timeout|connect/i.test(raw)) return "Could not reach that host. Check the server name and port.";
  return raw
    .replace(/pass(word)?[=:]\s*\S+/gi, "password=[redacted]")
    .replace(/\bKEY[A-Za-z0-9_-]{10,}\b/g, "[redacted]")
    .replace(/\bAIza[A-Za-z0-9_-]+\b/g, "[redacted]")
    .slice(0, 180) || fallback;
}

export function validSmtpHost(value: string) {
  const host = value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  if (!host || host.length > 253) return "";
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$|^localhost$/i.test(host)) return "";
  return host;
}

export function validSmtpPort(value: FormDataEntryValue | null) {
  const port = Number(value || 587);
  if (!Number.isFinite(port) || port < 1 || port > 65535) return 587;
  return Math.round(port);
}

export function validEmailAddress(value: string) {
  const email = value.trim();
  if (email.length > 254) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

export function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function safeListingUrl(value: FormDataEntryValue | string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return safeHttpUrl(raw) || null;
}

export function limitText(value: string, max = 20000) {
  return value.length > max ? value.slice(0, max) : value;
}
