export function digits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function last10(value: string) {
  return digits(value).slice(-10);
}

export function toE164(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const d = digits(raw);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (raw.startsWith("+") && d.length >= 10 && d.length <= 15) return `+${d}`;
  return null;
}

export function prettyPhone(value: string | null | undefined) {
  const d = last10(String(value || ""));
  if (d.length !== 10) return value || "";
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}