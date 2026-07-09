import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGoogleMerchant } from "./sources/parsers/google-merchant.js";
import { parseYml } from "./sources/parsers/yml.js";

/**
 * Смоук-тест парсерів YML і Google Merchant на локальних фікстурах —
 * ці формати підтримані нарівні з Shopify Atom, але серед перших
 * підключених брендів їх немає, тож ганяємо на фікстурах.
 *   npm run test:parsers
 */
const fixtures = join(process.cwd(), "ingest", "fixtures");
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "✓" : "✗"} ${label}${ok ? "" : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
  if (!ok) failures += 1;
}

console.log("YML (Prom/Хорошоп):");
const yml = parseYml(readFileSync(join(fixtures, "yml-demo.xml"), "utf8"));
check("кількість товарів", yml.length, 3);
check("ціна '950' → мінорні", yml[0].priceMinor, 95000);
check("ціна '1 850' з пробілом", yml[1].priceMinor, 185000);
check("ціна '640.50' дробова", yml[2].priceMinor, 64050);
check("available=false → out_of_stock", yml[1].availability, "out_of_stock");
check("categoryId → назва категорії", yml[0].rawCategory, "Футболки");
check("кілька <picture>", yml[0].images.length, 2);

console.log("Google Merchant:");
const gm = parseGoogleMerchant(readFileSync(join(fixtures, "google-merchant-demo.xml"), "utf8"));
check("кількість товарів", gm.length, 2);
check("ціна з валютою в рядку", gm[0].priceMinor, 240000);
check("sale_price має пріоритет", gm[1].priceMinor, 256000);
check("out of stock", gm[1].availability, "out_of_stock");
check("product_type → rawCategory", gm[0].rawCategory, "Shirts");
check("additional_image_link", gm[0].images.length, 2);

console.log(failures === 0 ? "\nAll parser checks passed." : `\n${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
