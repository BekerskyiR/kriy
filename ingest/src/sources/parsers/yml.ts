import { XMLParser } from "fast-xml-parser";
import type { RawProduct } from "../../types.js";
import { parsePriceMinor } from "./price.js";

/**
 * YML (Yandex Market Language) — формат, який генерують Prom.ua та Хорошоп:
 * <yml_catalog><shop> з блоком <categories> (id → назва) і <offers>,
 * де кожен <offer id available> має name, price, currencyId, picture*, url,
 * categoryId (посилання на блок категорій).
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "offer" || name === "picture" || name === "category",
});

const text = (v: unknown): string =>
  (typeof v === "object" && v !== null ? (v as any)["#text"] : v)?.toString().trim() ?? "";

export function parseYml(xml: string): RawProduct[] {
  const doc = parser.parse(xml);
  const shop = doc?.yml_catalog?.shop ?? doc?.shop;
  if (!shop) return [];

  // categoryId → людська назва категорії; саме назву кладемо в rawCategory,
  // щоб правила мапінгу були читабельні, а не "id 17"
  const categoryNameById = new Map<string, string>();
  for (const cat of shop.categories?.category ?? []) {
    categoryNameById.set(String(cat["@_id"]), text(cat));
  }

  const products: RawProduct[] = [];
  for (const offer of shop.offers?.offer ?? []) {
    const externalId = String(offer["@_id"] ?? "").trim();
    if (!externalId) continue;

    const availableAttr = String(offer["@_available"] ?? "true").toLowerCase();
    const pictures: string[] = (offer.picture ?? []).map(text).filter(Boolean);
    const categoryName = categoryNameById.get(String(text(offer.categoryId))) ?? null;

    products.push({
      externalId,
      title: text(offer.name ?? offer.model),
      description: text(offer.description).slice(0, 500),
      priceMinor: parsePriceMinor(text(offer.price)),
      currency: text(offer.currencyId) || "UAH",
      availability: availableAttr === "false" ? "out_of_stock" : "in_stock",
      images: pictures,
      productUrl: text(offer.url),
      rawCategory: categoryName,
    });
  }
  return products;
}
