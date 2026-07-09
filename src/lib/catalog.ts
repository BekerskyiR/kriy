import { items } from "@wix/data";
import { auth } from "@wix/essentials";
import { media } from "@wix/sdk";

/**
 * Шар доступу до каталогу. Фронт читає CMS напряму через @wix/data —
 * кастомного бекенда немає. Усі запити елевейтимо (auth.elevate), бо
 * без цього read-restricted колекції мовчки повертають порожньо.
 */

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

const q = <T>() => auth.elevate(items.query) as unknown as (id: string) => any;

/** Wix-медіа (wix:image://) → CDN-URL; зовнішні URL лишаємо як є. */
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

/** Кількість товарів in_stock по кожній категорії (для лічильників в індексі). */
export async function getCategoryCounts(): Promise<Record<string, number>> {
  try {
    const { items: rows } = await auth
      .elevate(items.aggregate)("products")
      .filter(items.filter().eq("availability", "in_stock"))
      .group("categorySlug")
      .count()
      .run();
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
 * Товари категорії — тільки in_stock, з пагінацією. Featured-бренди
 * піднімаємо вгору (сортуємо в пам'яті: у Wix Data немає join'а на бренд).
 */
export async function getProductsByCategory(
  categorySlug: string,
  page = 1,
  pageSize = 24,
): Promise<ProductPage> {
  try {
    const featuredSlugs = new Set((await getBrands({ featuredOnly: true })).map((b) => b.slug));
    const { items: results, totalCount } = await auth
      .elevate(items.query)("products")
      .eq("categorySlug", categorySlug)
      .eq("availability", "in_stock")
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

export async function getTotalInStock(): Promise<number> {
  try {
    return await auth
      .elevate(items.query)("products")
      .eq("availability", "in_stock")
      .count();
  } catch {
    return 0;
  }
}
