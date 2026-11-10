import { expect, test, type Page } from '@playwright/test';
import { glyphParts } from '../../src/lib/derive';
import { copy, escapeRe } from './copy';
import { V2 } from './site';

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
  // 320 px is the WCAG 1.4.10 reflow width.
  for (const width of [320, 360, 390, 600, 768, 1024, 1100, 1280, 1440, 1920]) {
    test(`no text is cut off or overlapping at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(V2);
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
  test('long skill lists wrap instead of running off the card', async ({ page }) => {
    await page.goto(V2);
    await expect(page.locator('.sk__basic').first()).toHaveCSS('flex-wrap', 'wrap');
  });
});

/** CSS animations that are still running and never end (loops). */
function runningLoops(page: Page) {
  return page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity)
        .length,
  );
}

/**
 * Every running animation, named with its element, so a failure says what is still moving.
 * Assertions poll it until it is empty: a stray loop (a revived globe spin) never stops, while a
 * transition or intro step that is just finishing does.
 */
function runningAnimations(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === 'running')
      .map((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null | undefined;
        const name =
          (a as CSSAnimation).animationName ||
          (a as CSSTransition).transitionProperty ||
          a.constructor.name;
        const where = target
          ? `${target.tagName.toLowerCase()}${target.classList[0] ? `.${target.classList[0]}` : ''}`
          : '?';
        return `${name} on ${where}`;
      }),
  );
}

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
