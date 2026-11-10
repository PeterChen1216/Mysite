import { expect, test, type Page } from '@playwright/test';
import { glyphParts } from '../../src/lib/derive';
import { runningAnimations, runningLoops } from './animations';
import { copy, escapeRe } from './copy';
import { LOCALE_PAGES, TIER_PAGES, V2, open } from './site';

/**
 * Text that is cut off or runs into its neighbours. Checks every visible word against the
 * viewport and against each ancestor that clips horizontally (`.page` is `overflow-x: clip`, so
 * the document itself never scrolls sideways and a scrollWidth check would always pass), and
 * every block of text against its own width. Text shortened on purpose with an ellipsis (the
 * terminal title bars) is allowed when the element's title holds the full text and the element
 * itself is on screen. The ticker scrolls on purpose and is skipped, as are screen-reader-only
 * labels.
 */
function textProblems(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const skip = (el: Element) => el.closest('.visually-hidden, .ticker') !== null;
    const problems: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      const text = node.textContent ?? '';
      if (!el || !text.trim() || skip(el) || getComputedStyle(el).visibility === 'hidden') continue;
      let left = 0;
      let right = vw;
      let shortened = false;
      for (let a: Element | null = el; a && a !== document.documentElement; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === 'visible') continue;
        if (cs.textOverflow === 'ellipsis') {
          shortened = true; // checked as a whole below
          break;
        }
        const r = a.getBoundingClientRect();
        left = Math.max(left, r.left);
        right = Math.min(right, r.right);
      }
      if (shortened) continue;
      const range = document.createRange();
      for (const m of text.matchAll(/\S+/g)) {
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const r = range.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue; // not rendered (display: none)
        if (r.left < left - 1 || r.right > right + 1)
          problems.push(`cut off: "${m[0]}" at ${Math.round(r.left)}–${Math.round(r.right)}`);
      }
    }
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (skip(el)) continue;
      if (cs.textOverflow === 'ellipsis' && cs.overflowX !== 'visible') {
        const full = el.textContent?.trim() ?? '';
        if (el.scrollWidth > el.clientWidth + 1 && el.getAttribute('title') !== full)
          problems.push(`shortened without a title: "${full}"`);
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.left < -1 || r.right > vw + 1))
          problems.push(`cut off: "${full}" at ${Math.round(r.left)}–${Math.round(r.right)}`);
        continue;
      }
      if (cs.display.startsWith('inline') || cs.display === 'contents') continue;
      if (cs.overflowX !== 'visible' || el.clientWidth === 0 || !el.textContent?.trim()) continue;
      // A block of running text: every child is inline (spans, links), so its text can only
      // run past the box sideways, into whatever sits next to it.
      const leaf = [...el.children].every((c) => getComputedStyle(c).display.startsWith('inline'));
      if (leaf && el.scrollWidth > el.clientWidth + 1)
        problems.push(
          `spills: <${el.tagName.toLowerCase()} class="${el.className}"> ${el.scrollWidth}px in ${el.clientWidth}px`,
        );
    }
    return problems;
  });
}

