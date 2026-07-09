/**
 * Price normalization: sources write prices differently
 * ("1899.00", "1 200 UAH", "1200", "1,299.50 USD") — reduce everything to
 * minor units (integer) + ISO currency so no float ever floats around.
 */
export function parsePriceMinor(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw)
    .replace(/[^\d.,]/g, "")
    .replace(/\s/g, "");
  if (!s) return null;
  // "1,299.50" -> comma is a thousands separator; "1299,50" -> comma is decimal
  const normalized =
    s.includes(",") && s.includes(".")
      ? s.replace(/,/g, "")
      : s.replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Extract an ISO currency code from a string like "1200.00 UAH"; fall back to the brand default. */
export function parseCurrency(raw: string | undefined | null, fallback = "UAH"): string {
  const match = String(raw ?? "").match(/[A-Z]{3}/);
  return match ? match[0] : fallback;
}
