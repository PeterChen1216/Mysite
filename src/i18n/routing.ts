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
 * `https://zhic.me`): every live locale and `x-default`, the same on each live page. Empty on a
 * preview page, and while only one locale is live (there is nothing to alternate with).
 */
export function hreflangLinks(
  current: Locale,
  states: LocaleStates,
  origin: string,
  base = '/',
): Alternate[] {
  const live = liveLocales(states);
  if (states[current] !== 'live' || live.length < 2) return [];
  const url = (l: Locale) => new URL(localeHome(l, base), origin).href;
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
): HeadLinks {
  const hreflang = hreflangLinks(current, states, origin, base);
  return {
    canonical: new URL(localeHome(current, base), origin).href,
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
