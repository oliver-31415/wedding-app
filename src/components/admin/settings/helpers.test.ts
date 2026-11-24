import { describe, expect, it } from "vitest";
import {
  COHOST_INVITE_DAYS,
  cohostInviteExpiry,
  currencyOptions,
  getPublishWarnings,
  isAllowedCurrency,
  isAllowedTimeZone,
  isInviteActive,
  timeZoneOptions,
} from "./helpers";

describe("timeZoneOptions and currencyOptions", () => {
  it("preserves a custom current time zone when not in the standard list", () => {
    const standard = timeZoneOptions("Australia/Sydney");
    expect(standard.some((o) => o.value === "Australia/Sydney")).toBe(true);
    expect(standard.length).toBe(12);

    const custom = timeZoneOptions("Asia/Tokyo");
    expect(custom[0]).toEqual({ value: "Asia/Tokyo", label: "Asia/Tokyo" });
    expect(custom.length).toBe(13);
    expect(isAllowedTimeZone("Asia/Tokyo", "Asia/Tokyo")).toBe(true);
    expect(isAllowedTimeZone("Mars/Olympus", "Australia/Sydney")).toBe(false);
  });

  it("supports standard currencies and keeps existing currency", () => {
    expect(currencyOptions("AUD").length).toBe(7);
    expect(currencyOptions("JPY")[0].value).toBe("JPY");
    expect(isAllowedCurrency("NZD", "AUD")).toBe(true);
    expect(isAllowedCurrency("XXX", "AUD")).toBe(false);
  });
});

describe("getPublishWarnings", () => {
  it("warns when no pages exist", () => {
    const warnings = getPublishWarnings({ pageTypes: [], rsvpEventCount: 0 });
    expect(warnings.map((w) => w.id)).toEqual(["no_pages"]);
  });

  it("warns when RSVP page exists without RSVP-enabled events", () => {
    const warnings = getPublishWarnings({ pageTypes: ["home", "rsvp"], rsvpEventCount: 0 });
    expect(warnings.map((w) => w.id)).toEqual(["rsvp_without_events"]);
  });

  it("returns no warnings when pages and RSVP events are ready", () => {
    expect(getPublishWarnings({ pageTypes: ["home", "rsvp"], rsvpEventCount: 2 })).toEqual([]);
    expect(getPublishWarnings({ pageTypes: ["home", "schedule"], rsvpEventCount: 0 })).toEqual([]);
  });
});

describe("co-host invite expiry", () => {
  it("sets expiry 7 days ahead and checks activity", () => {
    const now = Date.UTC(2026, 10, 24, 12, 0, 0);
    const exp = cohostInviteExpiry(now);
    expect(exp.getTime() - now).toBe(COHOST_INVITE_DAYS * 86_400_000);
    expect(isInviteActive(exp, now)).toBe(true);
    expect(isInviteActive(exp, exp.getTime())).toBe(false);
    expect(isInviteActive(exp, exp.getTime() + 1000)).toBe(false);
  });
});
