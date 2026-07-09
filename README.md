# KRIY — aggregator of Ukrainian clothing brands

A catalog/storefront that gathers products from Ukrainian clothing brands by
category. A visitor picks a category → sees products from many brands →
clicks through to the brand's own store to buy. **We sell nothing from the
catalog** — it's a showcase plus outbound links.

Built on **Wix Headless**: data lives in Wix CMS, the payment flow runs through
Wix Pricing Plans (hosted checkout), and the frontend is a custom Astro app —
no Editor.

> UI copy is Ukrainian on purpose — this is a Ukrainian marketplace. Code
> comments and this document are English.

---

## Architecture

```
Brand product feed (XML/JSON)
        │
        ▼
  ProductSource ── FeedSource (phase 1) ──┐
        │          InstagramSource (phase 2, interface only)
        ▼                                  │
   RawProduct[]  ◄───────────────────────┘   single intermediate structure
        │
        ▼
  Normalization + category mapping + gender flags
        │
        ▼
   Wix CMS (products collection)  ◄── ingest CLI writes here
        │
        ▼
   Astro frontend reads Wix Data directly (@wix/data)
        │
        ▼
   Showcase → outbound link to the brand (UTM + click counter)
```

**Key decision — the source abstraction.** Every product source reduces its
data to `RawProduct[]` (`ingest/src/sources/source.ts`). The rest of the system
— pipeline, CMS, frontend — never knows where a product came from. Adding a new
source = a new `ProductSource` implementation, with no changes to the pipeline
or frontend.

### Data sources

- **FeedSource** (working) — brand product feeds. Supported formats:
  - Shopify `products.json` (primary) and `collections/all.atom`
  - YML (Prom.ua / Horoshop) — `<offer>` + a `<categories>` block
  - Google Merchant / RSS — `<item>` with `g:*` tags
- **InstagramSource** (phase 2, interface only) — IG brands without a site.

> **Why Instagram is not in the core and never scraped.** Scraping Instagram
> violates Meta's ToS and is a legal grey area. The IG source is designed to
> work ONLY through the official Instagram Graph API for accounts a brand
> connects itself via OAuth (the "claim your profile" flow). For now it is just
> an interface + stub (`ingest/src/sources/instagram-source.ts`); the
> implementation comes later.

---

## Data model (Wix CMS collections)

| Collection | Purpose |
|---|---|
| `brands` | Brands: name, slug, site, feed, `gender`, `defaultCurrency`, `isFeatured`, `outboundClicks` |
| `products` | Normalized products. Uniqueness: `sourceKey = brandSlug:sourceType:externalId`. Carries `forMen`/`forWomen` flags |
| `categories` | The single taxonomy (13 top-level categories) |
| `categoryMappings` | `rawCategory → categorySlug` rules (global or per-brand) |
| `unmappedCategories` | Log of raw categories with no rule — for manual mapping |

Prices are stored in **minor units** (integer cents/kopecks) + ISO currency.

---

## Ingest pipeline

One pass per brand (`ingest/src/pipeline.ts`):

1. Source → `RawProduct[]`.
2. Map `rawCategory → categorySlug`; unmapped → `unmappedCategories`.
3. Set gender flags from the brand: `forMen`/`forWomen` (unisex → both).
4. Upsert into `products` in batches by the unique `sourceKey`.
5. Products missing from this (successful) pass → `availability = out_of_stock`.

Guarantees worth calling out:

- A single brand's failure is logged and does **not** fail the whole pass.
- Stale-marking (`out_of_stock`) runs **only** for brands whose feed was
  processed successfully — otherwise one dead feed would wrongly "kill" a
  brand's entire catalog.
- `fetchText` retries transient `429`/`5xx` with exponential backoff (Shopify
  throttles bursts).

### Category mapping

`CategoryMapper` resolves in three steps: exact rule (brand-specific > global),
then slash-separated parts (feeds like `"<uk>/T-Shirt"`), then a longest-keyword
contains-match (brands that dump the full product title into `product_type`).

