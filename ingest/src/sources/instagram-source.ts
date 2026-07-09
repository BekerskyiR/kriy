import type { Brand, RawProduct } from "../types.js";
import type { ProductSource } from "./source.js";

/**
 * InstagramSource — Phase 2, contract only for now.
 *
 * Principled stance: no Instagram scraping. Data comes EXCLUSIVELY through the
 * Instagram Graph API for accounts a brand connected itself via OAuth (the
 * "claim your profile" flow: the brand clicks "connect IG" once on /for-brands
 * and grants us a token).
 *
 * Same output — RawProduct[] -> same normalization -> same products
 * collection with sourceType = "instagram". Neither the pipeline nor the
 * frontend needs any change.
 */
export class InstagramSource implements ProductSource {
  readonly sourceType = "instagram" as const;

  supports(brand: Brand): boolean {
    return brand.sourceType === "instagram" && Boolean(brand.instagramHandle);
  }

  async fetchProducts(_brand: Brand): Promise<RawProduct[]> {
    throw new Error(
      "InstagramSource is Phase 2: waiting for brand-side OAuth (claim your profile). " +
        "No scraping fallback by design — Meta ToS.",
    );
  }
}

/**
 * TODO(Phase 2): IG posts carry no structured price/size. This is where
 * caption parsing (price/sizes from text) and optionally image OCR will go.
 * Returns a partial RawProduct.
 */
export function extractStructuredData(_post: unknown): Partial<RawProduct> {
  return {};
}
