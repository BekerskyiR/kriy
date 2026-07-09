import type { APIRoute } from "astro";
import { items } from "@wix/data";
import { auth } from "@wix/essentials";

const APP = "svoye";

/**
 * Редіректор вихідних кліків: /out?b=<brandSlug>&u=<productUrl>
 *   1. інкрементує outboundClicks бренда (цінність для бренда в цифрах),
 *   2. додає UTM-мітку,
 *   3. 302 на сайт бренда.
 * Лічильник — best-effort: помилка не має завадити переходу.
 */
export const GET: APIRoute = async ({ url, redirect }) => {
  const brandSlug = url.searchParams.get("b") ?? "";
  const target = url.searchParams.get("u") ?? "";

  if (!target || !/^https?:\/\//.test(target)) {
    return new Response("Bad target", { status: 400 });
  }

  if (brandSlug) {
    try {
      const { items: found } = await auth
        .elevate(items.query)("brands")
        .eq("slug", brandSlug)
        .limit(1)
        .find();
      const brand = found[0];
      if (brand) {
        await auth.elevate(items.update)("brands", {
          ...brand,
          outboundClicks: (brand.outboundClicks ?? 0) + 1,
        });
      }
    } catch (e) {
      console.error("outbound click increment failed:", e);
    }
  }

  const dest = new URL(target);
  if (!dest.searchParams.has("utm_source")) {
    dest.searchParams.set("utm_source", APP);
    dest.searchParams.set("utm_medium", "referral");
  }
  return redirect(dest.toString(), 302);
};
