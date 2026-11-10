// M3 pages: each project's own page and the projects directory in every locale and under any base
// (src/i18n/routing.ts), the 404's choice of language and of "home" (src/lib/not-found.ts), and the
// helpers that build a project's page from its frontmatter (projects-view.ts).
import { describe, expect, it } from 'vitest';
import {
  neighbours,
  pageDescription,
  projectBlock,
  projectView,
  type Project,
  type ProjectLabels,
  type ProjectsCopy,
} from '../../src/components/sections/projects-view';
import { LOCALES, LOCALE_KEYS, type LocaleStates } from '../../src/i18n/locales';
import {
  headLinks,
  hreflangLinks,
  pagePath,
  pageSub,
  routeOf,
  type SitePage,
} from '../../src/i18n/routing';
import { notFoundBoot, notFoundScript, shownPath } from '../../src/lib/not-found';

const PREVIEW: LocaleStates = { en: 'live', 'zh-hans': 'preview', 'zh-hant': 'preview' };
const LIVE: LocaleStates = { en: 'live', 'zh-hans': 'live', 'zh-hant': 'live' };
const CLOCK: SitePage = { kind: 'project', id: 'clock-stamp' };

describe('page paths per locale and base', () => {
  it('home, the directory and a project, under / and the /v2/ preview', () => {
    expect(pagePath('en', { kind: 'home' }, '/v2/')).toBe('/v2/');
    expect(pagePath('en', { kind: 'projects' }, '/v2/')).toBe('/v2/projects/');
    expect(pagePath('en', CLOCK, '/v2/')).toBe('/v2/projects/clock-stamp/');
    expect(pagePath('zh-hans', CLOCK, '/v2')).toBe('/v2/zh-hans/projects/clock-stamp/');
    expect(pagePath('zh-hant', { kind: 'projects' }, '/')).toBe('/zh-hant/projects/');
    expect(pagePath('en', CLOCK)).toBe('/projects/clock-stamp/');
  });
  it('a project id is a file name: lower-case words and hyphens', () => {
    expect(pageSub({ kind: 'project', id: 'x-community-notes' })).toBe(
      'projects/x-community-notes/',
    );
    expect(() => pageSub({ kind: 'project', id: '../etc' })).toThrow();
    expect(() => pageSub({ kind: 'project', id: 'Clock Stamp' })).toThrow();
  });
  it('a path back to its page: every page of every locale, and nothing else', () => {
    for (const base of ['/', '/v2/'])
      for (const locale of LOCALE_KEYS)
        for (const page of [{ kind: 'home' }, { kind: 'projects' }, CLOCK] as SitePage[])
          expect(routeOf(pagePath(locale, page, base), base)).toEqual({ locale, page });
    expect(routeOf('/v2/projects/clock-stamp', '/v2/')).toEqual({ locale: 'en', page: CLOCK });
    expect(routeOf('/v2/projects/clock-stamp/index.html', '/v2/')).toEqual({
      locale: 'en',
      page: CLOCK,
    });
    expect(routeOf('/v2', '/v2/')).toEqual({ locale: 'en', page: { kind: 'home' } });
    expect(routeOf('/projects/clock-stamp/', '/v2/')).toBeNull(); // outside the preview
    expect(routeOf('/v2/zh/projects/', '/v2/')).toBeNull(); // there is no /zh/
    expect(routeOf('/v2/projects/a/b/', '/v2/')).toBeNull();
    expect(routeOf('/v2/projects/Not_An_Id/', '/v2/')).toBeNull();
    expect(routeOf('/v2/resume.pdf', '/v2/')).toBeNull();
  });
});

describe('head links of a project page', () => {
  const origin = 'https://zhic.me';
  it('its own canonical; its alternates are the same project in each live locale', () => {
    const head = headLinks('zh-hant', LIVE, origin, '/', CLOCK);
    expect(head.canonical).toBe('https://zhic.me/zh-hant/projects/clock-stamp/');
    expect(head.robots).toBeUndefined();
    expect(head.hreflang).toEqual([
      { hreflang: 'en', href: 'https://zhic.me/projects/clock-stamp/' },
      { hreflang: 'zh-Hans', href: 'https://zhic.me/zh-hans/projects/clock-stamp/' },
      { hreflang: 'zh-Hant', href: 'https://zhic.me/zh-hant/projects/clock-stamp/' },
      { hreflang: 'x-default', href: 'https://zhic.me/projects/clock-stamp/' },
    ]);
  });
  it('a preview locale stays noindex and out of every alternate set', () => {
    expect(headLinks('zh-hans', PREVIEW, origin, '/v2/', CLOCK)).toEqual({
      canonical: 'https://zhic.me/v2/zh-hans/projects/clock-stamp/',
      robots: 'noindex',
      hreflang: [],
      ogLocale: 'zh_CN',
      ogAlternates: [],
    });
    expect(hreflangLinks('en', PREVIEW, origin, '/v2/', { kind: 'projects' })).toEqual([]);
    const partial: LocaleStates = { en: 'live', 'zh-hans': 'live', 'zh-hant': 'preview' };
    expect(
      hreflangLinks('en', partial, origin, '/', { kind: 'projects' }).map((a) => a.href),
    ).toEqual([
      'https://zhic.me/projects/',
      'https://zhic.me/zh-hans/projects/',
      'https://zhic.me/projects/',
    ]);
  });
});

