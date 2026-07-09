/**
 * Нормалізація цін: усі джерела пишуть по-різному
 * ("1899.00", "1 200 UAH", "1200", "1,299.50 USD") — зводимо до
 * мінорних одиниць (integer) + ISO-валюти, щоб ніде не плавали float.
 */
export function parsePriceMinor(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw)
    .replace(/[^\d.,]/g, "")
    .replace(/\s/g, "");
  if (!s) return null;
  // "1,299.50" → кома як роздільник тисяч; "1299,50" → кома як десяткова
  const normalized =
    s.includes(",") && s.includes(".")
      ? s.replace(/,/g, "")
      : s.replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Витягає ISO-код валюти з рядка типу "1200.00 UAH"; фолбек — дефолт бренду. */
export function parseCurrency(raw: string | undefined | null, fallback = "UAH"): string {
  const match = String(raw ?? "").match(/[A-Z]{3}/);
  return match ? match[0] : fallback;
}
