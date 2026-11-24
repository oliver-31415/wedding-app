/** Money is stored as integer cents. */

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Largest amount accepted anywhere: $10 million. */
export const MAX_CENTS = 1_000_000_000;

/** "$1,250.50" / "A$50" / "£50" / ".50" / "1250" → cents. Null for empty input, NaN for junk or absurd amounts. */
export function parseMoney(input: string | null | undefined): number | null {
  const cleaned = (input ?? "").replace(/[\s,]/g, "").replace(/^(?:[A-Z]{1,3})?[$£€¥]/, "").replace(/^[A-Z]{3}(?=[\d.])/, "");
  if (cleaned === "") return null;
  if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(cleaned)) return NaN;
  const [whole, frac = ""] = cleaned.split(".");
  const cents = Number(whole || "0") * 100 + Number(frac.padEnd(2, "0"));
  return cents > MAX_CENTS ? NaN : cents;
}
