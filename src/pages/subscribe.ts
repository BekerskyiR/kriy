import type { APIRoute } from "astro";
import { redirects } from "@wix/redirects";

/**
 * Starts a hosted checkout for a pricing plan and 302-redirects to it.
 * /subscribe?planId=<id>
 *
 * createRedirectSession returns the full Wix checkout URL; after payment Wix
 * sends the visitor back to postFlowUrl (the thank-you page). Called in the
 * visitor/OAuth context @wix/astro provides — NOT elevated: a redirect session
 * is bound to the headless OAuth app's client id, which auth.elevate (site
 * context) does not carry ("client id does not correspond to a headless oauth
 * app"). Named /subscribe (not /checkout) to avoid colliding with @wix/astro's
 * built-in payment-links /checkout route.
 */
export const GET: APIRoute = async ({ url, redirect, request }) => {
  const planId = url.searchParams.get("planId");
  if (!planId) return new Response("Missing planId", { status: 400 });

  const origin = new URL(request.url).origin;

  try {
    const session = await redirects.createRedirectSession({
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
