import type { Brand, RawProduct } from "../types.js";
import type { ProductSource } from "./source.js";
import { parseGoogleMerchant } from "./parsers/google-merchant.js";
import { parseShopifyAtom } from "./parsers/shopify-atom.js";
import { parseShopifyJson } from "./parsers/shopify-json.js";
import { parseYml } from "./parsers/yml.js";

const USER_AGENT =
  "Mozilla/5.0 (compatible; svoye-aggregator/1.0; +https://github.com/BekerskyiR/svoye)";

/** Запобіжники для MVP: до 1000 товарів (json) / 200 (atom) з бренду. */
const MAX_JSON_PAGES = 4;
const MAX_ATOM_PAGES = 8;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * FeedSource — імплементація ProductSource поверх товарних XML-фідів.
 * Формат фіду оголошено на бренді (brand.feedFormat), автодетект —
 * фолбек за кореневим тегом.
 */
export class FeedSource implements ProductSource {
  readonly sourceType = "feed" as const;

  supports(brand: Brand): boolean {
    return brand.sourceType === "feed" && Boolean(brand.feedUrl);
  }

  async fetchProducts(brand: Brand): Promise<RawProduct[]> {
    if (!brand.feedUrl) throw new Error(`Brand ${brand.slug} has no feedUrl`);
    const format = brand.feedFormat ?? "auto";

    if (format === "shopify-json") return this.fetchShopifyJson(brand);
    if (format === "shopify-atom") return this.fetchShopifyAtom(brand.feedUrl);

    const xml = await fetchText(brand.feedUrl);
    switch (format) {
      case "yml":
        return parseYml(xml);
      case "google-merchant":
        return parseGoogleMerchant(xml);
      default:
        return this.autodetect(xml);
    }
  }

  /** Shopify products.json: ?limit=250&page=N, поки сторінка не спорожніє. */
  private async fetchShopifyJson(brand: Brand): Promise<RawProduct[]> {
    const all: RawProduct[] = [];
    for (let page = 1; page <= MAX_JSON_PAGES; page++) {
      const url = new URL(brand.feedUrl!);
      url.searchParams.set("limit", "250");
      url.searchParams.set("page", String(page));
      const json = await fetchText(url.toString());
      const batch = parseShopifyJson(json, {
        siteUrl: brand.siteUrl,
        defaultCurrency: brand.defaultCurrency ?? "UAH",
      });
      all.push(...batch);
      if (batch.length < 250) break;
    }
    return all;
  }

  /** Shopify Atom пагінований — ходимо по ?page=N, поки сторінки не спорожніють. */
  private async fetchShopifyAtom(feedUrl: string): Promise<RawProduct[]> {
    const all: RawProduct[] = [];
    const seen = new Set<string>();
    for (let page = 1; page <= MAX_ATOM_PAGES; page++) {
      const url = new URL(feedUrl);
      if (page > 1) url.searchParams.set("page", String(page));
      let xml: string;
      try {
        xml = await fetchText(url.toString());
      } catch {
        break; // сторінка за межами каталогу → 404, зупиняємось
      }
      const batch = parseShopifyAtom(xml);
      const fresh = batch.filter((p) => !seen.has(p.externalId));
      if (fresh.length === 0) break;
      fresh.forEach((p) => seen.add(p.externalId));
      all.push(...fresh);
    }
    return all;
  }

  private autodetect(xml: string): RawProduct[] {
    if (xml.includes("<yml_catalog") || xml.includes("<offer")) return parseYml(xml);
    if (xml.includes("jadedpixel.com/-/spec/shopify")) return parseShopifyAtom(xml);
    return parseGoogleMerchant(xml);
  }
}