test.describe('layout holds at every width', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop projects resize the viewport themselves');
  test.use({ reducedMotion: 'reduce' });
  // 320 px is the WCAG 1.4.10 reflow width. Every locale (PLAN-EXPERIENCE §5.5: Chinese strings
  // are shorter but taller; §9.1: all three locales in Night).
  for (const { locale, path } of LOCALE_PAGES)
    for (const width of [320, 360, 390, 600, 768, 1024, 1100, 1280, 1440, 1920]) {
      test(`no text is cut off or overlapping at ${width}px (${locale})`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        expect(await textProblems(page)).toEqual([]);
        // The About grid template is valid for this width (an invalid one is dropped, and the
        // cards fall back to auto-placement with holes).
        const areas = await page
          .locator('.inv')
          .evaluate((el) => getComputedStyle(el).gridTemplateAreas);
        expect(areas).not.toBe('none');
      });
    }
  // The other themes show cue glyphs in tags and chips (wider); they share one layout, so one of
  // them stands for all (PLAN-EXPERIENCE §9.1: prune the matrix to what can interact).
  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`no text is cut off at ${width}px with the cue glyphs of the other themes`, async ({
      page,
    }) => {
      await page.addInitScript(() => localStorage.setItem('zhic:prefs:v1', '{"theme":"cvd"}'));
      await page.setViewportSize({ width, height: 900 });
      await page.goto(V2);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page
          .locator('.chip[data-cue]')
          .first()
          .evaluate((el) => getComputedStyle(el, '::before').display),
      ).not.toBe('none');
      expect(await textProblems(page)).toEqual([]);
    });
  }
  // WCAG 1.4.12: a reader's own spacing (the bookmarklet values) must not clip or overlap text.
  for (const { locale, path } of LOCALE_PAGES)
    for (const width of [320, 390, 768, 1024, 1440]) {
      test(`text-spacing override: nothing cut off at ${width}px (${locale})`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.addStyleTag({
          content:
            '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
        });
        await page.evaluate(() => document.fonts.ready);
        expect(await textProblems(page)).toEqual([]);
      });
    }
  // The settings' largest text size (130 %) at the widths where the layout changes.
  for (const { locale, path } of LOCALE_PAGES)
    for (const width of [320, 390, 768, 1024, 1280, 1440]) {
      test(`text size 130 %: nothing cut off at ${width}px (${locale})`, async ({
        page,
        browser,
      }) => {
        await page.addInitScript(() => localStorage.setItem('zhic:prefs:v1', '{"text":130}'));
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        // The type really is larger: the headline at 130 % against the same page at 100 %, loaded
        // in a fresh context. (Removing --text-scale on this page and reading the headline again
        // raced the preferences script, which may re-apply the stored size at any time.)
        const h1 = (p: Page) =>
          p.locator('h1').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        const scaled = await h1(page);
        const plain = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion: 'reduce',
        });
        const fresh = await plain.newPage();
        await fresh.goto(path);
        const base = await h1(fresh);
        await plain.close();
        expect(scaled).toBeCloseTo(base * 1.3, 0);
        expect(await textProblems(page)).toEqual([]);
      });
    }
  test('long skill lists wrap instead of running off the card', async ({ page }) => {
    await page.goto(V2);
    await expect(page.locator('.sk__basic').first()).toHaveCSS('flex-wrap', 'wrap');
  });
});

