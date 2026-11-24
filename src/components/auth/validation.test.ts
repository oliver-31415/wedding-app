import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  isValidIsoDate,
  normalizeEmail,
  sanitizeNextPath,
  suggestWeddingSlug,
  validateSignupInput,
  validateWeddingDetailsInput,
  validateWeddingSlug,
} from "./validation";

describe("email helpers", () => {
  it("normalises whitespace and case", () => {
    expect(normalizeEmail("  Alex@Example.COM ")).toBe("alex@example.com");
  });

  it("validates email addresses", () => {
    expect(isValidEmail("alex@example.com")).toBe(true);
    expect(isValidEmail("alex+wedding@sub.example.com.au")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("alex@")).toBe(false);
    expect(isValidEmail("alex @example.com")).toBe(false);
  });
});

describe("sanitizeNextPath", () => {
  it("keeps safe internal paths", () => {
    expect(sanitizeNextPath("/invite/abc123")).toBe("/invite/abc123");
    expect(sanitizeNextPath("/admin/settings?tab=hosts")).toBe("/admin/settings?tab=hosts");
  });

  it("rejects protocol-relative, external, or malformed URLs", () => {
    expect(sanitizeNextPath(null)).toBeNull();
    expect(sanitizeNextPath("")).toBeNull();
    expect(sanitizeNextPath("https://evil.example")).toBeNull();
    expect(sanitizeNextPath("//evil.example/invite")).toBeNull();
    expect(sanitizeNextPath("/\\evil")).toBeNull();
    expect(sanitizeNextPath("/invite/foo\nbar")).toBeNull();
  });
});

describe("suggestWeddingSlug", () => {
  it("joins two partner names with 'and'", () => {
    expect(suggestWeddingSlug("Alex", "Sam")).toBe("alex-and-sam");
    expect(suggestWeddingSlug("Chloé", "O'Connor")).toBe("chloe-and-o-connor");
  });

  it("handles a single entered name or empty names", () => {
    expect(suggestWeddingSlug("Alex", "")).toBe("alex");
    expect(suggestWeddingSlug("", "Sam")).toBe("sam");
    expect(suggestWeddingSlug("", "")).toBe("");
  });
});

describe("validateWeddingSlug", () => {
  it("accepts valid slugs", () => {
    expect(validateWeddingSlug("alex-and-sam")).toBeNull();
    expect(validateWeddingSlug("a-b")).toBeNull();
    expect(validateWeddingSlug("wedding2027")).toBeNull();
  });

  it("enforces length, character set, and reserved slugs", () => {
    expect(validateWeddingSlug("")).toBeTruthy();
    expect(validateWeddingSlug("ab")).toContain("at least 3");
    expect(validateWeddingSlug("a".repeat(61))).toContain("under 60");
    expect(validateWeddingSlug("Alex-and-Sam")).toContain("lowercase");
    expect(validateWeddingSlug("alex_sam")).toContain("lowercase");
    expect(validateWeddingSlug("-alex-sam")).toContain("hyphen");
    expect(validateWeddingSlug("alex-sam-")).toContain("hyphen");
    for (const reserved of ["admin", "login", "signup", "api", "w"]) {
      expect(validateWeddingSlug(reserved)).toBeTruthy();
    }
  });
});

describe("isValidIsoDate", () => {
  it("accepts real calendar dates and rejects impossible ones", () => {
    expect(isValidIsoDate("2027-03-13")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2027-02-29")).toBe(false);
    expect(isValidIsoDate("2027-13-01")).toBe(false);
    expect(isValidIsoDate("13/03/2027")).toBe(false);
  });
});

describe("validateSignupInput", () => {
  it("returns field errors for missing or short values", () => {
    const errs = validateSignupInput({ name: null, email: "bad", password: "short" });
    expect(errs.name).toBeTruthy();
    expect(errs.email).toBeTruthy();
    expect(errs.password).toContain("10");
  });

  it("passes valid signup input", () => {
    expect(
      validateSignupInput({ name: "Alex", email: "alex@example.com", password: "long-enough-password" }),
    ).toEqual({});
  });
});

describe("validateWeddingDetailsInput", () => {
  it("checks required partner names, optional date, and optional slug check", () => {
    const errs = validateWeddingDetailsInput({
      partnerOne: null,
      partnerTwo: "Sam",
      date: "2027-02-30",
      slug: "admin",
      checkSlug: true,
    });
    expect(errs.partnerOne).toBeTruthy();
    expect(errs.partnerTwo).toBeUndefined();
    expect(errs.date).toBeTruthy();
    expect(errs.slug).toBeTruthy();
  });

  it("allows blank optional date", () => {
    expect(
      validateWeddingDetailsInput({
        partnerOne: "Alex",
        partnerTwo: "Sam",
        date: null,
        slug: "alex-and-sam",
        checkSlug: true,
      }),
    ).toEqual({});
  });
});
