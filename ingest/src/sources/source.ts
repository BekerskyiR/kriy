import type { Brand, RawProduct } from "../types.js";

/**
 * Product source abstraction — the key architectural contract.
 *
 * The rest of the app (pipeline, CMS, frontend) only ever sees RawProduct[].
 * Adding a new source = a new implementation of this interface, with no
 * changes to the pipeline, API, or frontend.
 */
export interface ProductSource {
  readonly sourceType: "feed" | "instagram";
  /** Whether this source can serve the given brand. */
  supports(brand: Brand): boolean;
  fetchProducts(brand: Brand): Promise<RawProduct[]>;
}