describe('the 404 speaks the language of the address', () => {
  const dirs = Object.fromEntries(LOCALE_KEYS.map((l) => [l, LOCALES[l].dir]));
  const langs = Object.fromEntries(LOCALE_KEYS.map((l) => [l, LOCALES[l].lang]));
  const html = () => {
    const attrs = new Map<string, string>();
    return {
      attrs,
      el: {
        setAttribute: (k: string, v: string) => attrs.set(k, v),
      } as unknown as HTMLElement,
    };
  };
  it('a locale folder picks its language; anything else is English', () => {
    for (const [path, locale, lang] of [
      ['/v2/zh-hant/nope/', 'zh-hant', 'zh-Hant-HK'],
      ['/v2/zh-hans/projects/missing/', 'zh-hans', 'zh-Hans'],
      ['/v2/zh-hansx', 'en', 'en'],
      ['/v2/whatever', 'en', 'en'],
      ['/v2/zh/', 'en', 'en'],
    ] as const) {
      const h = html();
      expect(notFoundBoot('/v2/', dirs, langs, path, h.el)).toEqual({ locale, inside: true });
      expect(h.attrs.get('lang')).toBe(lang);
      expect(h.attrs.get('data-locale')).toBe(locale);
      expect(h.attrs.has('data-nf-outside')).toBe(false);
    }
  });
  it('before launch, an address outside /v2/ belongs to the old site (home is the root)', () => {
    const h = html();
    expect(notFoundBoot('/v2', dirs, langs, '/zh-hans/old', h.el)).toEqual({
      locale: 'en',
      inside: false,
    });
    expect(h.attrs.get('data-nf-outside')).toBe('');
    // After launch the base is the root: every address is inside.
    expect(notFoundBoot('/', dirs, langs, '/zh-hans/old', html().el).inside).toBe(true);
  });
  it('the inline script is the same function, called with this build', () => {
    const script = notFoundScript('/v2/', dirs, langs);
    expect(script).toContain(notFoundBoot.toString());
    expect(script).toContain('"/v2/"');
    expect(script).toContain('"zh-Hant-HK"');
    const h = html();
    // Run it as the browser would (it reads location and document when not given them).
    const run = new Function('location', 'document', script);
    run({ pathname: '/v2/zh-hant/x' }, { documentElement: h.el });
    expect(h.attrs.get('data-locale')).toBe('zh-hant');
  });
  it('shows the address it was asked for: decoded, without control characters, its end kept', () => {
    expect(shownPath('/v2/%E4%B8%AD/x')).toBe('/v2/中/x');
    expect(shownPath('/v2/%E4%B8')).toBe('/v2/%E4%B8');
    expect(shownPath('/a\u0007b')).toBe('/ab');
    const long = `/v2/${'a'.repeat(100)}/end`;
    expect(shownPath(long, 20)).toBe(`…${long.slice(long.length - 19)}`);
    expect(shownPath(long, 20)).toHaveLength(20);
  });
});

describe("a project's page from its frontmatter", () => {
  const labels = {
    present: 'Present',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    year_month: '{month} {year}',
    list_separator: ', ',
    platform: { ios: 'iOS', web: 'Web', cli: 'CLI', research: 'Research' },
    status: {
      idea: 'idea',
      wip: 'in progress',
      testflight: 'TestFlight',
      shipped: 'shipped',
      completed: 'completed',
      archived: 'archived',
    },
  } as ProjectLabels;
  const copy = { stack_label: 'Stack:' } as ProjectsCopy;
  const p = (over: Partial<Project>) =>
    ({
      id: 'x',
      title: 'X',
      status: 'shipped',
      platform: ['web'],
      year: 2025,
      stack: [],
      featured: false,
      ...over,
    }) as unknown as Project;
  it('its block by its first platform (generic blocks: no icons were supplied)', () => {
    expect(projectBlock(p({ platform: ['ios'] }))).toBe('command');
    expect(projectBlock(p({ platform: ['web', 'ios'] }))).toBe('terminal');
    expect(projectBlock(p({ platform: ['research'] }))).toBe('bookshelf');
    expect(projectBlock(p({ platform: ['cli'] }))).toBe('obsidian');
    expect(projectBlock(p({ platform: [] }))).toBe('gold');
  });
  it("the directory's line: tagline, year and status — only what the file says", () => {
    expect(projectView(p({ tagline: 'Independent iOS Application' }), copy, labels).line).toBe(
      'Independent iOS Application · 2025 · shipped',
    );
    expect(projectView(p({}), copy, labels).line).toBe('2025 · shipped');
  });
  it('neighbours in the page order', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(neighbours(list, 'a')).toEqual({ prev: undefined, next: { id: 'b' } });
    expect(neighbours(list, 'b')).toEqual({ prev: { id: 'a' }, next: { id: 'c' } });
    expect(neighbours(list, 'c')).toEqual({ prev: { id: 'b' }, next: undefined });
    expect(neighbours(list, 'z')).toEqual({});
  });
  it("the page's description is the tagline, else the body's first line, else the site's", () => {
    expect(pageDescription({ tagline: 'Independent iOS Application', body: '- x' }, 'S')).toBe(
      'Independent iOS Application',
    );
    expect(
      pageDescription({ body: '\n<!-- note -->\n- Created a **map** of `classes`\n- two' }, 'S'),
    ).toBe('Created a map of classes');
    expect(pageDescription({ body: '' }, 'Site')).toBe('Site');
    expect(pageDescription({ tagline: 'a'.repeat(200) }, 'S', 20)).toBe(`${'a'.repeat(19)}…`);
  });
});
