// Helpers for the post-login redirect (`/login?next=...`).

const AUTH_PAGES = new Set(["/login", "/register"]);

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.has(pathname);
}

/** Where the browser is now, query string included - what `next` should bring the player back to. */
export function currentPathWithQuery(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Scrolls to the element `id` when the URL's hash names it - for content that
 * moved after the browser scrolled to it, because it (or what is above it)
 * finished loading. Returns whether it scrolled.
 */
export function revealHashTarget(id: string): boolean {
  if (typeof window === "undefined" || window.location.hash !== `#${id}`) return false;
  const target = document.getElementById(id);
  target?.scrollIntoView();
  return !!target;
}

/**
 * Returns `raw` only when it is a path on this site. Anything that could leave
 * the origin - "//evil.example", "/\evil.example", an absolute URL - or that
 * points back at the sign-in pages falls back to `fallback`.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/lobby"): string {
  if (!raw || typeof window === "undefined") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || AUTH_PAGES.has(url.pathname)) return fallback;
    // Dot segments can normalise into a protocol-relative path: "/.//evil.example"
    // and "/a/..//evil.example" parse as this origin with the pathname
    // "//evil.example", which the router would then open as another site.
    if (url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * `/login` (or `/register`) that returns to `next` afterwards. `ended` says why
 * the last session ended, for the login page to explain.
 */
export function authHref(
  page: "/login" | "/register",
  next?: string | null,
  opts: { ended?: "expired" | "banned" | null } = {},
) {
  const params = new URLSearchParams();
  if (next && next !== "/" && !AUTH_PAGES.has(next.split("?")[0])) params.set("next", next);
  if (opts.ended) params.set(opts.ended, "1");
  const query = params.toString();
  return query ? `${page}?${query}` : page;
}
