import type { Brand, RawProduct } from "../types.js";
import type { ProductSource } from "./source.js";

/**
 * InstagramSource — Фаза 2, зараз лише контракт.
 *
 * Принципова позиція: жодного скрапінгу Instagram. Дані беруться ВИКЛЮЧНО
 * через Instagram Graph API для акаунтів, які бренд сам підключив через
 * OAuth (потік "claim your profile": бренд один раз тисне "підключити IG"
 * на сторінці /for-brands і дає нам токен).
 *
 * Вихід той самий — RawProduct[] → та сама нормалізація → та сама колекція
 * products із sourceType = "instagram". Пайплайн і фронт змін не потребують.
 */
export class InstagramSource implements ProductSource {
  readonly sourceType = "instagram" as const;

  supports(brand: Brand): boolean {
    return brand.sourceType === "instagram" && Boolean(brand.instagramHandle);
  }

  async fetchProducts(_brand: Brand): Promise<RawProduct[]> {
    throw new Error(
      "InstagramSource is Phase 2: waiting for brand-side OAuth (claim your profile). " +
        "No scraping fallback by design — Meta ToS.",
    );
  }
}

/**
 * TODO(Phase 2): пости IG не мають структурованої ціни/розміру.
 * Сюди піде парсинг підпису (ціна/розміри з тексту) і, опційно, OCR
 * по зображенню. Повертає часткові поля RawProduct.
 */
export function extractStructuredData(_post: unknown): Partial<RawProduct> {
  return {};
}