// M3: the directory, a project's page and the 404 in every locale, and the windows over the home
// page: no text cut off at the reflow width and on a desktop, with a reader's own spacing and at
// the largest text size (pruned to the widths where these layouts change).
test.describe('the pages and windows of M3 hold too', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop projects resize the viewport themselves');
  test.use({ reducedMotion: 'reduce' });
  const SPACING =
    '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';
  for (const { locale, path } of LOCALE_PAGES) {
    const pages = [`${path}projects/`, `${path}projects/clock-stamp/`, `${path}no/such/chunk/`];
    for (const [mode, widths] of [
      ['as built', [320, 768, 1440]],
      ['text-spacing override', [320, 1440]],
      ['text size 130 %', [320, 1440]],
    ] as const)
      for (const width of widths)
        test(`${mode}: nothing cut off at ${width}px (${locale})`, async ({ page }) => {
          if (mode === 'text size 130 %')
            await page.addInitScript(() => localStorage.setItem('zhic:prefs:v1', '{"text":130}'));
          await page.setViewportSize({ width, height: 900 });
          for (const url of pages) {
            await page.goto(url);
            if (mode === 'text-spacing override') await page.addStyleTag({ content: SPACING });
            await page.evaluate(() => document.fonts.ready);
            expect(await textProblems(page), url).toEqual([]);
          }
        });
  }
  for (const width of [320, 1440])
    test(`a window open over the page: nothing cut off at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(V2);
      await page.locator('#projects .sh__more').click();
      await expect(page.locator('dialog[data-window-kind="directory"]')).toBeVisible();
      expect(await textProblems(page)).toEqual([]);
      await page.locator('dialog[open] a[data-project-link]').first().click();
      await expect(page.locator('dialog[data-window-kind="project"] [data-project]')).toBeVisible();
      expect(await textProblems(page)).toEqual([]);
    });
});

// Every graphics tier (PLAN-EXPERIENCE §7, acceptance F), at full motion (reduced motion would
// make every tier static): the scene sits behind the content and must not move or hide any of it.
test.describe('layout holds at every graphics tier', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop projects resize the viewport themselves');
  // Tier 3 is the desktop scene (from 1024 px).
  for (const { path, tier } of TIER_PAGES)
    for (const width of tier === 3 ? [1024, 1440] : [390, 1024, 1440]) {
      test(`no text is cut off or overlapping at ${width}px (graphics tier ${tier})`, async ({
        page,
        browserName,
      }) => {
        test.skip(
          tier === 3 && browserName === 'webkit',
          "CI's WebKit draws WebGL in software; its scene coverage is scene.spec.ts",
        );
        await page.setViewportSize({ width, height: 900 });
        await open(page, path);
        await page.evaluate(() => document.fonts.ready);
        // The intro has played (words rise into place as it runs).
        await page.evaluate(() =>
          Promise.all(
            document
              .getAnimations()
              .filter((a) => ((a as CSSAnimation).animationName ?? '').startsWith('intro-'))
              .map((a) => a.finished.catch(() => undefined)),
          ),
        );
        expect(await textProblems(page)).toEqual([]);
      });
    }
});

test.describe('motion', () => {
  test('focus pauses the ticker; it is a named region', async ({ page }) => {
    await page.goto(V2);
    const ticker = page.getByRole('region', { name: copy.ticker.label, exact: true });
    await ticker.focus();
    const state = await page
      .locator('.ticker__track')
      .first()
      .evaluate((el) => getComputedStyle(el).animationPlayState);
    expect(state).toBe('paused');
  });

  test('loops pause while off screen', async ({ page }) => {
    await page.goto(V2);
    await expect.poll(() => runningLoops(page)).toBeGreaterThan(0);
    await page.evaluate(() =>
      document.getElementById('experience')!.scrollIntoView({ block: 'start' }),
    );
    await expect.poll(() => runningLoops(page)).toBe(0);
  });

  test('reduced motion turned on mid-visit stops everything; turned off, nothing spins off screen', async ({
    page,
    isMobile,
  }) => {
    await page.goto(V2);
    await expect.poll(() => runningLoops(page)).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Scrolling away and back and dragging the globe used to restart its spin.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 0));
    const globe = page.locator('.stage [data-globe]');
    const box = (await globe.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2);
    await page.mouse.up();
    await expect.poll(() => runningAnimations(page), { timeout: 3000 }).toEqual([]);
    // The ticker stands still, keeps one copy of its items and scrolls by hand instead.
    const ticker = page.locator('.ticker');
    await expect(ticker).toHaveCSS('overflow-x', 'auto');
    await expect(page.locator('.ticker__track--dup')).toBeHidden();
    expect(await ticker.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    if (!isMobile) {
      // Hover bursts stay off too (there is no hover on touch screens).
      await page.locator('.hero .mc-btn').first().hover();
      await page.waitForTimeout(100);
      const painted = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('.particles-layer');
        if (!canvas) return 0;
        const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        let n = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]) n++;
        return n;
      });
      expect(painted).toBe(0);
    }
    // Turned off again: the loops come back, but globes that are off screen stay paused.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => runningLoops(page)).toBeGreaterThan(0);
    await page.evaluate(() =>
      document.getElementById('experience')!.scrollIntoView({ block: 'start' }),
    );
    await expect.poll(() => runningLoops(page)).toBe(0);
  });
});

test.describe('globe drag', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse drag on the desktop layouts');
  // 1100 px scales the hero stage down: the map must still follow the pointer one to one.
  for (const width of [1440, 1100]) {
    test(`dragging the hero globe turns the map with the pointer at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(V2);
      const globe = page.locator('.stage [data-globe]');
      // Let the intro finish (the globe scales in) so the drawn size is final.
      await globe.evaluate((el) =>
        Promise.all(
          (el.closest('[data-intro]') ?? el).getAnimations().map((a) => a.finished.catch(() => {})),
        ),
      );
      await page.evaluate(() => {
        const w = window as unknown as { dragEvents: string[] };
        w.dragEvents = [];
        for (const type of ['dragstart', 'pointercancel'])
          document.addEventListener(type, () => w.dragEvents.push(type), true);
      });
      const strip = page.locator('.stage [data-globe-strip]');
      const left = () => strip.evaluate((el) => el.getBoundingClientRect().left);
      const box = (await globe.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      const before = await left();
      await page.mouse.move(x + 100, y, { steps: 10 });
      const moved = (await left()) - before;
      await page.mouse.up();
      // One map tile (one turn) on screen, for wrapping.
      const tile = (648 * box.width) / 324;
      const delta = ((((moved - 100) % tile) + tile * 1.5) % tile) - tile / 2;
      expect(Math.abs(delta)).toBeLessThan(3);
      expect(
        await page.evaluate(() => (window as unknown as { dragEvents: string[] }).dragEvents),
      ).toEqual([]);
    });
  }
});

