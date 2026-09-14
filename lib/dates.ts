const TZ = "America/Detroit";

export function shortDate(value?: Date | string | null) {
  if (!value) return "—";
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function shortDateTime(value?: Date | string | null) {
  if (!value) return "—";
  const d = asDate(value);
  if (!d) return "—";
  const date = shortDate(d);
  const time = d.toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

export function dateInputValue(value?: Date | string | null) {
  if (!value) return "";
  const d = asDate(value);
  if (!d) return "";
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function parseDay(value: FormDataEntryValue | string | null | undefined) {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

export function todayInput(now = new Date()) {
  return dateInputValue(now);
}

export function monthStartInput(now = new Date()) {
  const today = todayInput(now);
  return today ? `${today.slice(0, 7)}-01` : "";
}

export function daysAgoInput(days: number, now = new Date()) {
  const d = parseDay(todayInput(now));
  if (!d) return "";
  d.setUTCDate(d.getUTCDate() - days);
  return dateInputValue(d);
}

export function dayStart(value?: string | null) {
  const m = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00-04:00`);
}

export function dayEnd(value?: string | null) {
  const m = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T23:59:59.999-04:00`);
}

function asDate(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
