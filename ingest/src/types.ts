/**
 * Спільні типи інжест-пайплайна.
 *
 * RawProduct — єдина проміжна структура: КОЖНЕ джерело (фід, Instagram, ...)
 * зобов'язане звести свої сирі дані саме до неї. Далі пайплайн працює
 * тільки з RawProduct і не знає, звідки прийшов товар.
 */

export type Availability = "in_stock" | "out_of_stock";
export type SourceType = "feed" | "instagram";

export interface RawProduct {
  externalId: string;
  title: string;
  description: string;
  /** Ціна в мінорних одиницях (копійки/центи). null — ціни в джерелі немає. */
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
  isActive: boolean;
  isFeatured: boolean;
  outboundClicks: number;
}

export interface CategoryMappingRule {
  /** null → глобальне правило для всіх брендів */
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
