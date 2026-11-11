/**
 * Pauses the endless CSS loops (cursor blinks, orbit rings, the ticker) while they are off
 * screen, so the browser stops drawing frames when nothing moving is in view. Elements marked
 * `data-loop` are watched directly; a `data-loop-host` (the ticker) pauses everything inside it.
 * The pause itself is one CSS rule in src/styles/motion.css. Globes do the same in globe.ts.
 */
export function initOffscreenPause(): void {
  // Always watched: motion can start later (the settings, reduced motion turned off).
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) delete (entry.target as HTMLElement).dataset.offscreen;
      else (entry.target as HTMLElement).dataset.offscreen = '';
    }
  });
  for (const el of document.querySelectorAll('[data-loop], [data-loop-host]')) io.observe(el);
}
