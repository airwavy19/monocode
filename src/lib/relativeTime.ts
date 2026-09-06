/**
 * Compact and verbose relative time helpers. Used by the git history graph,
 * notes, and inbox surfaces. Each accepts an epoch timestamp (seconds — the
 * shape `git log --format=%ct` returns) or an ISO-8601 string.
 */

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function toMillis(value: number | string | Date): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") {
    // `git log` timestamps come back as seconds; JS Date expects millis.
    const ms = value < 1e12 ? value * 1000 : value;
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Verbose "2 hours ago" / "in 3 days" via `Intl.RelativeTimeFormat`. */
export function formatRelativeTime(
  value: number | string | Date,
  now: number = Date.now(),
  locale?: string,
): string {
  const then = toMillis(value);
  if (then === null) return "";
  const delta = Math.round((then - now) / 1000);
  const abs = Math.abs(delta);
  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [MIN, "second"],
    [MIN, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let value2 = delta;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  let amount = abs;
  for (const [step, next] of divisions) {
    unit = next;
    if (amount < step) break;
    value2 = Math.round(value2 / step);
    amount = Math.abs(value2);
  }
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      value2,
      unit,
    );
  } catch {
    return "";
  }
}

/** Compact form for cramped rows — "now", "5m", "3h", "2d", "3w", "5mo", "2y". */
export function formatRelativeTimeShort(
  value: number | string | Date,
  now: number = Date.now(),
): string {
  const then = toMillis(value);
  if (then === null) return "";
  const delta = then - now;
  const future = delta > 0;
  const abs = Math.abs(delta);
  const seconds = Math.round(abs / 1000);
  if (seconds < 30) return "now";
  let amount: number;
  let suffix: string;
  if (seconds < HOUR) {
    amount = Math.round(seconds / MIN);
    suffix = "m";
  } else if (seconds < DAY) {
    amount = Math.round(seconds / HOUR);
    suffix = "h";
  } else if (seconds < WEEK) {
    amount = Math.round(seconds / DAY);
    suffix = "d";
  } else if (seconds < MONTH) {
    amount = Math.round(seconds / WEEK);
    suffix = "w";
  } else if (seconds < YEAR) {
    amount = Math.round(seconds / MONTH);
    suffix = "mo";
  } else {
    amount = Math.round(seconds / YEAR);
    suffix = "y";
  }
  // Treat "future" timestamps as a clock-skew artifact and render the same
  // way the past form would — the row already orders newest-first.
  void future;
  return amount > 0 ? `${amount}${suffix}` : "now";
}
