import type { Brand, RawProduct } from "../types.js";
import type { ProductSource } from "./source.js";
import { parseGoogleMerchant } from "./parsers/google-merchant.js";
import { parseShopifyAtom } from "./parsers/shopify-atom.js";
import { parseShopifyJson } from "./parsers/shopify-json.js";
import { parseYml } from "./parsers/yml.js";

const USER_AGENT =
  "Mozilla/5.0 (compatible; kriy-aggregator/1.0; +https://github.com/BekerskyiR/kriy)";

/** MVP safety limits: up to 1000 products (json) / 200 (atom) per brand. */
const MAX_JSON_PAGES = 4;
const MAX_ATOM_PAGES = 8;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch with retry+backoff on transient rate-limit/5xx (Shopify throttles bursts). */
async function fetchText(url: string, attempt = 0): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml,application/json,*/*" },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.ok) return res.text();
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await sleep(1000 * 2 ** attempt); // 1s, 2s, 4s, 8s
    return fetchText(url, attempt + 1);
  }
  throw new Error(`HTTP ${res.status} for ${url}`);
}

/**
 * FeedSource — a ProductSource implementation over product XML feeds.
 * The feed format is declared on the brand (brand.feedFormat); autodetection
 * is the fallback based on the root tag.
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

  /** Shopify products.json: ?limit=250&page=N until a page comes back empty. */
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

  /** Shopify Atom is paginated — walk ?page=N until the pages run dry. */
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
        break; // page beyond the catalog -> 404, stop
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
