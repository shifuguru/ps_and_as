const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Device-local wall clock — avoids RN/Hermes toLocaleString UTC quirks. */
function formatLocalManual(d: Date): string {
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours24 >= 12 ? "PM" : "AM";
  return `${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${hours12}:${minutes} ${ampm}`;
}

/**
 * Format an ISO-8601 UTC instant in the device local timezone.
 * Changelog entries should be stored as UTC (…Z); this converts for display.
 */
export function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
        timeZoneName: "short",
      }).format(d);
    }
  } catch {
    // Intl unavailable — use manual local getters below.
  }

  return formatLocalManual(d);
}

const CHANGELOG_TIMEZONE = "Pacific/Auckland";

/** What's New / known-issues timestamps — always shown in NZ time (NZST/NZDT). */
export function formatUpdateTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: CHANGELOG_TIMEZONE,
      timeZoneName: "short",
    }).format(d);
  } catch {
    return formatLocalManual(d);
  }
}
