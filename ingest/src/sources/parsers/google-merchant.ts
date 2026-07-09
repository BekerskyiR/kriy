import { XMLParser } from "fast-xml-parser";
import type { RawProduct } from "../../types.js";
import { parseCurrency, parsePriceMinor } from "./price.js";

/**
 * Google Merchant / RSS 2.0 feed: <channel><item> with tags g:id, g:title,
 * g:price ("1200.00 UAH"), g:availability, g:image_link, g:link,
 * g:product_type / g:google_product_category.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === "item" || name === "g:additional_image_link",
});

const text = (v: unknown): string =>
  (typeof v === "object" && v !== null ? (v as any)["#text"] : v)?.toString().trim() ?? "";

export function parseGoogleMerchant(xml: string): RawProduct[] {
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item ?? doc?.channel?.item ?? [];
  const products: RawProduct[] = [];

  for (const item of items) {
    const externalId = text(item["g:id"] ?? item.guid);
    if (!externalId) continue;

    const priceRaw = text(item["g:sale_price"]) || text(item["g:price"]);
    const availabilityRaw = text(item["g:availability"]).toLowerCase();
    const images = [
      text(item["g:image_link"]),
      ...(item["g:additional_image_link"] ?? []).map(text),
    ].filter(Boolean);

    products.push({
      externalId,
      title: text(item["g:title"] ?? item.title),
      description: text(item["g:description"] ?? item.description).slice(0, 500),
      priceMinor: parsePriceMinor(priceRaw),
      currency: parseCurrency(priceRaw),
      availability:
        availabilityRaw === "" || availabilityRaw.includes("in stock") || availabilityRaw === "in_stock"
          ? "in_stock"
          : "out_of_stock",
      images,
      productUrl: text(item["g:link"] ?? item.link),
      rawCategory: text(item["g:product_type"] ?? item["g:google_product_category"]) || null,
    });
  }
  return products;
}
