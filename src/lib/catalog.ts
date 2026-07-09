import { items } from "@wix/data";
import { auth } from "@wix/essentials";
import { media } from "@wix/sdk";

/**
 * Catalog data access. The frontend reads the CMS directly via @wix/data —
 * there is no custom backend. Every query is elevated (auth.elevate), because
 * without it read-restricted collections silently return nothing.
 */

export type GenderFilter = "all" | "men" | "women";

export interface Category {
  _id: string;
  slug: string;
  nameUk: string;
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
  isFeatured: boolean;
  outboundClicks?: number;
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
}

/** In-stock product count per category (for the index counters), honoring gender. */
export async function getCategoryCounts(gender: GenderFilter = "all"): Promise<Record<string, number>> {
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
}

export async function getBrands(opts: { featuredOnly?: boolean } = {}): Promise<Brand[]> {
  try {
    let builder = auth.elevate(items.query)("brands").eq("isActive", true);
    if (opts.featuredOnly) builder = builder.eq("isFeatured", true);
    const { items: results } = await builder.ascending("name").limit(50).find();
    return results as Brand[];
  } catch (e) {
    console.error("getBrands failed:", e);
    return [];
  }
}

export interface ProductPage {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Products in a category — in_stock only, paginated, gender-filtered.
 * Featured brands float to the top (sorted in memory: Wix Data has no join
 * onto the brand).
 */
export async function getProductsByCategory(
  categorySlug: string,
  page = 1,
  pageSize = 24,
  gender: GenderFilter = "all",
): Promise<ProductPage> {
  try {
    const featuredSlugs = new Set((await getBrands({ featuredOnly: true })).map((b) => b.slug));
    const base = auth
      .elevate(items.query)("products")
      .eq("categorySlug", categorySlug)
      .eq("availability", "in_stock");
    const { items: results, totalCount } = await applyGender(base, gender)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .find();

    const products = (results as Product[]).sort((a, b) => {
      const af = featuredSlugs.has(a.brandSlug) ? 0 : 1;
      const bf = featuredSlugs.has(b.brandSlug) ? 0 : 1;
      return af - bf;
    });

    const total = totalCount ?? products.length;
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
  try {
    const base = auth.elevate(items.query)("products").eq("availability", "in_stock");
    return await applyGender(base, gender).count();
  } catch {
    return 0;
  }
}
