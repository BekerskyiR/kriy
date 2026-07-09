/**
 * Shared types for the ingest pipeline.
 *
 * RawProduct is the single intermediate structure: EVERY source (feed,
 * Instagram, ...) must reduce its raw data to exactly this shape. From there
 * the pipeline works only with RawProduct and never cares where a product
 * came from.
 */

export type Availability = "in_stock" | "out_of_stock";
export type SourceType = "feed" | "instagram";
export type Gender = "men" | "women" | "unisex";

export interface RawProduct {
  externalId: string;
  title: string;
  description: string;
  /** Price in minor units (cents/kopecks). null = no price in the source. */
  priceMinor: number | null;
  currency: string;
  availability: Availability;
  images: string[];
  productUrl: string;
  rawCategory: string | null;
}

export interface Brand {
  _id: string;
  name: string;
  slug: string;
  siteUrl: string;
  instagramHandle: string | null;
  sourceType: SourceType;
  feedUrl: string | null;
  feedFormat: string | null;
  defaultCurrency: string | null;
  /** Brand segment; products inherit it. unisex shows under both men and women. */
  gender: Gender | null;
  isActive: boolean;
  isFeatured: boolean;
  outboundClicks: number;
}

export interface CategoryMappingRule {
  /** null = global rule applied to all brands */
  brandSlug: string | null;
  rawCategory: string;
  categorySlug: string;
}

export interface IngestBrandResult {
  brandSlug: string;
  ok: boolean;
  error?: string;
  fetched: number;
  inserted: number;
  updated: number;
  markedOutOfStock: number;
  unmappedCategories: string[];
}
