// Languages (PLAN-EXPERIENCE §5; ADR-017): the three locales' routes and head links, the preview
// state, the language row, the first-visit suggestion, the script of every Han character, English
// fallbacks marked as English, the pixel CJK face per locale, and layout shift per locale.
import { expect, test, type Page } from '@playwright/test';
import { loadSiteConfig } from '../../site.config.mjs';
import { wrongScript } from '../../src/i18n/han-script';
import { LOCALES, type Locale } from '../../src/i18n/locales';
import { hreflangLinks, liveLocales, suggestLocale, switchLocales } from '../../src/i18n/routing';
import { contentFor, languageName } from './locale';
import { LOCALE_PAGES, LOCALE_STATES, V2 } from './site';

const ORIGIN = `https://${loadSiteConfig().domain}`;
const KEY = 'zhic:prefs:v1';
const pageOf = (locale: Locale) => LOCALE_PAGES.find((p) => p.locale === locale)!;

/** Sum of layout shifts so far (the page's whole life, buffered). */
const layoutShift = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as Array<PerformanceEntry & { value: number }>)
            total += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 300);
      }),
  );

test.describe('routes', () => {
  for (const { locale, path, lang } of LOCALE_PAGES)
    test(`${path} is the ${locale} page, lang="${lang}"`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('html')).toHaveAttribute('data-locale', locale);
    });
  test('there is no /zh/ page', async ({ request }) => {
    expect((await request.get(`${V2}zh/`)).status()).toBe(404);
  });
});

for (const { locale, path, state } of LOCALE_PAGES)
  test.describe(`head links and preview state (${locale}, ${state})`, () => {
    const { copy } = contentFor(locale);
    test('canonical, robots, hreflang and Open Graph locale', async ({ page }) => {
      await page.goto(path);
      const canonical = new URL(path, ORIGIN).href;
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
        'content',
        LOCALES[locale].og,
      );
      // A preview is noindex; a live page is not.
      const robots = page.locator('meta[name="robots"]');
      if (state === 'preview') await expect(robots).toHaveAttribute('content', 'noindex');
      else await expect(robots).toHaveCount(0);
      // hreflang: every live locale and x-default on every live page (the same set from each),
      // none on a preview page and none while only one locale is live (src/i18n/routing.ts).
      const links = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) =>
        els.map((el) => ({
          hreflang: el.getAttribute('hreflang')!,
          href: el.getAttribute('href')!,
        })),
      );
      expect(links).toEqual(hreflangLinks(locale, LOCALE_STATES, ORIGIN, V2));
      // A preview locale is never an alternate of any page.
      for (const other of LOCALE_PAGES.filter((p) => p.state === 'preview'))
        expect(links.map((l) => l.href)).not.toContain(new URL(other.path, ORIGIN).href);
    });

    test('a preview shows the draft notice, with a link to the English page', async ({ page }) => {
      await page.goto(path);
      const notice = page.locator('.lang-notice');
      if (state === 'live') {
        await expect(notice).toHaveCount(0);
        return;
      }
      await expect(notice).toBeVisible();
      await expect(notice).toContainText(copy.i18n.preview_notice);
      await expect(notice.getByRole('link', { name: copy.i18n.preview_link })).toHaveAttribute(
        'href',
        pageOf('en').path,
      );
    });

    test('the language row: each language in its own words and lang; the links need no script', async ({
      page,
    }) => {
      await page.goto(path);
      const html = await page.content();
      await page.locator('body').press(',');
      const row = page
        .getByRole('dialog', { name: copy.prefs.heading })
        .getByRole('navigation', { name: copy.prefs.lang.legend });
      const offered = switchLocales(locale, LOCALE_STATES);
      const links = row.getByRole('link');
      await expect(links).toHaveCount(offered.length);
      for (const [i, l] of offered.entries()) {
        const link = links.nth(i);
        await expect(link).toHaveAttribute('lang', LOCALES[l].lang);
        await expect(link).toHaveAttribute('hreflang', LOCALES[l].hreflang);
        await expect(link).toHaveAttribute('href', pageOf(l).path);
        await expect(link).toContainText(languageName(l));
        if (l === locale) await expect(link).toHaveAttribute('aria-current', 'page');
        else await expect(link).not.toHaveAttribute('aria-current', /.*/);
        // In the HTML as built: plain links, whatever runs.
        expect(html).toContain(`href="${pageOf(l).path}"`);
      }
      // Only live locales are offered, unless this page is itself a preview.
      if (state === 'live') for (const l of offered) expect(LOCALE_STATES[l]).toBe('live');
    });
  });

