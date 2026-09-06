import { describe, expect, it } from "vitest";
import { formatRelativeTime, formatRelativeTimeShort } from "./relativeTime";

const NOW = Date.UTC(2026, 8, 6, 12, 0, 0); // 2026-09-06T12:00:00Z

describe("formatRelativeTimeShort", () => {
  it("returns 'now' for sub-30-second deltas", () => {
    expect(formatRelativeTimeShort(NOW / 1000, NOW)).toBe("now");
    expect(formatRelativeTimeShort(NOW / 1000 - 25, NOW)).toBe("now");
  });

  it("collapses seconds to minutes", () => {
    expect(formatRelativeTimeShort(NOW / 1000 - 5 * 60, NOW)).toBe("5m");
    expect(formatRelativeTimeShort(NOW / 1000 - 59 * 60, NOW)).toBe("59m");
  });

  it("collapses minutes to hours", () => {
    expect(formatRelativeTimeShort(NOW / 1000 - 60 * 60, NOW)).toBe("1h");
    expect(formatRelativeTimeShort(NOW / 1000 - 23 * 60 * 60, NOW)).toBe("23h");
  });

  it("collapses hours to days", () => {
    expect(formatRelativeTimeShort(NOW / 1000 - 24 * 60 * 60, NOW)).toBe("1d");
    expect(formatRelativeTimeShort(NOW / 1000 - 6 * 24 * 60 * 60, NOW)).toBe(
      "6d",
    );
  });

  it("collapses days to weeks", () => {
    expect(formatRelativeTimeShort(NOW / 1000 - 7 * 24 * 60 * 60, NOW)).toBe(
      "1w",
    );
    expect(
      formatRelativeTimeShort(NOW / 1000 - 29 * 24 * 60 * 60, NOW),
    ).toBe("4w");
  });

  it("collapses weeks to months", () => {
    expect(
      formatRelativeTimeShort(NOW / 1000 - 30 * 24 * 60 * 60, NOW),
    ).toBe("1mo");
    expect(
      formatRelativeTimeShort(NOW / 1000 - 364 * 24 * 60 * 60, NOW),
    ).toBe("12mo");
  });

  it("collapses months to years", () => {
    expect(
      formatRelativeTimeShort(NOW / 1000 - 365 * 24 * 60 * 60, NOW),
    ).toBe("1y");
    expect(
      formatRelativeTimeShort(NOW / 1000 - 5 * 365 * 24 * 60 * 60, NOW),
    ).toBe("5y");
  });

  it("accepts unix-millisecond timestamps from JS Date", () => {
    const ms = NOW - 3 * 60 * 60 * 1000;
    expect(formatRelativeTimeShort(ms, NOW)).toBe("3h");
  });

  it("accepts ISO strings", () => {
    const iso = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTimeShort(iso, NOW)).toBe("2d");
  });

  it("returns empty string for invalid input", () => {
    expect(formatRelativeTimeShort(NaN, NOW)).toBe("");
    expect(formatRelativeTimeShort("not-a-date", NOW)).toBe("");
  });
});

describe("formatRelativeTime", () => {
  it("renders a verbose 'X ago' label via Intl", () => {
    expect(formatRelativeTime(NOW / 1000 - 5 * 60, NOW)).toBe("5 minutes ago");
    expect(formatRelativeTime(NOW / 1000 - 2 * 24 * 60 * 60, NOW)).toBe(
      "2 days ago",
    );
  });

  it("returns empty string for invalid input", () => {
    expect(formatRelativeTime(NaN, NOW)).toBe("");
  });
});
