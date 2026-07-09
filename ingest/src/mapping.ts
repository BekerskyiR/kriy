import type { CategoryMappingRule } from "./types.js";

/**
 * Maps a source's raw categories to our single taxonomy.
 *
 * Priority: brand-specific rule > global rule > null.
 * Keys are normalized (lowercase + trim) so "T-Shirts" and "t-shirts" are
 * the same rule.
 */
export class CategoryMapper {
  private rules = new Map<string, string>();
  /** Global single-word rules used for the keyword-contains fallback, longest first. */
  private keywords: Array<{ word: string; slug: string }> = [];

  constructor(rules: CategoryMappingRule[]) {
    for (const rule of rules) {
      this.rules.set(this.key(rule.brandSlug, rule.rawCategory), rule.categorySlug);
    }
    this.keywords = rules
      .filter((r) => r.brandSlug == null && !r.rawCategory.includes(" ") && r.rawCategory.length >= 4)
      .map((r) => ({ word: r.rawCategory.trim().toLowerCase(), slug: r.categorySlug }))
      .sort((a, b) => b.word.length - a.word.length);
  }

  private key(brandSlug: string | null | undefined, rawCategory: string): string {
    return `${brandSlug ?? ""}|${rawCategory.trim().toLowerCase()}`;
  }

  resolve(brandSlug: string, rawCategory: string | null): string | null {
    if (!rawCategory?.trim()) return null;
    const direct =
      this.rules.get(this.key(brandSlug, rawCategory)) ??
      this.rules.get(this.key(null, rawCategory));
    if (direct) return direct;

    // Some feeds join two languages in product_type (e.g. "<uk>/T-Shirt");
    // fall back to trying each slash-separated part.
    if (rawCategory.includes("/")) {
      for (const part of rawCategory.split("/")) {
        const hit =
          this.rules.get(this.key(brandSlug, part)) ?? this.rules.get(this.key(null, part));
        if (hit) return hit;
      }
    }

    // Last resort: some brands put the full product title into product_type
    // (e.g. "black knit polo, long sleeve"). Match the longest known keyword it contains.
    const norm = rawCategory.trim().toLowerCase();
    for (const { word, slug } of this.keywords) {
      if (norm.includes(word)) return slug;
    }
    return null;
  }
}
