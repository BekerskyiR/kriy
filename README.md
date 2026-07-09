# СВОЄ — агрегатор українських брендів одягу

Каталог-вітрина, що збирає товари українських брендів одягу по категоріях.
Користувач обирає категорію → бачить товари від багатьох брендів → переходить
у магазин самого бренду й купує там. **Ми нічого не продаємо з каталогу** —
це вітрина + вихідні посилання.

Побудовано на **Wix Headless**: дані живуть у Wix CMS, платіжний флоу — через
Wix Pricing Plans (hosted checkout), фронтенд — кастомний на Astro, без Editor.

> Зроблено для Wix Headless Day. Команда — Payments, тому платежі через
> headless тут обов'язкова частина (див. «Монетизація»).

---

## Архітектура

```
Товарний фід бренду (XML/JSON)
        │
        ▼
  ProductSource ── FeedSource (фаза 1) ──┐
        │          InstagramSource (фаза 2, лише інтерфейс)
        ▼                                 │
   RawProduct[]  ◄──────────────────────┘   єдина проміжна структура
        │
        ▼
  Нормалізація + мапінг категорій
        │
        ▼
   Wix CMS (колекція products)  ◄── інжест-CLI пише сюди
        │
        ▼
   Astro-фронт читає Wix Data напряму (@wix/data)
        │
        ▼
   Вітрина → вихідне посилання на бренд (UTM + лічильник кліків)
```

**Ключове рішення — абстракція джерел.** Будь-яке джерело товарів зводить свої
дані до `RawProduct[]` (`ingest/src/sources/source.ts`). Решта системи —
пайплайн, CMS, фронт — не знає, звідки прийшов товар. Додати нове джерело =
нова імплементація `ProductSource`, без змін у пайплайні чи фронті.

### Джерела даних

- **FeedSource** (працює) — товарні фіди брендів. Підтримані формати:
  - Shopify `products.json` та `collections/all.atom`
  - YML (Prom.ua / Хорошоп) — `<offer>` + блок `<categories>`
  - Google Merchant / RSS — `<item>` з тегами `g:*`
- **InstagramSource** (фаза 2, лише інтерфейс) — IG-бренди без сайту.

> **Чому Instagram не в ядрі й без скрапінгу.** Скрапінг Instagram порушує
> ToS Meta і юридично сірий. IG-джерело спроєктовано працювати **тільки**
> через офіційний Instagram Graph API для акаунтів, які бренд сам підключив
> через OAuth (потік «claim your profile»). Зараз це лише інтерфейс +
> заглушка (`ingest/src/sources/instagram-source.ts`), реалізація — пізніше.

---

## Модель даних (колекції Wix CMS)

| Колекція | Призначення |
|---|---|
| `brands` | Бренди: назва, слаг, сайт, фід, `isFeatured`, `outboundClicks` |
| `products` | Нормалізовані товари. Унікальність: `sourceKey = brandSlug:sourceType:externalId` |
| `categories` | Єдина таксономія (12 верхніх категорій) |
| `categoryMappings` | Правила `rawCategory → categorySlug` (глобальні або per-brand) |
| `unmappedCategories` | Лог сирих категорій без відповідності — для ручного домапування |

Ціни зберігаються в **мінорних одиницях** (копійки/центи, integer) + ISO-валюта.

---

## Інжест-пайплайн

Один прохід по бренду (`ingest/src/pipeline.ts`):

1. Джерело → `RawProduct[]`.
2. Мапінг `rawCategory → categorySlug`; немапнуте → `unmappedCategories`.
3. Upsert у `products` батчами по унікальному `sourceKey`.
4. Товари, що зникли з цього (успішного) проходу фіду → `availability = out_of_stock`.

Дві важливі гарантії:

- Помилка одного бренду логується й **не роняє** весь прохід.
- Stale-маркування (`out_of_stock`) виконується **тільки** для брендів, чий фід
  успішно оброблено — інакше один мертвий фід «погасив» би весь асортимент
  бренду.

---

## Монетизація

**Featured brand** — бренд платить за виділене місце у вітрині через
**Wix Pricing Plans + hosted checkout**:

- Сторінка `/for-brands` читає публічний план і показує тариф.
- Кнопка → `/checkout?planId=…` створює `createRedirectSession`
  (`@wix/redirects`) і 302-редіректить на Wix hosted checkout.
- Після оплати Wix повертає користувача на `/thank-you`.

Featured-бренди показуються в блоці «Обрані бренди» на головній і піднімаються
вгору в категоріях. Це органічно продовжує майбутній «claim your profile»:
підключення Instagram стане частиною платного tier'а.

**Лічильник вихідних кліків** (`/out`) інкрементує `outboundClicks` бренду при
кожному переході — цінність для брендів у цифрах + основа пітчу на `/for-brands`.

---

## Запуск

Потрібні Node ≥ 20.11, залогінений Wix CLI (`npx @wix/cli login`) і доступ до
внутрішнього npm-реєстру Wix (VPN).

```bash
npm install

# 1. Інжест товарів у CMS
npm run ingest                        # усі активні бренди
npm run ingest -- --brand keepstyle   # один бренд

# 2. Тести парсерів (YML + Google Merchant на фікстурах)
npm run test:parsers

# 3. Локальна розробка фронту
npm run dev                           # http://localhost:4321

# 4. Прод-білд і публікація
npm run build
npm run release                       # деплой на Wix
```

> **SSR-роути (`/checkout`, `/out`) в `wix dev`** проксіюються на канонічний
> хост сайту, тому наскрізний тест checkout/редіректів працює лише **після
> `npm run release`**.

Періодичне оновлення фідів на день івенту — ручний `npm run ingest` або
GitHub Action cron.

---

## Структура

```
ingest/
  src/
    sources/
      source.ts              # інтерфейс ProductSource
      feed-source.ts         # FeedSource (фаза 1)
      instagram-source.ts    # InstagramSource (фаза 2, заглушка)
      parsers/               # shopify-json, shopify-atom, yml, google-merchant, price
    pipeline.ts              # ядро інжесту
    mapping.ts               # CategoryMapper
    wix-data.ts              # REST-клієнт до Wix Data v2
    cli.ts                   # npm run ingest
    test-parsers.ts          # npm run test:parsers
  fixtures/                  # демо-фіди YML і Google Merchant
src/
  lib/catalog.ts             # читання каталогу з CMS (@wix/data)
  lib/plans.ts               # читання pricing-plan
  pages/
    index.astro              # головна: featured + категорії
    c/[slug].astro           # сторінка категорії (пагінація)
    for-brands.astro         # пітч + тариф Featured brand
    checkout.ts              # redirect на hosted checkout
    thank-you.astro          # сторінка успіху
    out.ts                   # редіректор вихідних кліків (UTM + лічильник)
  styles/global.css          # дизайн-система «червона нитка»
```
