import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGoogleMerchant } from "./sources/parsers/google-merchant.js";
import { parseYml } from "./sources/parsers/yml.js";

/**
 * Smoke test for the YML and Google Merchant parsers on local fixtures.
 * These formats are supported on par with Shopify Atom, but none of the
 * first connected brands use them, so we exercise them against fixtures.
 *   npm run test:parsers
 */
const fixtures = join(process.cwd(), "ingest", "fixtures");
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
  if (!ok) failures += 1;
}

console.log("YML (Prom/Horoshop):");
const yml = parseYml(readFileSync(join(fixtures, "yml-demo.xml"), "utf8"));
check("product count", yml.length, 3);
check("price '950' -> minor units", yml[0].priceMinor, 95000);
check("price '1 850' with a space", yml[1].priceMinor, 185000);
check("price '640.50' with a fraction", yml[2].priceMinor, 64050);
check("available=false -> out_of_stock", yml[1].availability, "out_of_stock");
check("categoryId -> category name", yml[0].rawCategory, "Футболки");
check("multiple <picture>", yml[0].images.length, 2);

console.log("Google Merchant:");
const gm = parseGoogleMerchant(readFileSync(join(fixtures, "google-merchant-demo.xml"), "utf8"));
check("product count", gm.length, 2);
check("price with currency in the string", gm[0].priceMinor, 240000);
check("sale_price takes priority", gm[1].priceMinor, 256000);
check("out of stock", gm[1].availability, "out_of_stock");
check("product_type -> rawCategory", gm[0].rawCategory, "Shirts");
check("additional_image_link", gm[0].images.length, 2);

console.log(failures === 0 ? "\nAll parser checks passed." : `\n${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
