// The accessibility contract's automatable rows (PLAN-EXPERIENCE §4.1) not covered elsewhere:
// target size, language, content on hover, the keyboard tab walk, reduced transparency, print.
// (Contrast: tests/unit/contrast.test.ts; themes and forced colours: themes.spec.ts; motion and
// pause: motion.spec.ts; zoom, reflow, text spacing and text size: robustness.spec.ts.)
import { expect, test, type Page } from '@playwright/test';
import { LANG_TAG } from '../../src/i18n/locales';
import { LOCALE_PAGES, V2 } from './site';

const INTERACTIVE =
  'a[href], button, input, select, textarea, [role="slider"], [tabindex]:not([tabindex="-1"])';

/**
 * WCAG 2.5.8 Target Size (Minimum): every pointer target is at least 24 × 24 px, unless it is
 * inline in a line of text, or undersized but spaced so that a 24 px circle centred on it meets
 * no other target and no other undersized target's circle. Returns the targets that fail.
 */
function smallTargets(page: Page) {
  return page.evaluate((selector) => {
    const visible = [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (el) =>
        el.getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== 'hidden' &&
        !el.closest('dialog:not([open]), [aria-hidden="true"]') &&
        // Behind an open modal window nothing can be pointed at but the window itself.
        (!document.querySelector('dialog[open]') || !!el.closest('dialog[open]')),
    );
    // A radio or checkbox is targeted through its whole label as well.
    const boxes = visible.map((el) => {
      const label = el instanceof HTMLInputElement ? el.labels?.[0] : undefined;
      return { el, r: (label?.contains(el) ? label : el).getBoundingClientRect() };
    });
    const small = (r: DOMRect) => r.width < 24 || r.height < 24;
    /** In a sentence: an inline link whose block also holds text that is not a link. */
    const inline = (el: HTMLElement) => {
      if (!getComputedStyle(el).display.startsWith('inline')) return false;
      let block = el.parentElement;
      while (block && getComputedStyle(block).display.startsWith('inline'))
        block = block.parentElement;
      if (!block) return false;
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode())
        if (/\p{L}/u.test(n.textContent ?? '') && !n.parentElement?.closest(selector)) return true;
      return false;
    };
    const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const distToRect = (p: { x: number; y: number }, r: DOMRect) =>
      Math.hypot(
        Math.max(r.left - p.x, 0, p.x - r.right),
        Math.max(r.top - p.y, 0, p.y - r.bottom),
      );
    const fails: string[] = [];
    for (const a of boxes) {
      if (!small(a.r) || inline(a.el)) continue;
      const c = centre(a.r);
      const clash = boxes.some((b) => {
        if (b.el === a.el || b.el.contains(a.el) || a.el.contains(b.el)) return false;
        if (distToRect(c, b.r) < 12) return true;
        if (small(b.r) && !inline(b.el)) {
          const d = centre(b.r);
          return Math.hypot(c.x - d.x, c.y - d.y) < 24;
        }
        return false;
      });
      const by = boxes.find((b) => {
        if (b.el === a.el || b.el.contains(a.el) || a.el.contains(b.el)) return false;
        if (distToRect(c, b.r) < 12) return true;
        return (
          small(b.r) && !inline(b.el) && Math.hypot(c.x - centre(b.r).x, c.y - centre(b.r).y) < 24
        );
      });
      if (clash)
        fails.push(
          `${a.el.tagName.toLowerCase()} "${(a.el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(a.r.width)}×${Math.round(a.r.height)} near ${by?.el.tagName.toLowerCase()}.${by?.el.className} "${(by?.el.textContent ?? '').trim().slice(0, 20)}"`,
        );
    }
    return fails;
  }, INTERACTIVE);
}

test.describe('target size (WCAG 2.5.8)', () => {
  for (const width of [1440, 1024, 390, 320]) {
    test(`every pointer target is 24 px or spaced like one, at ${width}px`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile && width !== 390, 'the phone project has its own width');
      if (!isMobile) await page.setViewportSize({ width, height: 900 });
      await page.goto(V2);
      await page.evaluate(() => document.fonts.ready);
      expect(await smallTargets(page)).toEqual([]);
      // And in the settings window.
      await page.locator('body').press(',');
      await expect(page.locator('#prefs')).toBeVisible();
      expect(await smallTargets(page)).toEqual([]);
    });
  }

  test('on touch, every MC button (a primary action) takes taps over at least 44 × 44 px', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'touch only');
    await page.goto(V2);
    await page.evaluate(() => document.fonts.ready);
    const buttons = page.locator('.mc-btn:visible');
    expect(await buttons.count()).toBeGreaterThan(3);
    for (const button of await buttons.all()) {
      await button.scrollIntoViewIfNeeded();
      const missed = await button.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const out: string[] = [];
        for (const dx of [-21.5, 0, 21.5])
          for (const dy of [-21.5, 0, 21.5]) {
            const hit = document.elementFromPoint(cx + dx, cy + dy);
            if (!hit || !el.contains(hit)) out.push(`${dx},${dy}`);
          }
        return out;
      });
      expect(missed, await button.innerText()).toEqual([]);
    }
  });
});

// Every locale's page (PLAN-EXPERIENCE §5.2): its own exact tag, and Chinese never unmarked.
for (const { locale, path, lang } of LOCALE_PAGES)
  test.describe(`language (WCAG 3.1.1, 3.1.2) (${locale})`, () => {
    test('<html lang> is the locale’s exact tag; every lang attribute is well formed', async ({
      page,
    }) => {
      await page.goto(path);
      expect(await page.locator('html').getAttribute('lang')).toBe(lang);
      const tags = await page
        .locator('[lang]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('lang') ?? ''));
      for (const tag of tags) expect(tag).toMatch(LANG_TAG);
    });

    test('any Chinese text sits in an element marked as Chinese', async ({ page }) => {
      await page.goto(path);
      const unmarked = await page.evaluate(() => {
        const out: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = n.textContent ?? '';
          if (!/\p{Script=Han}/u.test(text)) continue;
          const lang = n.parentElement?.closest('[lang]')?.getAttribute('lang') ?? '';
          if (!lang.startsWith('zh')) out.push(text.trim().slice(0, 40));
        }
        return out;
      });
      expect(unmarked).toEqual([]);
    });
  });

