/** The part of `document` the title flash uses (a stand-in in tests). */
export type TitleDocument = Pick<Document, "title" | "hidden" | "addEventListener" | "removeEventListener">;

/**
 * Catches the eye of a player who is in another tab: alternates the tab title
 * between `message` and the page's own title until the tab is shown, `until`
 * (a Date.now() time) passes or the returned function is called, then puts
 * the page's title back. Does nothing while the tab is visible. No sound and
 * no notification permission prompt.
 */
export function flashTitle(
  message: string,
  { until, intervalMs = 1_000, doc }: { until?: number; intervalMs?: number; doc?: TitleDocument } = {},
): () => void {
  const target = doc ?? (typeof document === "undefined" ? null : document);
  if (!target || !target.hidden) return () => {};
  const page: TitleDocument = target;

  // The page's own title. A navigation may change it while the message
  // shows: whatever title is not the message is the one to restore.
  let pageTitle = page.title;
  let stopped = false;

  const tick = () => {
    if (until !== undefined && Date.now() >= until) {
      stop();
      return;
    }
    if (page.title === message) {
      page.title = pageTitle;
    } else {
      pageTitle = page.title;
      page.title = message;
    }
  };
  const onVisibilityChange = () => {
    if (!page.hidden) stop();
  };
  const timer = setInterval(tick, intervalMs);

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    page.removeEventListener("visibilitychange", onVisibilityChange);
    if (page.title === message) page.title = pageTitle;
  }

  page.addEventListener("visibilitychange", onVisibilityChange);
  page.title = message;
  return stop;
}
