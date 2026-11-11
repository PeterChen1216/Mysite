/**
 * The site's locales (owner decisions R3-1 and R3-4; docs/PLAN-EXPERIENCE.md §5): the one list
 * every other module reads. The key is the URL segment and the stored preference value.
 *
 * - `lang`: the exact BCP 47 tag for the `lang` attribute — a script subtag for Chinese, plus a
 *   region for the Hong Kong Traditional edition (browsers pick Hong Kong glyph forms from it).
 * - `hreflang`: what search engines are told (`zh-Hant`, not `zh-Hant-HK`: it is the only
 *   Traditional edition, so readers in Taiwan and Macau are offered it too).
 * - `og`: the Open Graph locale (`language_TERRITORY`).
 * - `dir`: the path under the site's base (`''` for English at the root, `zh-hans/` …).
 *
 * Each language's own name (English · 简体中文 · 繁體中文) is interface text: it lives in that
 * language's copy file, `i18n.name`. Pure and import-free so Node scripts can load it too.
 */
export const LOCALES = {
  en: { lang: 'en', hreflang: 'en', og: 'en_US', dir: '' },
  'zh-hans': { lang: 'zh-Hans', hreflang: 'zh-Hans', og: 'zh_CN', dir: 'zh-hans/' },
  'zh-hant': { lang: 'zh-Hant-HK', hreflang: 'zh-Hant', og: 'zh_HK', dir: 'zh-hant/' },
} as const;

export type Locale = keyof typeof LOCALES;

/** English: the source language, at the site's root, and `x-default`. */
export const DEFAULT_LOCALE = 'en' satisfies Locale;

/** Every locale, in the order of LOCALES (the order the language switch lists them). */
export const LOCALE_KEYS = Object.keys(LOCALES) as Locale[];

/** The locales that are translations of English. */
export const TRANSLATED_LOCALES = LOCALE_KEYS.filter(
  (l): l is Exclude<Locale, typeof DEFAULT_LOCALE> => l !== DEFAULT_LOCALE,
);
export type TranslatedLocale = (typeof TRANSLATED_LOCALES)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && Object.hasOwn(LOCALES, value);

/**
 * content/site.yaml `locales`: a `live` locale is listed (hreflang, the language switch, search
 * engines); a `preview` one is built at its address for the owner to read, but carries noindex,
 * is listed nowhere and shows a "draft translation" notice. English is always live.
 */
export const LOCALE_STATES = ['live', 'preview'] as const;
export type LocaleState = (typeof LOCALE_STATES)[number];
export type LocaleStates = Record<Locale, LocaleState>;

/**
 * A well-formed BCP 47 language tag of the shapes this site uses: language, optional script,
 * optional region (`en`, `zh-Hans`, `zh-Hant-HK`, `en-GB`).
 */
export const LANG_TAG = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/;
