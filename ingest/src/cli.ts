import { ingestBrands } from "./pipeline.js";

/**
 * CLI інжесту:
 *   npm run ingest             — усі активні бренди
 *   npm run ingest -- --brand keepstyle
 */
async function main() {
  const args = process.argv.slice(2);
  const brandFlag = args.indexOf("--brand");
  const brandSlug = brandFlag !== -1 ? args[brandFlag + 1] : undefined;

  console.log(`[ingest] start ${new Date().toISOString()}${brandSlug ? ` (brand: ${brandSlug})` : " (all brands)"}`);
  const results = await ingestBrands(brandSlug);

  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      console.log(
        `  ✓ ${r.brandSlug}: fetched ${r.fetched}, +${r.inserted} new, ~${r.updated} updated, ${r.markedOutOfStock} → out_of_stock` +
          (r.unmappedCategories.length ? `, unmapped: [${r.unmappedCategories.join(", ")}]` : ""),
      );
    } else {
      failed += 1;
      console.error(`  ✗ ${r.brandSlug}: ${r.error}`);
    }
  }
  console.log(`[ingest] done: ${results.length - failed}/${results.length} brands ok`);
  if (failed === results.length) process.exit(1);
}

main().catch((err) => {
  console.error("[ingest] fatal:", err);
  process.exit(1);
});
