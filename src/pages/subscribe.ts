import type { APIRoute } from "astro";
import { redirects } from "@wix/redirects";
import { auth } from "@wix/essentials";

/**
 * Starts a hosted checkout for a pricing plan and 302-redirects to it.
 * /subscribe?planId=<id>
 *
 * createRedirectSession returns the full Wix checkout URL; after payment Wix
 * sends the visitor back to postFlowUrl (the thank-you page). Elevated so the
 * call works in an anonymous visitor context. Named /subscribe (not /checkout)
 * to avoid colliding with @wix/astro's built-in payment-links /checkout route.
 */
export const GET: APIRoute = async ({ url, redirect, request }) => {
  const planId = url.searchParams.get("planId");
  if (!planId) return new Response("Missing planId", { status: 400 });

  const origin = new URL(request.url).origin;

  try {
    const session = await auth.elevate(redirects.createRedirectSession)({
      paidPlansCheckout: { planId },
      callbacks: {
        postFlowUrl: `${origin}/thank-you`,
        thankYouPageUrl: `${origin}/thank-you`,
      },
    });
    const fullUrl = session.redirectSession?.fullUrl;
    if (!fullUrl) throw new Error("No redirect URL returned");
    return redirect(fullUrl, 302);
  } catch (e) {
    console.error("checkout redirect failed:", e);
    return new Response(
      "Не вдалося відкрити оплату. Спробуйте ще раз або напишіть нам.",
      { status: 502 },
    );
  }
};
