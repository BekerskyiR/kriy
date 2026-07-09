import type { CategoryMappingRule } from "./types.js";

/**
 * Мапінг сирих категорій джерела → наша єдина таксономія.
 *
 * Пріоритет: бренд-специфічне правило > глобальне правило > null.
 * Ключі нормалізуються (lowercase + trim), щоб "T-Shirts" і "t-shirts"
 * були одним правилом.
 */
export class CategoryMapper {
  private rules = new Map<string, string>();

  constructor(rules: CategoryMappingRule[]) {
    for (const rule of rules) {
      this.rules.set(this.key(rule.brandSlug, rule.rawCategory), rule.categorySlug);
    }
  }

  private key(brandSlug: string | null | undefined, rawCategory: string): string {
    return `${brandSlug ?? ""}|${rawCategory.trim().toLowerCase()}`;
  }

  resolve(brandSlug: string, rawCategory: string | null): string | null {
    if (!rawCategory?.trim()) return null;
    return (
      this.rules.get(this.key(brandSlug, rawCategory)) ??
      this.rules.get(this.key(null, rawCategory)) ??
      null
    );
  }
}
