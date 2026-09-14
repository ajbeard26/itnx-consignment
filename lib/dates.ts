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

function asDate(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