test.describe('the language row keeps your place and remembers the choice', () => {
  test('following a language link lands on the same section there', async ({ page, isMobile }) => {
    test.skip(isMobile, 'one run is enough');
    // From the first page that offers another language.
    const from = LOCALE_PAGES.find((p) => switchLocales(p.locale, LOCALE_STATES).length > 1);
    test.skip(!from, 'only one language is offered anywhere');
    const target = switchLocales(from!.locale, LOCALE_STATES).find((l) => l !== from!.locale)!;
    await page.goto(from!.path);
    await page.evaluate(() =>
      document.getElementById('experience')!.scrollIntoView({ block: 'start' }),
    );
    await expect(page.locator('.nav__links a[aria-current="true"]')).toHaveAttribute(
      'href',
      '#experience',
    );
    await page.locator('body').press(',');
    await page.locator(`#prefs a[data-lang-pick="${target}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${pageOf(target).path}#experience$`));
    expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).lang, KEY)).toBe(target);
  });
});

test.describe('first-visit suggestion (never a redirect)', () => {
  const live = liveLocales(LOCALE_STATES);
  for (const browser of ['en-US', 'zh-CN', 'zh-TW']) {
    for (const { locale, path } of LOCALE_PAGES) {
      test.describe(`a ${browser} browser on ${path}`, () => {
        test.use({ locale: browser });
        const expected = suggestLocale([browser], locale, [
          locale,
          ...live.filter((l) => l !== locale),
        ]);
        test(expected ? `suggests ${expected}` : 'suggests nothing', async ({ page }) => {
          await page.goto(path);
          await expect(page).toHaveURL(new RegExp(`${path}$`)); // no redirect, ever
          const shown = page.locator('[data-lang-suggest]:visible');
          if (!expected) {
            await expect(shown).toHaveCount(0);
            return;
          }
          // Only ever a live locale, written in its own language.
          expect(LOCALE_STATES[expected]).toBe('live');
          const words = contentFor(expected).copy.i18n;
          await expect(shown).toHaveCount(1);
          await expect(shown).toHaveAttribute('lang', LOCALES[expected].lang);
          await expect(shown).toContainText(words.suggest);
          await expect(shown.getByRole('link', { name: words.suggest_go })).toHaveAttribute(
            'href',
            pageOf(expected).path,
          );
          // Dismissed: hidden, this page's language kept as the choice, gone on the next visit.
          await shown.getByRole('button', { name: words.suggest_dismiss }).click();
          await expect(page.locator('[data-lang-suggest]:visible')).toHaveCount(0);
          expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).lang, KEY)).toBe(
            locale,
          );
          await page.reload();
          await expect(page.locator('[data-lang-suggest]:visible')).toHaveCount(0);
        });
      });
    }
  }
});

for (const { locale, path } of LOCALE_PAGES.filter((p) => p.locale !== 'en'))
  test.describe(`Chinese page checks (${locale})`, () => {
    test('no character of the other script (by each element’s own lang)', async ({ page }) => {
      await page.goto(path);
      // Every text, and every attribute a person reads, with the lang of where it sits.
      const texts = await page.evaluate(() => {
        const out: Array<{ lang: string; text: string }> = [];
        const langOf = (el: Element | null) => el?.closest('[lang]')?.getAttribute('lang') ?? '';
        const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || el.closest('script, style')) continue;
          out.push({ lang: langOf(el), text: n.textContent ?? '' });
        }
        for (const el of document.querySelectorAll('[alt], [aria-label], [title], meta[content]'))
          for (const a of ['alt', 'aria-label', 'title', 'content'])
            if (el.hasAttribute(a)) out.push({ lang: langOf(el), text: el.getAttribute(a)! });
        return out;
      });
      const wrong: string[] = [];
      for (const { lang, text } of texts) {
        const script = /^zh-Hant/i.test(lang)
          ? 'zh-hant'
          : /^zh(-Hans)?/i.test(lang)
            ? 'zh-hans'
            : null;
        if (!script) continue;
        const chars = wrongScript(text, script);
        if (chars.length > 0)
          wrong.push(`${lang}: ${chars.join('')} in "${text.trim().slice(0, 40)}"`);
      }
      expect(wrong).toEqual([]);
      // And the page is written in its own script at all.
      expect(
        texts.filter((t) => t.lang === LOCALES[locale].lang && /\p{Script=Han}/u.test(t.text))
          .length,
      ).toBeGreaterThan(20);
    });

    test('every English fallback is marked lang="en"; no marker is left in the page', async ({
      page,
    }) => {
      await page.goto(path);
      const html = await page.content();
      expect(html).not.toMatch(/[\uE000\uE001]/);
      // The facts with no translation in this locale, as the page shows them (site.yaml `meta`
      // only reaches <head>, where nothing can carry a lang of its own).
      const fallbacks = [
        ...new Set(
          contentFor(locale)
            .fallbacks.filter((f) => f.file !== 'site.yaml' && /\p{L}/u.test(f.text))
            .map((f) => f.text),
        ),
      ];
      expect(fallbacks.length).toBeGreaterThan(0);
      const english = await page
        .locator('body [lang="en"]')
        .evaluateAll((els) => els.map((el) => el.textContent ?? ''));
      for (const f of fallbacks)
        expect(
          english.some((t) => t.includes(f)),
          `"${f}" is shown, but in no element marked lang="en"`,
        ).toBe(true);
      // What is marked as English is English.
      for (const t of english) expect(t, t).not.toMatch(/\p{Script=Han}/u);
      // An untranslated Markdown body (a project with no translation file) is marked as a whole.
      for (const p of contentFor(locale).projects.filter((x) => x.bodyEnglish))
        await expect(page.locator(`#project-${p.id} [lang="en"]`).first()).toBeVisible();
    });
  });

