import { bulkInsert, queryAll } from "./wix-data.js";

/**
 * One-off admin script: map raw categories discovered in unmappedCategories
 * after the first ingest passes. Keys are the real (often Ukrainian) product_type
 * strings from brand feeds — data, matched verbatim against the feeds.
 *   npx tsx ingest/src/add-mappings.ts
 */
const NEW_RULES: Record<string, string> = {
  sweatshirt: "hudi-svitshoty", "світшот": "hudi-svitshoty", "зіпер": "hudi-svitshoty",
  zippers: "hudi-svitshoty", "застібки-блискавки": "hudi-svitshoty",
  longsleeves: "futbolky", "лонгсліви": "futbolky", "топи": "futbolky",
  "tank tops": "futbolky", "clothing tops": "futbolky",
  "боді": "bilyzna", bodie: "bilyzna", thongs: "bilyzna", "труси": "bilyzna",
  bombers: "verkhniy-odyag", "бомбер": "verkhniy-odyag", "бомбардувальники": "verkhniy-odyag",
  "пальто": "verkhniy-odyag", "пуховики": "verkhniy-odyag", "шуба": "verkhniy-odyag",
  "піджак": "verkhniy-odyag", "trucker jackets": "verkhniy-odyag",
  waistcoats: "verkhniy-odyag", ponchos: "verkhniy-odyag", vest: "verkhniy-odyag",
  shirt: "sorochky",
  "міні-сукня": "sukni",
  "сумка": "aksesuary", belts: "aksesuary", "scarves & shawls": "aksesuary",
  handkerchiefs: "aksesuary", "bandanas & headties": "aksesuary",
  "краватка": "aksesuary", "charms & pendants": "aksesuary",
  sweaters: "svetry", "кардиган": "svetry",
  "skirts and shorts": "spidnytsi",
  robes: "domashniy-odyag", rober: "domashniy-odyag",
};

const NEW_CATEGORIES = [{ slug: "svetry", nameUk: "Светри та кардигани", sortOrder: 3 }];

async function main() {
  const existingCats = new Set((await queryAll<{ slug: string }>("categories")).map((c) => c.slug));
  const catsToAdd = NEW_CATEGORIES.filter((c) => !existingCats.has(c.slug));
  if (catsToAdd.length) console.log("categories added:", await bulkInsert("categories", catsToAdd));

  const existingRules = new Set(
    (await queryAll<{ brandSlug: string | null; rawCategory: string }>("categoryMappings")).map(
      (r) => `${r.brandSlug ?? ""}|${r.rawCategory}`,
    ),
  );
  const rulesToAdd = Object.entries(NEW_RULES)
    .filter(([raw]) => !existingRules.has(`|${raw}`))
    .map(([rawCategory, categorySlug]) => ({ brandSlug: null, rawCategory, categorySlug }));
  if (rulesToAdd.length) console.log("rules added:", await bulkInsert("categoryMappings", rulesToAdd));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