test.describe('content on hover or focus (WCAG 1.4.13)', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the player card’s photo stays while hovered, and Escape dismisses it', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'hover');
    await page.goto(V2);
    const card = page.locator('.stage__card');
    const photo = page.locator('.stage__photo');
    await card.hover();
    await expect(photo).toHaveCSS('opacity', '1');
    // Hoverable: the pointer can move over the shown photo without it going away.
    const box = (await photo.boundingBox())!;
    await page.mouse.move(box.x + box.width - 4, box.y + box.height - 10);
    await expect(photo).toHaveCSS('opacity', '1');
    // Dismissible without moving the pointer.
    await page.keyboard.press('Escape');
    await expect(photo).toHaveCSS('opacity', '0');
    // Leaving and coming back shows it again.
    await page.mouse.move(5, 5);
    await card.hover();
    await expect(photo).toHaveCSS('opacity', '1');
  });

  test('from the keyboard too: focus shows it, Escape hides it, focus stays', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'Safari does not Tab to every element by default');
    await page.goto(V2);
    const card = page.locator('.stage__card');
    for (let i = 0; i < 80 && !(await card.evaluate((el) => el === document.activeElement)); i++)
      await page.keyboard.press('Tab');
    await expect(card).toBeFocused();
    await expect(page.locator('.stage__photo')).toHaveCSS('opacity', '1');
    await page.keyboard.press('Escape');
    await expect(page.locator('.stage__photo')).toHaveCSS('opacity', '0');
    await expect(card).toBeFocused();
  });
});

test.describe('keyboard (WCAG 2.1.1, 2.1.2, 2.4.3, 2.4.7)', () => {
  test.use({ reducedMotion: 'reduce' });
  test('a tab walk: every stop in page order, on screen, with a visible focus ring, no trap', async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(browserName === 'webkit', 'Safari does not Tab to every element by default');
    test.skip(isMobile, 'keyboard walk on the desktop layout');
    await page.goto(V2);
    const stops: string[] = [];
    let previous: import('@playwright/test').ElementHandle<Element> | null = null;
    for (let i = 0; i < 200; i++) {
      await page.keyboard.press('Tab');
      const handle = await page.evaluateHandle(() => document.activeElement);
      const el = handle.asElement();
      if (!el || (await el.evaluate((e) => e === document.body))) break;
      const info = await el.evaluate((e, prev) => {
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return {
          name: `${e.tagName.toLowerCase()}.${e.className || ''} ${(e.textContent ?? '').trim().slice(0, 24)}`,
          ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
          onScreen: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
          after: !prev || !!(prev.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING),
        };
      }, previous);
      expect(info.ring, `${info.name}: visible focus`).toBe(true);
      expect(info.onScreen, `${info.name}: scrolled into view`).toBe(true);
      expect(info.after, `${info.name}: follows the previous stop`).toBe(true);
      stops.push(info.name);
      previous = el;
      if (stops.length > 1 && stops.filter((s) => s === info.name).length > 3) break;
    }
    // It reached the end of the page (the footer) and left the page: no trap.
    expect(stops.length).toBeGreaterThan(20);
    expect(stops.at(-1)).toMatch(/^a\.foot__top/);
  });
});

test.describe('reduced transparency', () => {
  test('translucent bars become solid', async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== 'chromium', 'emulated through the Chromium DevTools protocol');
    await page.goto(V2);
    // X4: a phone's top bar is opaque from the start (WebKit repaints a translucent bar over a
    // scrolling page slowly); the ticker's band is the translucent bar there.
    const bar = isMobile ? '.ticker' : '.nav';
    const alpha = () =>
      page.locator(bar).evaluate((el) => {
        const n = getComputedStyle(el).backgroundColor.match(/[\d.]+/g) ?? [];
        return n.length > 3 ? Number(n[3]) : 1;
      });
    expect(await alpha()).toBeLessThan(1);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });
    await expect.poll(alpha).toBe(1);
  });
});

test.describe('print (PLAN-EXPERIENCE §4.5)', () => {
  test('Mono light whatever the theme; no nav, ticker, hero art or phone; links show where they go', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('zhic:prefs:v1', '{"theme":"day"}'));
    await page.goto(V2);
    await page.emulateMedia({ media: 'print' });
    const style = (sel: string, prop: string) =>
      page
        .locator(sel)
        .first()
        .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
    // White paper (the page background is left to the paper itself), black ink.
    expect((await style('html', '--color-bg-night')).trim()).toBe('#fff');
    expect(await style('html', 'background-color')).toMatch(
      /^rgba?\(0, 0, 0, 0\)$|^rgb\(255, 255, 255\)$/,
    );
    expect(await style('h1', 'color')).toBe('rgb(0, 0, 0)');
    expect(await style('.term', 'background-color')).toBe('rgb(255, 255, 255)');
    for (const sel of ['.nav', '.ticker', '.stage-wrap', '.phone', '.bg'])
      await expect(page.locator(sel).first(), sel).toBeHidden();
    const after = await page
      .locator('main a[href^="http"]')
      .first()
      .evaluate((el) => getComputedStyle(el, '::after').content);
    expect(after).toContain('http');
    expect(await style('.card', 'box-shadow')).toBe('none');
  });
});
