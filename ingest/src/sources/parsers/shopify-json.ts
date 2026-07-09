import type { RawProduct } from "../../types.js";
import { parsePriceMinor } from "./price.js";

/**
 * Shopify /products.json — публічний JSON-фід Shopify-магазинів.
 * Обраний основним для Shopify-брендів замість Atom, бо:
 *   - реальна наявність по варіантах (Atom стоків не віддає),
 *   - пагінація до 250 позицій на сторінку (Atom ігнорує ?page= і
 *     віддає лише останні 25 товарів).
 * Валюти у products.json немає — береться defaultCurrency бренду.
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
