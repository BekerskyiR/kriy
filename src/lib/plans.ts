import { plans } from "@wix/pricing-plans";
import { auth } from "@wix/essentials";

/**
 * Public pricing plans for the /for-brands page.
 * Elevated so an anonymous visitor reliably sees the public plans.
 */
export interface FeaturedPlan {
  _id: string;
  name: string;
  description?: string;
  priceText: string; // UI string, e.g. "29 EUR / міс"
  perks: string[];
}

export async function getFeaturedPlan(): Promise<FeaturedPlan | null> {
  try {
    const res = await auth.elevate(plans.listPublicPlans)({});
    const list = res.plans ?? [];
    const p = list.find((x: any) => x.name?.includes("Featured")) ?? list[0];
    if (!p) return null;
    const pricing = p.pricing?.price ?? p.pricing?.subscription;
    const amount = pricing?.value ?? p.price?.value ?? "";
    const currency = pricing?.currency ?? p.price?.currency ?? "";
    return {
      _id: p._id!,
      name: p.name!,
      description: p.description ?? undefined,
      priceText: amount ? `${amount} ${currency} / міс` : "—",
      perks: (p.perks?.values ?? p.perks ?? []).map((v: any) => (typeof v === "string" ? v : v.description)).filter(Boolean),
    };
  } catch (e) {
    console.error("getFeaturedPlan failed:", e);
    return null;
  }
}
