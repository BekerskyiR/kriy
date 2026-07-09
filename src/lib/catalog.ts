import { items } from "@wix/data";
import { auth } from "@wix/essentials";
import { media } from "@wix/sdk";

/**
 * Catalog data access. The frontend reads the CMS directly via @wix/data —
 * there is no custom backend. Every query is elevated (auth.elevate), because
 * without it read-restricted collections silently return nothing.
 *
 * A tiny TTL cache fronts the near-static reads (categories, brands, counts):
 * they change once per ingest, not per click. Within a single page render it
 * also deduplicates repeated getBrands() calls; across warm requests it saves
 * the round-trip entirely. Product listings are NOT cached (paginated, many
 * variants, must stay fresh).
 */

export type GenderFilter = "all" | "men" | "women";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; val: unknown }>();

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.val as T;
  const val = await fn();
  cache.set(key, { at: Date.now(), val });
  return val;
}

export interface Category {
  _id: string;
  slug: string;
  nameUk: string;
  nameEn?: string;
  parentSlug?: string | null;
  sortOrder: number;
}

export interface Brand {
  _id: string;
  name: string;
  slug: string;
  siteUrl: string;
  instagramHandle?: string | null;
  description?: string;
  descriptionEn?: string;
  isFeatured: boolean;
  outboundClicks?: number;
}

/** Localized category name (falls back to Ukrainian). */
export function catName(c: Category, locale: "uk" | "en"): string {
  return locale === "en" ? (c.nameEn ?? c.nameUk) : c.nameUk;
}

/** Localized brand description (falls back to Ukrainian). */
export function brandDesc(b: Brand, locale: "uk" | "en"): string {
  return locale === "en" ? (b.descriptionEn ?? b.description ?? "") : (b.description ?? "");
}

export interface Product {
  _id: string;
  title: string;
  brandName: string;
  brandSlug: string;
  priceMinor: number | null;
  currency: string;
  mainImage: string | null;
  productUrl: string;
  categorySlug: string | null;
  availability: "in_stock" | "out_of_stock";
}

/** Apply a gender filter to a products query (unisex products carry both flags). */
function applyGender(builder: any, gender: GenderFilter) {
  if (gender === "men") return builder.eq("forMen", true);
  if (gender === "women") return builder.eq("forWomen", true);
  return builder;
}

/** Wix media (wix:image://) -> CDN URL; external URLs are kept as-is. */
export function resolveImage(url: string | null | undefined, w = 600, h = 800): string | null {
  if (!url) return null;
  if (url.startsWith("wix:image")) return media.getScaledToFillImageUrl(url, w, h, {});
  return url;
}

export function formatPrice(priceMinor: number | null, currency: string): string {
  if (priceMinor == null) return "—";
  const value = priceMinor / 100;
  const symbol = currency === "UAH" ? "₴" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  const formatted = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(value);
  return currency === "UAH" ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

export async function getCategories(): Promise<Category[]> {
  return cached("categories", async () => {
    try {
      const { items: results } = await auth
        .elevate(items.query)("categories")
        .ascending("sortOrder")
        .limit(100)
        .find();
      return results as Category[];
    } catch (e) {
      console.error("getCategories failed:", e);
      return [];
    }
  });
}

/** In-stock product count per category (for the index counters), honoring gender. */
export async function getCategoryCounts(gender: GenderFilter = "all"): Promise<Record<string, number>> {
  return cached(`counts:${gender}`, async () => {
  try {
    const agg = applyGender(
      auth.elevate(items.aggregate)("products").filter(items.filter().eq("availability", "in_stock")),
      gender,
    );
    const { items: rows } = await agg.group("categorySlug").count().run();
    const map: Record<string, number> = {};
    for (const r of rows as any[]) {
      const slug = r._id?.categorySlug ?? r.categorySlug;
      if (slug) map[slug] = r.count ?? r.itemsCount ?? 0;
    }
    return map;
  } catch (e) {
    console.error("getCategoryCounts failed:", e);
    return {};
  }
  });
}

export async function getBrands(opts: { featuredOnly?: boolean } = {}): Promise<Brand[]> {
  return cached(`brands:${opts.featuredOnly ? "featured" : "all"}`, async () => {
    try {
      let builder = auth.elevate(items.query)("brands").eq("isActive", true);
      if (opts.featuredOnly) builder = builder.eq("isFeatured", true);
      const { items: results } = await builder.ascending("name").limit(50).find();
      return results as Brand[];
    } catch (e) {
      console.error("getBrands failed:", e);
      return [];
    }
  });
}

export interface BrandFacet {
  slug: string;
  name: string;
  count: number;
}

/**
 * Brands that have in_stock products in a category (honoring the gender
 * filter) — for the category page's brand-filter chips. Counts come from an
 * aggregation; names are joined in from the brands collection.
 */
export async function getBrandsInCategory(
  categorySlug: string,
  gender: GenderFilter = "all",
): Promise<BrandFacet[]> {
  return cached(`brandsInCat:${categorySlug}:${gender}`, async () => {
  try {
    const agg = applyGender(
      auth
        .elevate(items.aggregate)("products")
        .filter(items.filter().eq("categorySlug", categorySlug).eq("availability", "in_stock")),
      gender,
    );
    const { items: rows } = await agg.group("brandSlug").count().run();
    const nameBySlug = new Map((await getBrands()).map((b) => [b.slug, b.name]));
    return (rows as any[])
      .map((r) => {
        const slug = r._id?.brandSlug ?? r.brandSlug;
        return { slug, name: nameBySlug.get(slug) ?? slug, count: r.count ?? r.itemsCount ?? 0 };
      })
      .filter((b) => b.slug)
      .sort((a, b) => b.count - a.count);
  } catch (e) {
    console.error("getBrandsInCategory failed:", e);
    return [];
  }
  });
}

export interface ProductPage {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Products in a category — in_stock only, paginated, gender- and brand-filtered.
 * Featured brands float to the top (sorted in memory: Wix Data has no join
 * onto the brand).
 */
export async function getProductsByCategory(
  categorySlug: string,
  page = 1,
  pageSize = 24,
  gender: GenderFilter = "all",
  brandSlug?: string,
): Promise<ProductPage> {
  try {
    const featuredSlugs = new Set((await getBrands({ featuredOnly: true })).map((b) => b.slug));
    const buildQuery = () => {
      let q = auth
        .elevate(items.query)("products")
        .eq("categorySlug", categorySlug)
        .eq("availability", "in_stock");
      if (brandSlug) q = q.eq("brandSlug", brandSlug);
      return applyGender(q, gender);
    };
    // .find() doesn't reliably return a full totalCount, so count explicitly —
    // otherwise total collapses to the page size and pagination never shows.
    const [{ items: results }, total] = await Promise.all([
      buildQuery().skip((page - 1) * pageSize).limit(pageSize).find(),
      buildQuery().count(),
    ]);

    const products = (results as Product[]).sort((a, b) => {
      const af = featuredSlugs.has(a.brandSlug) ? 0 : 1;
      const bf = featuredSlugs.has(b.brandSlug) ? 0 : 1;
      return af - bf;
    });

    return {
      products,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  } catch (e) {
    console.error("getProductsByCategory failed:", e);
    return { products: [], total: 0, page, pageSize, totalPages: 1 };
  }
}

export async function getTotalInStock(gender: GenderFilter = "all"): Promise<number> {
  return cached(`total:${gender}`, async () => {
    try {
      const base = auth.elevate(items.query)("products").eq("availability", "in_stock");
      return await applyGender(base, gender).count();
    } catch {
      return 0;
    }
  });
}
