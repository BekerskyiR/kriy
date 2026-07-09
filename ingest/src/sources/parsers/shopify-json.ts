import type { RawProduct } from "../../types.js";
import { parsePriceMinor } from "./price.js";

/**
 * Shopify /products.json — the public JSON feed of Shopify stores.
 * Chosen as the primary source for Shopify brands over Atom because:
 *   - real per-variant availability (Atom does not expose stock),
 *   - pagination up to 250 items per page (Atom ignores ?page= and only
 *     returns the latest 25 products).
 * products.json has no currency, so the brand's defaultCurrency is used.
 */

interface ShopifyVariant {
  price: string;
  available?: boolean;
}
interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  product_type?: string;
  variants?: ShopifyVariant[];
  images?: Array<{ src: string }>;
}

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function parseShopifyJson(
  json: string,
  opts: { siteUrl: string; defaultCurrency: string },
): RawProduct[] {
  const products: ShopifyProduct[] = JSON.parse(json)?.products ?? [];
  const base = opts.siteUrl.replace(/\/$/, "");

  return products.map((p) => {
    const variants = p.variants ?? [];
    const anyAvailable = variants.some((v) => v.available !== false);
    const rawType = (p.product_type ?? "").trim();
    return {
      externalId: String(p.id),
      title: p.title.trim(),
      description: stripHtml(p.body_html ?? "").slice(0, 500),
      priceMinor: parsePriceMinor(variants[0]?.price),
      currency: opts.defaultCurrency,
      availability: anyAvailable ? ("in_stock" as const) : ("out_of_stock" as const),
      images: (p.images ?? []).map((i) => i.src),
      productUrl: `${base}/products/${p.handle}`,
      rawCategory: rawType || null,
    };
  });
}
