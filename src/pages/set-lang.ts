import type { APIRoute } from "astro";

/**
 * Language switch: /set-lang?to=en&back=/c/futbolky
 * Persists the locale in a cookie and redirects back to where the user was.
 * Cookie-based so URLs stay clean and the choice sticks across pages.
 */
export const GET: APIRoute = ({ url, cookies, redirect }) => {
  const to = url.searchParams.get("to") === "en" ? "en" : "uk";
  const back = url.searchParams.get("back") || "/";
  // only allow same-site relative paths as the return target
  const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  cookies.set("lang", to, { path: "/", maxAge: 60 * 60 * 24 * 365, httpOnly: false, sameSite: "lax" });
  return redirect(safeBack, 302);
};
