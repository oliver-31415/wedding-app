import { describe, expect, it } from "vitest";
import { resolveSafeNext } from "./safe-next";

describe("resolveSafeNext", () => {
  const fallback = "/w/alex-and-sam";

  it("allows valid same-site paths", () => {
    expect(resolveSafeNext("alex-and-sam", "/w/alex-and-sam", fallback)).toBe("/w/alex-and-sam");
    expect(resolveSafeNext("alex-and-sam", "/w/alex-and-sam/rsvp", fallback)).toBe("/w/alex-and-sam/rsvp");
    expect(resolveSafeNext("alex-and-sam", "/w/alex-and-sam/schedule?view=day#ceremony", fallback)).toBe(
      "/w/alex-and-sam/schedule?view=day#ceremony",
    );
  });

  it("rejects external, protocol-relative, other-wedding and traversal targets", () => {
    expect(resolveSafeNext("alex-and-sam", null, fallback)).toBe(fallback);
    expect(resolveSafeNext("alex-and-sam", "", fallback)).toBe(fallback);
    expect(resolveSafeNext("alex-and-sam", "https://evil.example/w/alex-and-sam", fallback)).toBe(fallback);
    expect(resolveSafeNext("alex-and-sam", "//evil.example/w/alex-and-sam", fallback)).toBe(fallback);
    expect(resolveSafeNext("alex-and-sam", "/w/alex-and-sam-evil/rsvp", fallback)).toBe(fallback);
    expect(resolveSafeNext("alex-and-sam", "/w/other-wedding/rsvp", fallback)).toBe(fallback);
    expect(resolveSafeNext("alex-and-sam", "/w/alex-and-sam/../admin", fallback)).toBe(fallback);
    expect(resolveSafeNext("alex-and-sam", "/admin/guests", fallback)).toBe(fallback);
    expect(resolveSafeNext("alex-and-sam", "/w/alex-and-sam\\evil", fallback)).toBe(fallback);
  });
});
