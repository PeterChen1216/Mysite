/**
 * Highlights the nav link of the section currently in view (Figma shows the active link in
 * green). Progressive enhancement: without JS every link simply works as an anchor.
 */
export function initScrollSpy(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.nav__links a[href^="#"]')];
  const targets = links
    .map((a) => ({ a, el: document.getElementById(a.hash.slice(1)) }))
    .filter((t): t is { a: HTMLAnchorElement; el: HTMLElement } => t.el !== null);
  if (targets.length === 0) return;

  const visible = new Map<Element, number>();
  const update = () => {
    let best: HTMLAnchorElement | null = null;
    let bestRatio = 0;
    for (const t of targets) {
      const r = visible.get(t.el) ?? 0;
      if (r > bestRatio) {
        bestRatio = r;
        best = t.a;
      }
    }
    for (const t of targets) {
      if (t.a === best) t.a.setAttribute('aria-current', 'true');
      else t.a.removeAttribute('aria-current');
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) visible.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
      update();
    },
    { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1], rootMargin: '-20% 0px -50% 0px' },
  );
  for (const t of targets) io.observe(t.el);
}
