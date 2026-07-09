import { CategoryMapper } from "./mapping.js";
import { FeedSource } from "./sources/feed-source.js";
import { InstagramSource } from "./sources/instagram-source.js";
import type { ProductSource } from "./sources/source.js";
import type { Brand, CategoryMappingRule, IngestBrandResult, RawProduct } from "./types.js";
import { bulkInsert, bulkPatch, bulkUpdate, queryAll } from "./wix-data.js";

/**
 * Ingest core. One pass per brand:
 *   1. source -> RawProduct[]
 *   2. category mapping (unmapped -> unmappedCategories)
 *   3. upsert into products by sourceKey = brand:sourceType:externalId
 *   4. products that disappeared from the feed -> out_of_stock
 *
 * A single brand's failure does not fail the whole pass. Stale-marking runs
 * ONLY for brands whose feed was processed successfully — otherwise one dead
 * feed would wrongly "kill" a brand's entire catalog.
 */

const SOURCES: ProductSource[] = [new FeedSource(), new InstagramSource()];

const sourceKeyOf = (brand: Brand, p: RawProduct) =>
  `${brand.slug}:${brand.sourceType}:${p.externalId}`;

export async function ingestBrands(brandSlugFilter?: string): Promise<IngestBrandResult[]> {
  const brands = (await queryAll<Brand>("brands", { isActive: true })).filter(
    (b) => !brandSlugFilter || b.slug === brandSlugFilter,
  );
  if (brands.length === 0) {
    throw new Error(
      brandSlugFilter ? `No active brand with slug "${brandSlugFilter}"` : "No active brands",
    );
  }

  const mapper = new CategoryMapper(await queryAll<CategoryMappingRule>("categoryMappings"));
  const results: IngestBrandResult[] = [];

  for (const brand of brands) {
    results.push(await ingestOneBrand(brand, mapper));
  }
  return results;
}

async function ingestOneBrand(brand: Brand, mapper: CategoryMapper): Promise<IngestBrandResult> {
  const result: IngestBrandResult = {
    brandSlug: brand.slug,
    ok: false,
    fetched: 0,
    inserted: 0,
    updated: 0,
    markedOutOfStock: 0,
    unmappedCategories: [],
  };

  try {
    const source = SOURCES.find((s) => s.supports(brand));
    if (!source) throw new Error(`No source supports brand ${brand.slug}`);

    const rawProducts = await source.fetchProducts(brand);
    result.fetched = rawProducts.length;
    if (rawProducts.length === 0) throw new Error("Feed returned 0 products — skipping upsert");

    const g = brand.gender ?? "unisex";
    const now = Date.now();
    const existing = await queryAll<{ sourceKey: string }>("products", { brandSlug: brand.slug });
    const existingIdByKey = new Map(existing.map((e) => [e.sourceKey, e._id]));

    const seenKeys = new Set<string>();
    const inserts: Array<Record<string, unknown>> = [];
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const unmappedCount = new Map<string, { count: number; example: string }>();

    for (const p of rawProducts) {
      const key = sourceKeyOf(brand, p);
      if (seenKeys.has(key)) continue; // duplicates within the feed
      seenKeys.add(key);

      const categorySlug = mapper.resolve(brand.slug, p.rawCategory);
      if (!categorySlug && p.rawCategory) {
        const norm = p.rawCategory.trim().toLowerCase();
        const entry = unmappedCount.get(norm) ?? { count: 0, example: p.title };
        entry.count += 1;
        unmappedCount.set(norm, entry);
      }

      const data = {
        sourceKey: key,
        brandSlug: brand.slug,
        brandName: brand.name,
        sourceType: brand.sourceType,
        externalId: p.externalId,
        title: p.title,
        description: p.description,
        priceMinor: p.priceMinor,
        currency: p.currency,
        availability: p.availability,
        mainImage: p.images[0] ?? null,
        imagesJson: JSON.stringify(p.images),
        productUrl: p.productUrl,
        rawCategory: p.rawCategory,
        categorySlug,
        gender: g,
        forMen: g === "men" || g === "unisex",
        forWomen: g === "women" || g === "unisex",
        lastSeenAt: now,
      };

      const existingId = existingIdByKey.get(key);
      if (existingId) updates.push({ id: existingId, data });
      else inserts.push(data);
    }

    result.inserted = inserts.length ? await bulkInsert("products", inserts) : 0;
    result.updated = updates.length ? await bulkUpdate("products", updates) : 0;

    // stale: present in CMS but missing from this (successful!) feed pass
    const staleIds = existing
      .filter((e) => !seenKeys.has(e.sourceKey))
      .map((e) => e._id);
    if (staleIds.length) {
      result.markedOutOfStock = await bulkPatch(
        "products",
        staleIds.map((id) => ({ id, set: { availability: "out_of_stock" } })),
      );
    }

    await logUnmapped(brand.slug, unmappedCount);
    result.unmappedCategories = [...unmappedCount.keys()];
    result.ok = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}

/** Log unmapped categories into a dedicated collection for manual mapping. */
async function logUnmapped(
  brandSlug: string,
  unmapped: Map<string, { count: number; example: string }>,
): Promise<void> {
  if (unmapped.size === 0) return;
  const existing = await queryAll<{ rawCategory: string; seenCount: number }>(
    "unmappedCategories",
    { brandSlug },
  );
  const existingByRaw = new Map(existing.map((e) => [e.rawCategory, e]));

  const inserts: Array<Record<string, unknown>> = [];
  const patches: Array<{ id: string; set: Record<string, unknown> }> = [];
  for (const [rawCategory, { count, example }] of unmapped) {
    const found = existingByRaw.get(rawCategory);
    if (found) patches.push({ id: found._id, set: { seenCount: (found.seenCount ?? 0) + count } });
    else inserts.push({ brandSlug, rawCategory, seenCount: count, exampleTitle: example });
  }
  if (inserts.length) await bulkInsert("unmappedCategories", inserts);
  if (patches.length) await bulkPatch("unmappedCategories", patches);
}