---

## Monetization

**Featured brand** — a brand pays for prominent placement via
**Wix Pricing Plans + hosted checkout**:

- `/for-brands` reads the public plan and shows the tier.
- The button → `/subscribe?planId=…` creates a `createRedirectSession`
  (`@wix/redirects`) and 302-redirects to Wix hosted checkout.
- After payment Wix returns the visitor to `/thank-you`.

(The route is `/subscribe`, not `/checkout`, to avoid colliding with
`@wix/astro`'s built-in payment-links `/checkout` route.)

Featured brands appear in the featured-brands block on the home page and float
to the top within categories. This continues the future "claim your profile":
connecting Instagram becomes part of the paid tier.

**Outbound click counter** (`/out`) increments the brand's `outboundClicks` on
every click-through — the value we show brands, and the basis of the pitch on
`/for-brands`.

---

## Localization (uk / en)

Two locales. The locale lives in a `lang` cookie (clean URLs, persists across
pages); the `/set-lang` endpoint flips it and a UK/EN switch sits in the header.

- **UI chrome** — static dictionary in `src/lib/i18n.ts` (`useT(locale)`).
- **Categories** — `nameEn` field on the collection; `catName(cat, locale)`.
- **Brand descriptions** — `descriptionEn` field; `brandDesc(brand, locale)`.
- **Product titles are NOT translated** — they stay as the brand wrote them.
  ~60% are already English, and fashion names are brand identity; machine
  translation would degrade them. This matches how marketplaces handle it.

The home hero pun survives translation: "Знайди свій **крій**" → "Find your
**fit**" (both the accent word means cut *and* "your own thing").

## Gender

Each brand has a `gender` (`men` / `women` / `unisex`); products inherit it as
`forMen` / `forWomen` boolean flags (unisex → both). A strip under the header
lets the visitor switch all / women / men (`?g=men|women`), filtering
the category grid and the home-page counters with a plain `.eq()`.

---

## Running

Requires Node ≥ 20.11, a logged-in Wix CLI (`npx @wix/cli login`), and access
to Wix's internal npm registry (VPN).

```bash
npm install

# 1. Ingest products into the CMS
npm run ingest                        # all active brands
npm run ingest -- --brand keepstyle   # a single brand

# 2. Parser tests (YML + Google Merchant on fixtures)
npm run test:parsers

# 3. Local frontend dev
npm run dev                           # http://localhost:4321

# 4. Production build & publish
npm run build
npm run release                       # deploy to Wix
```

> **SSR routes (`/subscribe`, `/out`) under `wix dev`** are proxied to the
> site's canonical host, so an end-to-end checkout/redirect test only works
> **after `npm run release`**.

Periodic feed refresh for the event day — run `npm run ingest` manually or via a
GitHub Action cron.

---

## Layout

```
ingest/
  src/
    sources/
      source.ts              # ProductSource interface
      feed-source.ts         # FeedSource (phase 1) with retry/backoff
      instagram-source.ts    # InstagramSource (phase 2, stub)
      parsers/               # shopify-json, shopify-atom, yml, google-merchant, price
    pipeline.ts              # ingest core
    mapping.ts               # CategoryMapper (exact / slash / keyword)
    wix-data.ts              # REST client for Wix Data v2
    cli.ts                   # npm run ingest
    add-mappings.ts          # one-off admin script for category rules
    test-parsers.ts          # npm run test:parsers
  fixtures/                  # demo YML & Google Merchant feeds
src/
  lib/catalog.ts             # catalog reads from CMS (@wix/data), gender filter
  lib/plans.ts               # pricing-plan read
  pages/
    index.astro              # home: featured + categories
    c/[slug].astro           # category page (pagination + gender)
    for-brands.astro         # pitch + Featured brand tier
    subscribe.ts             # redirect to hosted checkout
    thank-you.astro          # success page
    out.ts                   # outbound-click redirector (UTM + counter)
  layouts/Layout.astro       # shell + gender strip
  styles/global.css          # "red thread" design system
```