test.describe('the pixel CJK face: its own cut on its own page, never on English pages', () => {
  for (const { locale, path } of LOCALE_PAGES) {
    test(`${locale}`, async ({ page }) => {
      const fonts: string[] = [];
      page.on('request', (r) => {
        if (r.url().includes('/_astro/cjk/')) fonts.push(r.url());
      });
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      if (locale === 'en') {
        expect(fonts).toEqual([]);
        expect(await page.locator('style', { hasText: 'zhic Pixel' }).count()).toBe(0);
        return;
      }
      const [mine, other] = locale === 'zh-hans' ? ['sc', 'tc'] : ['tc', 'sc'];
      expect(fonts.some((u) => u.includes(`zhic-pixel-${mine}.`))).toBe(true);
      expect(fonts.some((u) => u.includes(`zhic-pixel-${other}.`))).toBe(false);
      const family = locale === 'zh-hans' ? 'zhic Pixel SC' : 'zhic Pixel TC';
      expect(await page.evaluate((f) => document.fonts.check(`12px "${f}"`, '数據'), family)).toBe(
        true,
      );
      // The headline really is drawn in it.
      const h1Font = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
      expect(h1Font).toContain(family);
    });
  }
});

for (const { locale, path } of LOCALE_PAGES)
  test.describe(`layout shift (${locale})`, () => {
    test.skip(({ isMobile }) => isMobile, 'measured on the desktop layout');
    test('CLS ≤ 0.05 once fonts are in', async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      expect(await layoutShift(page)).toBeLessThanOrEqual(0.05);
    });
    test('CLS ≤ 0.05 when the pixel CJK face arrives late', async ({ page }) => {
      test.skip(locale === 'en', 'English pages load no CJK font');
      // The CJK face held back a second: the page first paints its Chinese in the system sans,
      // then swaps (both draw an ideograph one em wide, and the line heights are fixed).
      await page.route(/\/_astro\/cjk\//, async (route) => {
        await new Promise((r) => setTimeout(r, 1000));
        await route.continue();
      });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      expect(await layoutShift(page)).toBeLessThanOrEqual(0.05);
    });
    // M5: every web font held back a second — the page first paints in the fallback faces
    // (src/styles/global.css, astro.config.mjs). X2 measured 0.46 for English on CI's runner and
    // narrowed this test to the CJK face. The cause: at 1280 px (CI's viewport) the nav row had
    // 2 px to spare, so a fallback a pixel wider (DejaVu Sans Mono, where Liberation Mono is
    // missing) wrapped it and the page below moved 68 px when the fonts came. Reproduced here
    // without the Liberation fonts: 0.47 at 1280 only; 0.0036 since the nav's gap may shrink
    // (Nav.astro). The message names the stand-ins this machine had.
    for (const width of locale === 'en' ? [1440, 1280, 1024, 768, 390, 320] : [1280])
      test(`CLS ≤ 0.05 when every web font arrives late (${width}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.route(/\.woff2$/, async (route) => {
          await new Promise((r) => setTimeout(r, 1000));
          await route.continue();
        });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        const standIns = await page.evaluate(() =>
          [...document.fonts]
            .filter((f) => /Fallback/i.test(f.family))
            .map((f) => `${f.family.replace(/"/g, '')} ${f.weight}: ${f.status}`)
            .join('; '),
        );
        // What moved, for the message: each shift's elements and how far.
        const moved = await page.evaluate(() =>
          (
            performance.getEntriesByType('layout-shift') as Array<
              PerformanceEntry & {
                value: number;
                sources?: Array<{ node?: Node; previousRect: DOMRect; currentRect: DOMRect }>;
              }
            >
          )
            .filter((e) => e.value > 0.001)
            .map(
              (e) =>
                `${e.value.toFixed(3)}: ` +
                (e.sources ?? [])
                  .map(
                    (x) =>
                      `${(x.node as Element | undefined)?.className || x.node?.nodeName} ` +
                      `${Math.round(x.previousRect.y)}→${Math.round(x.currentRect.y)} ` +
                      `h ${Math.round(x.previousRect.height)}→${Math.round(x.currentRect.height)}`,
                  )
                  .join(', '),
            )
            .join(' | '),
        );
        expect(
          await layoutShift(page),
          `moved: ${moved || 'nothing'}; stand-ins: ${standIns}`,
        ).toBeLessThanOrEqual(0.05);
      });
  });
