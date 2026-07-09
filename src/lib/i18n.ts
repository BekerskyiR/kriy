import type { AstroCookies } from "astro";

/**
 * Minimal two-locale i18n. Locale lives in a cookie (clean URLs, persists
 * across pages); the /set-lang endpoint flips it. UI strings live in DICT;
 * dynamic content (category nameEn, brand descriptionEn) comes from the CMS.
 * Product titles are intentionally NOT translated — they stay as the brand
 * wrote them (fashion names are identity; ~60% are already English).
 */

export type Locale = "uk" | "en";
export const LOCALES: Locale[] = ["uk", "en"];
const DEFAULT: Locale = "uk";

export function getLocale(cookies: AstroCookies): Locale {
  const v = cookies.get("lang")?.value;
  return v === "en" ? "en" : DEFAULT;
}

const DICT = {
  uk: {
    "nav.catalog": "Каталог",
    "nav.brands": "Для брендів",
    "footer.tagline": "КРІЙ — вітрина, а не магазин. Купівля відбувається на сайті бренда.",
    "footer.addBrand": "Додати свій бренд →",
    "gender.label": "Показувати:",
    "gender.all": "Усі",
    "gender.women": "Жіноче",
    "gender.men": "Чоловіче",
    "home.heroA": "Знайди свій",
    "home.heroAccent": "крій",
    "home.lede": "Одяг українських брендів — зібраний по категоріях в одному місці. Обирай, порівнюй, переходь і купуй напряму в бренда.",
    "home.inStock": "товарів у наявності",
    "home.brands": "брендів",
    "home.categories": "категорій",
    "home.featured": "Обрані бренди",
    "home.recommended": "РЕКОМЕНДУЄМО",
    "home.categoriesTitle": "Категорії",
    "home.sections": "розділів",
    "cat.products": "товарів",
    "cat.allBrands": "Усі бренди",
    "cat.emptyTitle": "Поки порожньо",
    "cat.emptyAll": "У цій категорії ще немає товарів у наявності. Загляни в інші розділи або повернись пізніше — каталог оновлюється щодня.",
    "cat.emptyFilter": "У цьому фільтрі поки немає товарів. Спробуй показати всі або іншу категорію.",
    "cat.toCategories": "← До категорій",
    "cat.showAll": "Показати всі →",
    "cat.prev": "← Назад",
    "cat.next": "Далі →",
    "card.toBrand": "до бренда →",
    "brands.eyebrow": "Для брендів",
    "brands.title": "Ваш одяг там, де його шукають.",
    "brands.lede": "КРІЙ збирає товари українських брендів по категоріях і веде покупця напряму до вас — без комісій з продажу й без посередництва в оплаті. Ми вітрина, ви — магазин.",
    "brands.mInCatalog": "товарів у каталозі",
    "brands.mBrands": "брендів уже з нами",
    "brands.mClicks": "переходів приведено",
    "brands.step1": "Надсилаєте нам посилання на товарний фід — ми підключаємо ваш каталог.",
    "brands.step2": "Товари з'являються у відповідних категоріях автоматично й оновлюються щодня.",
    "brands.step3a": "Хочете більше уваги — стаєте",
    "brands.step3b": "і піднімаєтесь угору вітрини.",
    "brands.perMonth": "/ міс",
    "brands.cta": "Стати featured →",
    "brands.planName": "Featured brand — місяць",
    "brands.perk1": "Бейдж «featured» і блок на головній сторінці",
    "brands.perk2": "Товари бренду піднімаються вгору в кожній категорії",
    "brands.perk3": "Місячний звіт про кількість переходів на ваш сайт",
    "brands.planUnavailable": "Тариф тимчасово недоступний",
    "brands.planUnavailableBody": "Напишіть нам — підключимо вас вручну.",
    "thanks.eyebrow": "Оплата отримана",
    "thanks.title": "Вітаємо у вітрині ✦",
    "thanks.lede": "Дякуємо! Ваш бренд стає featured — з'явиться у блоці «Обрані бренди» на головній, а товари піднімуться вгору в категоріях. Зміни застосуються протягом кількох хвилин після синхронізації.",
    "thanks.toCatalog": "До каталогу →",
    "thanks.backToPlan": "Назад до тарифу",
  },
  en: {
    "nav.catalog": "Catalog",
    "nav.brands": "For brands",
    "footer.tagline": "KRIY is a showcase, not a shop. You buy on the brand's own site.",
    "footer.addBrand": "Add your brand →",
    "gender.label": "Show:",
    "gender.all": "All",
    "gender.women": "Women",
    "gender.men": "Men",
    "home.heroA": "Find your",
    "home.heroAccent": "fit",
    "home.lede": "Ukrainian fashion brands — gathered by category in one place. Browse, compare, click through and buy straight from the brand.",
    "home.inStock": "products in stock",
    "home.brands": "brands",
    "home.categories": "categories",
    "home.featured": "Featured brands",
    "home.recommended": "RECOMMENDED",
    "home.categoriesTitle": "Categories",
    "home.sections": "sections",
    "cat.products": "products",
    "cat.allBrands": "All brands",
    "cat.emptyTitle": "Nothing here yet",
    "cat.emptyAll": "No products in stock in this category yet. Try other sections or check back later — the catalog updates daily.",
    "cat.emptyFilter": "No products for this filter yet. Try showing all, or another category.",
    "cat.toCategories": "← To categories",
    "cat.showAll": "Show all →",
    "cat.prev": "← Back",
    "cat.next": "Next →",
    "card.toBrand": "to brand →",
    "brands.eyebrow": "For brands",
    "brands.title": "Your clothes where people look for them.",
    "brands.lede": "KRIY gathers Ukrainian brands' products by category and sends shoppers straight to you — no sales commission, no payment middleman. We're the showcase, you're the shop.",
    "brands.mInCatalog": "products in the catalog",
    "brands.mBrands": "brands already with us",
    "brands.mClicks": "click-throughs delivered",
    "brands.step1": "Send us a link to your product feed — we connect your catalog.",
    "brands.step2": "Products appear in the right categories automatically and refresh daily.",
    "brands.step3a": "Want more attention — become",
    "brands.step3b": "and rise to the top of the showcase.",
    "brands.perMonth": "/ mo",
    "brands.cta": "Become featured →",
    "brands.planName": "Featured brand — monthly",
    "brands.perk1": "\"featured\" badge and a block on the home page",
    "brands.perk2": "Your products rise to the top of every category",
    "brands.perk3": "Monthly report on click-throughs to your site",
    "brands.planUnavailable": "Plan temporarily unavailable",
    "brands.planUnavailableBody": "Drop us a line — we'll onboard you manually.",
    "thanks.eyebrow": "Payment received",
    "thanks.title": "Welcome to the showcase ✦",
    "thanks.lede": "Thank you! Your brand is now featured — it appears in the Featured brands block on the home page, and its products rise to the top of categories. Changes apply within a few minutes after the next sync.",
    "thanks.toCatalog": "To catalog →",
    "thanks.backToPlan": "Back to plan",
  },
} as const;

export type TKey = keyof (typeof DICT)["uk"];

export function useT(locale: Locale) {
  const table = DICT[locale];
  return (key: TKey): string => table[key] ?? DICT.uk[key] ?? key;
}
