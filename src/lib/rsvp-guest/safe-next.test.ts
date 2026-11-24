import { describe, expect, it } from "vitest";
import { resolveSafeNext } from "./safe-next";

describe("resolveSafeNext", () => {
  const fallback = "/w/alex-and-sam";

  it("allows valid same-site paths", () => {
    expect(resolveSafeNext("/w/alex-and-sam", "/w/alex-and-sam", fallback)).toBe("/w/alex-and-sam");
    expect(resolveSafeNext("/w/alex-and-sam", "/w/alex-and-sam/rsvp", fallback)).toBe("/w/alex-and-sam/rsvp");
    expect(resolveSafeNext("/w/alex-and-sam", "/w/alex-and-sam/schedule?view=day#ceremony", fallback)).toBe(
      "/w/alex-and-sam/schedule?view=day#ceremony",
    );
  });

  it("rejects external, protocol-relative, other-wedding and traversal targets", () => {
    expect(resolveSafeNext("/w/alex-and-sam", null, fallback)).toBe(fallback);
    expect(resolveSafeNext("/w/alex-and-sam", "", fallback)).toBe(fallback);
    expect(resolveSafeNext("/w/alex-and-sam", "https://evil.example/w/alex-and-sam", fallback)).toBe(fallback);
    expect(resolveSafeNext("/w/alex-and-sam", "//evil.example/w/alex-and-sam", fallback)).toBe(fallback);
    expect(resolveSafeNext("/w/alex-and-sam", "/w/alex-and-sam-evil/rsvp", fallback)).toBe(fallback);
    expect(resolveSafeNext("/w/alex-and-sam", "/w/other-wedding/rsvp", fallback)).toBe(fallback);
    expect(resolveSafeNext("/w/alex-and-sam", "/w/alex-and-sam/../admin", fallback)).toBe(fallback);
    expect(resolveSafeNext("/w/alex-and-sam", "/admin/guests", fallback)).toBe(fallback);
    expect(resolveSafeNext("/w/alex-and-sam", "/w/alex-and-sam\\evil", fallback)).toBe(fallback);
  });

  it("allows any same-origin path when the wedding is served at the root", () => {
    expect(resolveSafeNext("", "/rsvp?step=2", "/")).toBe("/rsvp?step=2");
    expect(resolveSafeNext("", "/", "/find")).toBe("/");
    expect(resolveSafeNext("", "//evil.example", "/")).toBe("/");
    expect(resolveSafeNext("", "https://evil.example", "/")).toBe("/");
    expect(resolveSafeNext("", "/rsvp/../../x", "/")).toBe("/");
  });
});
