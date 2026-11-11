/**
 * How a page writes a month (copy.yaml `labels.months` and `labels.year_month`): month names,
 * January first, and a template with {month} and {year} (`{month} {year}`, `{year}年{month}`).
 * Interface words, so they come from the page's copy file and are never defaulted here.
 */
export interface DateWords {
  months: readonly string[];
  year_month: string;
}

/** `2024-07` → `Jul 2024` (in the page's words); `present` → `presentLabel` (`labels.present`). */
export function formatYearMonth(value: string, words: DateWords, presentLabel?: string): string {
  if (value === 'present') {
    if (presentLabel === undefined) throw new Error('formatYearMonth: "present" needs a label');
    return presentLabel;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Not a YYYY-MM value: ${value}`);
  const month = words.months[Number(match[2]) - 1];
  if (!month) throw new Error(`Month out of range: ${value}`);
  return words.year_month.replace(/\{\s*month\s*\}/g, month).replace(/\{\s*year\s*\}/g, match[1]!);
}

/** `2024-07`, `2024-09` → `Jul 2024 – Sep 2024`; an ongoing end reads `presentLabel`. */
export function formatRange(
  start: string,
  end: string,
  presentLabel: string,
  words: DateWords,
): string {
  return `${formatYearMonth(start, words, presentLabel)} – ${formatYearMonth(end, words, presentLabel)}`;
}

/** Newest first by `start` (YYYY-MM strings sort lexicographically). */
export function byStartDesc<T extends { start: string }>(a: T, b: T): number {
  return b.start.localeCompare(a.start);
}

/** `© 2025–2026` (or `© 2026` when equal). */
export function copyrightYears(start: number, current: number): string {
  return start >= current ? `© ${current}` : `© ${start}–${current}`;
}
