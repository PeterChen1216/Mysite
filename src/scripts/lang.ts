/**
 * Languages in the browser (PLAN-EXPERIENCE §5.2). Each language is its own static page; this
 * only enhances the links between them:
 * - a language link (the settings window's row, the suggestion) keeps the section in view, and
 *   following one saves the choice (prefs `lang`), so no suggestion is made again;
 * - the first-visit suggestion (src/components/sections/LangSuggest.astro): while the visitor has
 *   not chosen (`lang: auto`), the browser's languages may pick another live locale, whose
 *   one-line banner is shown. Dismissing it keeps this page's language as the choice. It never
 *   redirects.
 */
import { isLocale, type Locale } from '../i18n/locales';
import { suggestLocale } from '../i18n/routing';
import { getPrefs, setPrefs } from './prefs';

/** The section in view, as the nav's scroll spy marks it (`#projects`), or none. */
export function currentSection(): string {
  const a = document.querySelector<HTMLAnchorElement>('.nav__links a[aria-current="true"]');
  return a?.hash ?? '';
}

/** Point a language link at the same section on its page. */
export function keepPlace(link: HTMLAnchorElement): void {
  link.hash = currentSection();
}

export function initLang(): void {
  const html = document.documentElement;
  const current = html.dataset.locale;
  if (!isLocale(current)) return;

  // Following any language link: same section there, and remembered as the visitor's choice.
  document.addEventListener('click', (e) => {
    const link = e.target instanceof Element ? e.target.closest('a[data-lang-pick]') : null;
    if (!(link instanceof HTMLAnchorElement)) return;
    const locale = link.dataset.langPick;
    if (isLocale(locale)) setPrefs({ lang: locale });
    keepPlace(link);
  });

  const banners = [...document.querySelectorAll<HTMLElement>('[data-lang-suggest]')];
  if (banners.length === 0 || getPrefs().lang !== 'auto') return;
  // The banners are exactly the other live locales; this page's own language stops the search.
  const offered = banners.map((b) => b.dataset.langSuggest).filter(isLocale);
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const pick = suggestLocale(languages, current, [current, ...offered] as Locale[]);
  const banner = banners.find((b) => b.dataset.langSuggest === pick);
  if (!banner) return;
  banner.querySelector('[data-lang-dismiss]')?.addEventListener('click', () => {
    setPrefs({ lang: current });
    banner.hidden = true;
  });
  // A suggestion can wait until the page has painted and settled: shown when the browser is
  // idle, it never competes with the first screen (Lighthouse measured LCP 0.5 s later when it
  // appeared at once).
  const show = () => (banner.hidden = false);
  if ('requestIdleCallback' in window) requestIdleCallback(show, { timeout: 2000 });
  else setTimeout(show, 1000);
}