test.describe('globe drag and reduced motion', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse drag on the desktop layouts');
  test('reduced motion turned on during a drag leaves the globe still', async ({ page }) => {
    await page.goto(V2);
    const globe = page.locator('.stage [data-globe]');
    await globe.evaluate((el) =>
      Promise.all(
        (el.closest('[data-intro]') ?? el).getAnimations().map((a) => a.finished.catch(() => {})),
      ),
    );
    const box = (await globe.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 30, y, { steps: 3 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.mouse.move(x + 80, y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => runningAnimations(page), { timeout: 3000 }).toEqual([]);
  });
});

test.describe('the globe from the keyboard (WCAG 2.5.7: a drag has a keyboard twin)', () => {
  /** Tab until the hero globe has focus (a real keyboard focus, so the spin holds). */
  async function tabToGlobe(page: Page) {
    const globe = page.getByRole('slider', { name: copy.hero.globe_label, exact: true });
    for (let i = 0; i < 80 && !(await globe.evaluate((el) => el === document.activeElement)); i++)
      await page.keyboard.press('Tab');
    await expect(globe).toBeFocused();
    return globe;
  }
  const value = (deg: number) => copy.hero.globe_value.replace(/\{\s*deg\s*\}/, String(deg));
  // Where the map is: the spin's transform, or the still map's translate (px of the 648 px tile;
  // −648 = 0°). Polled: under reduced motion a change runs a 0.01 ms transition.
  const offset = (page: Page) =>
    page.locator('.stage [data-globe-strip]').evaluate((el) => {
      const cs = getComputedStyle(el);
      const tx = cs.transform === 'none' ? 0 : new DOMMatrix(cs.transform).m41;
      return Math.round(tx + (cs.translate === 'none' ? 0 : parseFloat(cs.translate)));
    });
  const at = (deg: number) => Math.round((deg / 360 - 1) * 648);

  for (const motion of ['no-preference', 'reduce'] as const) {
    test(`arrow keys, Page Up/Down and Home turn it (${motion} motion)`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName === 'webkit', 'Safari does not Tab to every element by default');
      await page.emulateMedia({ reducedMotion: motion });
      await page.goto(V2);
      const globe = await tabToGlobe(page);
      await page.keyboard.press('Home');
      await expect(globe).toHaveAttribute('aria-valuenow', '0');
      await expect(globe).toHaveAttribute('aria-valuetext', value(0));
      await expect.poll(() => offset(page)).toBe(at(0));
      await page.keyboard.press('ArrowRight');
      await expect(globe).toHaveAttribute('aria-valuenow', '15');
      await expect(globe).toHaveAttribute('aria-valuetext', value(15));
      await expect.poll(() => offset(page)).toBe(at(15));
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await expect(globe).toHaveAttribute('aria-valuenow', '345');
      await expect.poll(() => offset(page)).toBe(at(345));
      await page.keyboard.press('PageUp');
      await expect(globe).toHaveAttribute('aria-valuenow', '75');
      // While it has keyboard focus the spin holds, so the value stays true.
      await page.waitForTimeout(300);
      await expect.poll(() => offset(page)).toBe(at(75));
    });
  }
});

test.describe('keyboard and screen readers', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the real photo can be revealed from the keyboard', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari does not Tab to every element by default');
    await page.goto(V2);
    const card = page.locator('.stage__card');
    for (let i = 0; i < 60 && !(await card.evaluate((el) => el === document.activeElement)); i++)
      await page.keyboard.press('Tab');
    await expect(card).toBeFocused();
    await expect(card).toHaveAccessibleName(/\S/);
    await expect(page.locator('.stage__photo')).toHaveCSS('opacity', '1');
  });

  test('every link that opens a new tab says so', async ({ page }) => {
    await page.goto(V2);
    // Visible ones: the nav's résumé button is hidden on phones.
    const links = page.locator('a[target="_blank"]:visible');
    expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all())
      await expect(link).toHaveAccessibleName(new RegExp(`${escapeRe(copy.labels.new_tab)}$`));
  });

  test('decorative symbols are left out of names', async ({ page }) => {
    await page.goto(V2);
    await expect(page.locator('h1')).not.toHaveAccessibleName(/_\s*$/);
    await expect(page.locator('footer a[href="#top"]')).toHaveAccessibleName(
      glyphParts(copy.footer.back_to_top).text,
    );
    await expect(page.locator('#experience a[href="#contact"]')).toHaveAccessibleName(
      glyphParts(copy.experience.head_hint).text,
    );
  });
});
