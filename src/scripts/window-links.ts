/**
 * The few lines of the windows (M3) that load with the page: links that open a window — `more ▸`
 * and every project link (a title on the page, a row of the directory, a project's neighbours) —
 * and Back / Forward between window entries. The windows themselves (src/scripts/windows.ts) load
 * on first use, or as soon as a pointer or focus reaches a project link (its page is fetched then
 * too). A link opened in a new tab or with a modifier key is left to the browser, and if the
 * windows can't load, the link is simply followed: it is a link to the page.
 */
const html = document.documentElement;
const load = () => import('./windows');

export function initWindowLinks(): void {
  if (!document.querySelector('dialog[data-window-kind]')) return; // a page without windows
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    const a =
      e.target instanceof Element
        ? e.target.closest<HTMLAnchorElement>('a[data-window-open], a[data-project-link]')
        : null;
    if (!a || a.target) return;
    e.preventDefault();
    load().then(
      (m) => m.openFromLink(a),
      () => (location.href = a.href),
    );
  });
  addEventListener('popstate', (e) => {
    const ours = (e.state as { zhicWindows?: number } | null)?.zhicWindows === 1;
    if (ours || html.hasAttribute('data-window-open')) void load().then((m) => m.sync());
  });
  const warm = (e: Event) => {
    const a =
      e.target instanceof Element
        ? e.target.closest<HTMLAnchorElement>('a[data-project-link], a[data-window-open]')
        : null;
    if (!a) return;
    void load().then((m) => {
      if (a.hasAttribute('data-project-link')) m.prefetch(a.href);
    });
  };
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('focusin', warm);
}
