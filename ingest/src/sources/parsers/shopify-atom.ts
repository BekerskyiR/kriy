import { XMLParser } from "fast-xml-parser";
import type { RawProduct } from "../../types.js";
import { parsePriceMinor } from "./price.js";

/**
 * Shopify Atom (/collections/all.atom) — публічний фід Shopify-магазинів.
 * Містить title, s:type (сира категорія), s:variant/s:price@currency,
 * посилання на товар і зображення всередині CDATA-таблиці summary.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // одиночний <entry> має лишатися масивом
  isArray: (name) => name === "entry" || name === "s:variant",
});

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImages(summaryHtml: string): string[] {
  const urls = [...summaryHtml.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  // прибираємо дублікати, нормалізуємо protocol-relative URL
  return [...new Set(urls)].map((u) => (u.startsWith("//") ? `https:${u}` : u));
}

/** Опис у summary йде після службової таблиці Vendor/Type/Price — відрізаємо її. */
function extractDescription(summaryHtml: string): string {
  const afterTable = summaryHtml.split(/<\/tr>\s*<tr>/)[1] ?? summaryHtml;
  return stripHtml(afterTable).slice(0, 500);
}

export function parseShopifyAtom(xml: string): RawProduct[] {
  const doc = parser.parse(xml);
  const entries = doc?.feed?.entry ?? [];
  const products: RawProduct[] = [];

  for (const entry of entries) {
    const idUrl: string = String(entry.id ?? "");
    const externalId = idUrl.split("/").filter(Boolean).pop() ?? "";
    if (!externalId) continue;

    const links = Array.isArray(entry.link) ? entry.link : [entry.link];
    const alt = links.find((l: any) => l?.["@_rel"] === "alternate") ?? links[0];
    const productUrl: string = alt?.["@_href"] ?? "";

    const variants = entry["s:variant"] ?? [];
    const firstVariant = variants[0];
    const priceNode = firstVariant?.["s:price"];
    const priceMinor = parsePriceMinor(
      typeof priceNode === "object" ? priceNode?.["#text"] : priceNode,
    );
    const currency =
      (typeof priceNode === "object" ? priceNode?.["@_currency"] : null) ?? "UAH";

    const summaryHtml: string =
      typeof entry.summary === "object" ? (entry.summary?.["#text"] ?? "") : (entry.summary ?? "");

    const rawCategoryValue = String(entry["s:type"] ?? "").trim();

    products.push({
      externalId,
      title: String(entry.title ?? "").trim(),
      description: extractDescription(summaryHtml),
      priceMinor,
      currency,
      // Atom-фід не віддає стоки: товар присутній у фіді → вважаємо in_stock,
      // зникнення з фіду ловить stale-маркування пайплайна.
      availability: "in_stock",
      images: extractImages(summaryHtml),
      productUrl,
      rawCategory: rawCategoryValue || null,
    });
  }
  return products;
}
