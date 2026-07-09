import type { Brand, RawProduct } from "../types.js";

/**
 * Абстракція джерела товарів — ключовий контракт архітектури.
 *
 * Решта застосунку (пайплайн, CMS, фронт) бачить тільки RawProduct[].
 * Додавання нового джерела = нова імплементація цього інтерфейсу,
 * жодних змін у пайплайні, API чи фронтенді.
 */
export interface ProductSource {
  readonly sourceType: "feed" | "instagram";
  /** Чи вміє це джерело обслужити цей бренд. */
  supports(brand: Brand): boolean;
  fetchProducts(brand: Brand): Promise<RawProduct[]>;
}
