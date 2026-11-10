/**
 * Content that appears on hover or focus can be dismissed without moving the pointer or focus
 * (WCAG 1.4.13): Escape hides it until the pointer leaves or focus moves on. Used by the player
 * card, whose real photo replaces the pixel portrait while hovered or focused (HeroStage.astro);
 * the CSS keys on `data-dismissed`.
 */
export function initDismissible(): void {
  const hosts = [...document.querySelectorAll<HTMLElement>('[data-hover-reveal]')];
  if (hosts.length === 0) return;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    for (const host of hosts)
      if (host.matches(':hover') || host.matches(':focus-visible')) host.dataset.dismissed = '';
  });
  for (const host of hosts) {
    const reset = () => delete host.dataset.dismissed;
    host.addEventListener('pointerleave', reset);
    host.addEventListener('blur', reset);
  }
}
