import type { APIRoute } from "astro";
import { redirects } from "@wix/redirects";
import { auth } from "@wix/essentials";

/**
 * Ініціює hosted checkout для pricing-plan і 302-редіректить на нього.
 * /checkout?planId=<id>
 *
 * createRedirectSession повертає повний URL Wix-checkout'а; після оплати
 * Wix поверне користувача на postFlowUrl (сторінка успіху).
 * Elevate — щоб виклик працював у контексті анонімного visitor'а.
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
