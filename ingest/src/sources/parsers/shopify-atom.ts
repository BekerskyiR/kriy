import { XMLParser } from "fast-xml-parser";
import type { RawProduct } from "../../types.js";
import { parsePriceMinor } from "./price.js";

/**
 * Shopify Atom (/collections/all.atom) — the public feed of Shopify stores.
 * Contains title, s:type (raw category), s:variant/s:price@currency, a product
 * link, and images inside the CDATA table of the summary field.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // a single <entry> must stay an array
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
  // dedupe, normalize protocol-relative URLs
  return [...new Set(urls)].map((u) => (u.startsWith("//") ? `https:${u}` : u));
}

/** Description in summary follows the service Vendor/Type/Price table — cut it off. */
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
      // Atom feed does not expose stock: a product present in the feed is
      // treated as in_stock; disappearance from the feed is caught by the
      // pipeline's stale-marking pass.
      availability: "in_stock",
      images: extractImages(summaryHtml),
      productUrl,
      rawCategory: rawCategoryValue || null,
    });
  }
  return products;
}
