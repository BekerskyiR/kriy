import type { APIRoute } from "astro";
import { items } from "@wix/data";
import { auth } from "@wix/essentials";

const APP = "kriy";

/**
 * Outbound-click redirector: /out?b=<brandSlug>&u=<productUrl>
 *   1. increments the brand's outboundClicks (the value we show brands),
 *   2. appends a UTM tag,
 *   3. 302 to the brand's site.
 * The counter is best-effort: a failure must not block the redirect.
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
