const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2024-07` → `Jul 2024`; `present` → `presentLabel` (copy.yaml `labels.present`). */
export function formatYearMonth(value: string, presentLabel?: string): string {
  if (value === 'present') {
    if (presentLabel === undefined) throw new Error('formatYearMonth: "present" needs a label');
    return presentLabel;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Not a YYYY-MM value: ${value}`);
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) throw new Error(`Month out of range: ${value}`);
  return `${month} ${match[1]}`;
}

/** `2024-07`, `2024-09` → `Jul 2024 – Sep 2024`; an ongoing end reads `presentLabel`. */
export function formatRange(start: string, end: string, presentLabel: string): string {
  return `${formatYearMonth(start, presentLabel)} – ${formatYearMonth(end, presentLabel)}`;
}

/** Newest first by `start` (YYYY-MM strings sort lexicographically). */
export function byStartDesc<T extends { start: string }>(a: T, b: T): number {
  return b.start.localeCompare(a.start);
}

/** `© 2025–2026` (or `© 2026` when equal). */
export function copyrightYears(start: number, current: number): string {
  return start >= current ? `© ${current}` : `© ${start}–${current}`;
}
