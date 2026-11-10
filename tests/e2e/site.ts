// Stage-aware paths shared by the E2E specs.
import { loadSiteConfig } from '../../site.config.mjs';
import { LOCALES, LOCALE_KEYS, type Locale, type LocaleState } from '../../src/i18n/locales';

const cfg = loadSiteConfig();
export const STAGE = cfg.stage;
/** Where the v2 site lives in the Pages artifact. */
export const V2 = cfg.base;

/** content/site.yaml `locales` as built. */
export const LOCALE_STATES = cfg.locales as Record<Locale, LocaleState>;

/** One page per locale (PLAN-EXPERIENCE §5.2), as the suites that run per locale visit it. */
export interface LocalePage {
  locale: Locale;
  /** The page's path in the Pages artifact (`/v2/zh-hans/`). */
  path: string;
  /** Its exact `lang` (`zh-Hant-HK`). */
  lang: string;
  state: LocaleState;
}

export const LOCALE_PAGES: LocalePage[] = LOCALE_KEYS.map((locale) => ({
  locale,
  path: `${V2}${LOCALES[locale].dir}`,
  lang: LOCALES[locale].lang,
  state: LOCALE_STATES[locale],
}));
