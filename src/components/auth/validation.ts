import { slugify } from "@/lib/forms";

export const MIN_PASSWORD_LENGTH = 10;

export const RESERVED_SLUGS = new Set([
  "admin",
  "login",
  "signup",
  "api",
  "w",
  "onboarding",
  "invite",
  "logout",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_CHARS_RE = /^[a-z0-9-]+$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}

/**
 * Only allow relative in-app paths (starting with a single `/`) so open
 * redirects are impossible.
 */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) return null;
  if (/[\r\n]/.test(trimmed)) return null;
  return trimmed;
}

export function suggestWeddingSlug(partnerOne: string, partnerTwo: string): string {
  const one = partnerOne.trim();
  const two = partnerTwo.trim();
  if (one && two) return slugify(`${one} and ${two}`);
  return slugify(one || two);
}

/** Returns an error message when invalid, or null when valid. */
export function validateWeddingSlug(raw: string | null): string | null {
  const value = (raw ?? "").trim();
  if (!value) return "Enter a web address for your wedding site.";
  if (value.length < 3) return "Use at least 3 characters.";
  if (value.length > 60) return "Keep the web address under 60 characters.";
  if (!SLUG_CHARS_RE.test(value)) return "Use lowercase letters, numbers and hyphens only.";
  if (value.startsWith("-") || value.endsWith("-")) return "Web addresses can't start or end with a hyphen.";
  if (RESERVED_SLUGS.has(value)) return "That web address is reserved. Choose another one.";
  return null;
}

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function validateSignupInput(input: {
  name: string | null;
  email: string | null;
  password: string | null;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name) errors.name = "Enter your name.";
  if (!input.email) errors.email = "Enter your email address.";
  else if (!isValidEmail(input.email)) errors.email = "Enter a valid email address.";
  if (!input.password) errors.password = "Enter a password.";
  else if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return errors;
}

export function validateWeddingDetailsInput(input: {
  partnerOne: string | null;
  partnerTwo: string | null;
  date: string | null;
  slug?: string | null;
  checkSlug?: boolean;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.partnerOne) errors.partnerOne = "Enter the first partner's name.";
  if (!input.partnerTwo) errors.partnerTwo = "Enter the second partner's name.";
  if (input.date && !isValidIsoDate(input.date)) errors.date = "Enter a valid date.";
  if (input.checkSlug) {
    const slugError = validateWeddingSlug(input.slug ?? null);
    if (slugError) errors.slug = slugError;
  }
  return errors;
}
