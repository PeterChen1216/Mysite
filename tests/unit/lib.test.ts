import { describe, expect, it } from 'vitest';
import { formatVersion, parseStamp } from '../../src/lib/build-info';
import { byStartDesc, copyrightYears, formatRange, formatYearMonth } from '../../src/lib/format';
import { withBase } from '../../src/lib/paths';

/** copy.yaml `labels` month words as shipped, and copy.zh-hans.yaml's. */
const EN = {
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  year_month: '{month} {year}',
};
const ZH = {
  months: Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
  year_month: '{year}年{month}',
};

describe('format', () => {
  it('formats YYYY-MM in the page’s words', () => {
    expect(formatYearMonth('2024-07', EN)).toBe('Jul 2024');
    expect(formatYearMonth('2027-06', EN)).toBe('Jun 2027');
    expect(formatYearMonth('2027-03', ZH)).toBe('2027年3月');
    expect(formatYearMonth('present', EN, 'Present')).toBe('Present');
    // An ongoing end always needs the copy.yaml label: no built-in English.
    expect(() => formatYearMonth('present', EN)).toThrow(/needs a label/);
  });
  it('rejects malformed values', () => {
    expect(() => formatYearMonth('2024-7', EN)).toThrow();
    expect(() => formatYearMonth('2024-13', EN)).toThrow();
  });
  it('formats ranges', () => {
    expect(formatRange('2024-07', '2024-09', 'Present', EN)).toBe('Jul 2024 – Sep 2024');
    expect(formatRange('2026-03', 'present', 'ongoing', EN)).toBe('Mar 2026 – ongoing');
    expect(formatRange('2026-03', 'present', '至今', ZH)).toBe('2026年3月 – 至今');
  });
  it('sorts newest first', () => {
    const items = [{ start: '2023-09' }, { start: '2025-01' }, { start: '2024-07' }];
    expect(items.sort(byStartDesc).map((i) => i.start)).toEqual(['2025-01', '2024-07', '2023-09']);
  });
  it('copyright years', () => {
    expect(copyrightYears(2025, 2026)).toBe('© 2025–2026');
    expect(copyrightYears(2026, 2026)).toBe('© 2026');
  });
});

describe('build-info', () => {
  it('parses git log output', () => {
    expect(parseStamp('2026-11-09 a1b2c3d\n')).toEqual({ date: '2026-11-09', hash: 'a1b2c3d' });
    expect(parseStamp('')).toBeNull();
    expect(parseStamp('fatal: not a git repository')).toBeNull();
  });
  it('formats the version like vX.Y.Z+YYYYMMDD.hash', () => {
    expect(formatVersion('0.1.0', { date: '2026-11-09', hash: 'a1b2c3d' })).toBe(
      'v0.1.0+20261109.a1b2c3d',
    );
  });
});

describe('withBase', () => {
  it('joins with and without trailing slashes', () => {
    expect(withBase('resume.pdf', '/')).toBe('/resume.pdf');
    expect(withBase('/resume.pdf', '/v2/')).toBe('/v2/resume.pdf');
    expect(withBase('resume.pdf', '/v2')).toBe('/v2/resume.pdf');
  });
});

describe('contentStamp', () => {
  it('reads the last content/ commit from git', async () => {
    const { contentStamp } = await import('../../src/lib/build-info');
    const stamp = contentStamp(new Date('2030-01-02T00:00:00Z'));
    expect(stamp.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // In a checkout with committed content this is a hash; before the first commit it falls back.
    expect(stamp.hash === 'local' ? stamp.date : stamp.hash).toMatch(
      /^([0-9a-f]{4,40}|2030-01-02)$/,
    );
  });
});
