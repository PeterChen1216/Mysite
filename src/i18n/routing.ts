/**
 * Where each locale lives and which locales a page lists (PLAN-EXPERIENCE §5.2; ADR-017). Pure:
 * every function takes the site's base path, so the build and the tests share them.
 *
 * - English is at the base (`/` after launch, `/v2/` in preview), the others under it
 *   (`/zh-hans/`, `/zh-hant/`). There is no `/zh/`.
 * - A `live` page lists the live locales: `hreflang` alternates (with `x-default` = English,
 *   when there is more than one live locale) and the language switch.
 * - A `preview` page is for its owner to read: `noindex`, no hreflang, and a language switch
 *   that lists every locale, so the other drafts are one click away.
 */
import { DEFAULT_LOCALE, LOCALES, LOCALE_KEYS, type Locale, type LocaleStates } from './locales.ts';

/** A locale's home page under `base` (`/v2/zh-hans/`). */
export function localeHome(locale: Locale, base = '/'): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${LOCALES[locale].dir}`;
}

/**
 * The pages of a locale besides its home (M3; PLAN §4.1): the projects directory and one page per
 * project. `sub` is the path below the locale's home: `''` (home), `projects/`,
 * `projects/clock-stamp/`. Every page exists in every locale.
 */
export type SitePage = { kind: 'home' } | { kind: 'projects' } | { kind: 'project'; id: string };

/** A project id as content/projects/<id>.md names it: lower-case words joined by hyphens. */
export const PROJECT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The path of a page below its locale's home (`projects/clock-stamp/`). */
export function pageSub(page: SitePage): string {
  if (page.kind === 'home') return '';
  if (page.kind === 'projects') return 'projects/';
  if (!PROJECT_ID.test(page.id)) throw new Error(`not a project id: "${page.id}"`);
  return `projects/${page.id}/`;
}

/** A page of a locale under `base` (`/v2/zh-hans/projects/clock-stamp/`). */
export const pagePath = (locale: Locale, page: SitePage, base = '/'): string =>
  `${localeHome(locale, base)}${pageSub(page)}`;

/**
 * Which page of the site a URL path is (`/v2/zh-hant/projects/clock-stamp/` → zh-hant, that
 * project), or null when it is none of them (outside the base, an unknown path, `/zh/`). A path
 * without its trailing slash, or ending in `index.html`, is the same page.
 */
export function routeOf(pathname: string, base = '/'): { locale: Locale; page: SitePage } | null {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const path = pathname.replace(/index\.html$/, '');
  if (!`${path}/`.startsWith(prefix)) return null;
  const parts = path.slice(prefix.length).split('/').filter(Boolean);
  let locale: Locale = DEFAULT_LOCALE;
  const first = parts[0];
  const named = LOCALE_KEYS.find((l) => l !== DEFAULT_LOCALE && LOCALES[l].dir === `${first}/`);
  if (named) {
    locale = named;
    parts.shift();
  }
  if (parts.length === 0) return { locale, page: { kind: 'home' } };
  if (parts[0] !== 'projects' || parts.length > 2) return null;
  if (parts.length === 1) return { locale, page: { kind: 'projects' } };
  return PROJECT_ID.test(parts[1]!) ? { locale, page: { kind: 'project', id: parts[1]! } } : null;
}

/** The live locales, in LOCALES order. */
export const liveLocales = (states: LocaleStates): Locale[] =>
  LOCALE_KEYS.filter((l) => states[l] === 'live');

/** The locales the language switch of a page in `current` offers. */
export function switchLocales(current: Locale, states: LocaleStates): Locale[] {
  return states[current] === 'preview' ? [...LOCALE_KEYS] : liveLocales(states);
}

export interface Alternate {
  hreflang: string;
  href: string;
}

/**
 * The `<link rel="alternate" hreflang>` set of a page (absolute URLs; `origin` like
 * `https://zhic.me`): the same page in every live locale and `x-default`, the same on each live
 * page. Empty on a preview page, and while only one locale is live (nothing to alternate with).
 */
export function hreflangLinks(
  current: Locale,
  states: LocaleStates,
  origin: string,
  base = '/',
  page: SitePage = { kind: 'home' },
): Alternate[] {
  const live = liveLocales(states);
  if (states[current] !== 'live' || live.length < 2) return [];
  const url = (l: Locale) => new URL(pagePath(l, page, base), origin).href;
  return [
    ...live.map((l) => ({ hreflang: LOCALES[l].hreflang, href: url(l) })),
    { hreflang: 'x-default', href: url(DEFAULT_LOCALE) },
  ];
}

/** What a page's `<head>` says about its language: canonical, robots, hreflang and Open Graph. */
export interface HeadLinks {
  canonical: string;
  /** `noindex` on a preview page. */
  robots?: string | undefined;
  hreflang: Alternate[];
  ogLocale: string;
  ogAlternates: string[];
}

export function headLinks(
  current: Locale,
  states: LocaleStates,
  origin: string,
  base = '/',
  page: SitePage = { kind: 'home' },
): HeadLinks {
  const hreflang = hreflangLinks(current, states, origin, base, page);
  return {
    canonical: new URL(pagePath(current, page, base), origin).href,
    robots: states[current] === 'preview' ? 'noindex' : undefined,
    hreflang,
    ogLocale: LOCALES[current].og,
    ogAlternates:
      hreflang.length > 0
        ? liveLocales(states)
            .filter((l) => l !== current)
            .map((l) => LOCALES[l].og)
        : [],
  };
}

/**
 * A browser language as one of the site's locales (PLAN-EXPERIENCE §5.2): Traditional for
 * `zh-Hant*`, `zh-TW`, `zh-HK`, `zh-MO`; Simplified for `zh-Hans*`, `zh-CN`, `zh-SG`, `zh-MY` and
 * bare `zh`; English for `en*`; anything else is not one of them.
 */
export function mapLanguage(tag: string): Locale | undefined {
  const t = tag.trim().toLowerCase();
  if (/^zh-hant\b/.test(t) || /^zh-(?:tw|hk|mo)\b/.test(t)) return 'zh-hant';
  if (/^zh-hans\b/.test(t) || /^zh-(?:cn|sg|my)\b/.test(t) || t === 'zh') return 'zh-hans';
  if (/^en\b/.test(t)) return 'en';
  return undefined;
}

/**
 * The first-visit suggestion: the first of the browser's languages (in order) that maps to a live
 * locale decides. When that is the page's own language nothing is suggested; a locale that is not
 * live is never suggested (the next language is tried). It never redirects: it only offers a link.
 */
export function suggestLocale(
  languages: readonly string[],
  current: Locale,
  live: readonly Locale[],
): Locale | undefined {
  for (const tag of languages) {
    const locale = mapLanguage(tag);
    if (!locale || !live.includes(locale)) continue; // unknown, or not ready to be offered
    return locale === current ? undefined : locale;
  }
  return undefined;
}
