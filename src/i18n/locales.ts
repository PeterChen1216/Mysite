/**
 * The site's locales (owner decisions R3-1 and R3-4; docs/PLAN-EXPERIENCE.md §5): the one list
 * every other module reads. The key is the URL segment and the stored preference value; `lang`
 * is the exact BCP 47 tag for the `lang` attribute — a script subtag for Chinese, plus a region
 * for the Hong Kong Traditional edition. Only English is built today; X2 adds the others.
 */
export const LOCALES = {
  en: { lang: 'en', label: 'English' },
  'zh-hans': { lang: 'zh-Hans', label: '简体中文' },
  'zh-hant': { lang: 'zh-Hant-HK', label: '繁體中文' },
} as const;

export type Locale = keyof typeof LOCALES;

/** The locale of the pages built today (X2 builds one page per locale). */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * A well-formed BCP 47 language tag of the shapes this site uses: language, optional script,
 * optional region (`en`, `zh-Hans`, `zh-Hant-HK`, `en-GB`).
 */
export const LANG_TAG = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/;
