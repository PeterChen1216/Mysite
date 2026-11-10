// Stage-aware paths shared by the E2E specs.
import type { Page } from '@playwright/test';
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

/**
 * English in Night at each graphics tier (PLAN-EXPERIENCE §7, acceptance F: "E2E runs the content
 * suite at each tier"; §9.1: each tier in Night/English). Tier 3 is the desktop scene: phones
 * never get it (DECISIONS Q2), so the mobile project skips it.
 */
export interface TierPage extends LocalePage {
  tier: 0 | 1 | 2 | 3;
}
export const TIER_PAGES: TierPage[] = ([0, 1, 2, 3] as const).map((tier) => ({
  ...LOCALE_PAGES[0]!,
  path: `${V2}?tier=${tier}`,
  tier,
}));

/**
 * Go to a page; at `?tier=3` also wait until the WebGL scene has replaced the DOM art, so the
 * test runs against the page as a tier 3 visitor sees it.
 */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  if (/[?&]tier=3\b/.test(path))
    await page.waitForFunction(() => document.documentElement.dataset.scene === 'live', null, {
      timeout: 20_000,
    });
}

/**
 * The key that opens the projects directory: Projects' `more ▸`, or on a phone (X4) `list all ▸`
 * under the carousel (the header's `more ▸` makes way for it there).
 */
export const directoryKey = (page: Page) =>
  page.locator('#projects .sh__more:visible, #projects .carousel__all:visible').first();
