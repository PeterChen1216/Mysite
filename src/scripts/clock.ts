/**
 * Live clock for the decorative phone mock-up on the featured project (Clock Stamp is a
 * world-clock app). Elements: `data-clock="time"` → 09:41, `data-clock="date"` → WED 2026-11-09,
 * in the time zone given by `data-tz` (default Seattle).
 */
export function initClocks(): void {
  const els = [...document.querySelectorAll<HTMLElement>('[data-clock]')];
  if (els.length === 0) return;

  const update = () => {
    const now = new Date();
    for (const el of els) {
      const timeZone = el.dataset.tz ?? 'America/Los_Angeles';
      if (el.dataset.clock === 'time') {
        el.textContent = new Intl.DateTimeFormat('en-GB', {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(now);
      } else if (el.dataset.clock === 'date') {
        const parts = Object.fromEntries(
          new Intl.DateTimeFormat('en-US', {
            timeZone,
            weekday: 'short',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
            .formatToParts(now)
            .map((p) => [p.type, p.value]),
        );
        el.textContent = `${parts.weekday?.toUpperCase()} ${parts.year}-${parts.month}-${parts.day}`;
      }
    }
  };
  update();
  setInterval(update, 15_000);
}
