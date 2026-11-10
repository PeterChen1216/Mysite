// The phone layout (X4; PLAN-EXPERIENCE §8, acceptance G): the hotbar and top bar, the folded
// terminal, the carousels and slot rows, the commit rows as <details>, tap-to-copy, the city keys,
// touch targets, no sideways scroll, lite mode and no WebGL. Runs on the phone projects only
// (playwright.config.ts: Pixel 7 in Chromium; an iPhone in WebKit on CI), over the widths
// §8.8 names (320 / 360 / 390 / 412 / 430) in English and Night, a landscape phone, every locale
// once at 390 and the other themes once at 390 (§9.1: the matrix pruned to what can interact).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { copy } from './copy';
import { LOCALE_PAGES, V2 } from './site';

const WIDTHS = [320, 360, 390, 412, 430] as const;
const PHONE = { height: 844 };
const hotbar = (page: Page) => page.locator('nav.hotbar');
const prefsDialog = (page: Page) => page.getByRole('dialog', { name: copy.prefs.heading });

test.beforeEach(({ isMobile }) => {
  test.skip(!isMobile, 'the phone layout');
});

const INTERACTIVE =
  'a[href], button, summary, input, select, textarea, [role="slider"], [tabindex]:not([tabindex="-1"])';

/**
 * Touch targets (§8.4): every control a finger can reach is at least 44 × 44 px — its own box,
 * or a box of that size inside its hit area (an invisible extension, sampled with
 * elementFromPoint) — and stands at least 8 px from the next one. Exempt, as WCAG 2.5.5 does:
 * links inside a sentence. The hero globe (a 280 px slider the name tag and the player card sit
 * on) is left out of the spacing pairs. Returns what fails.
 */
async function touchTargets(page: Page): Promise<string[]> {
  return page.evaluate(async (selector) => {
    const fails: string[] = [];
    const shown = (el: HTMLElement) =>
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== 'hidden' &&
      !el.closest('dialog:not([open]), [aria-hidden="true"], .skip-link, .visually-hidden') &&
      el.getBoundingClientRect().width > 1;
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
    const targets = [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (el) => shown(el) && !inline(el),
    );
    const name = (el: HTMLElement) =>
      `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}"`;
    const hits = (el: HTMLElement, x: number, y: number) => {
      const at = document.elementFromPoint(x, y);
      return !!at && (el === at || el.contains(at));
    };
    for (const el of targets) {
      // Reached as a visitor reaches it: focus brings it (and a carousel's card) into view; then
      // the page is scrolled to put it mid-screen, clear of the bars.
      el.focus();
      const at = el.getBoundingClientRect();
      window.scrollBy(0, at.top + at.height / 2 - innerHeight / 2);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = el.getBoundingClientRect();
      if (r.width >= 44 && r.height >= 44) continue;
      // A 44 px square anchored on the box's edges or centre, inside the hit area.
      const xs = [r.left + 22, r.left + r.width / 2, r.right - 22];
      const ys = [r.top + 22, r.top + r.height / 2, r.bottom - 22];
      const ok = xs.some((cx) =>
        ys.some((cy) =>
          [-21, 0, 21].every((dx) => [-21, 0, 21].every((dy) => hits(el, cx + dx, cy + dy))),
        ),
      );
      if (!ok) fails.push(`${name(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    // Spacing: ≥ 8 px between the boxes of neighbouring controls — those on the screen's fixed
    // layers (the bars, a dismissible banner) among themselves, the page's in page coordinates.
    const onBar = (el: HTMLElement) => {
      for (let a: HTMLElement | null = el; a; a = a.parentElement)
        if (/fixed|sticky/.test(getComputedStyle(a).position)) return true;
      return false;
    };
    window.scrollTo(0, 0);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const boxes = targets
      .filter((el) => el.getAttribute('role') !== 'slider')
      .map((el) => {
        const r = el.getBoundingClientRect();
        const dx = onBar(el) ? 0 : scrollX;
        const dy = onBar(el) ? 0 : scrollY;
        return {
          el,
          bar: onBar(el),
          l: r.left + dx,
          t: r.top + dy,
          r: r.right + dx,
          b: r.bottom + dy,
        };
      });
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        if (a.bar !== b.bar) continue;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        // Fixed bars and scrolled rows are measured where they are on screen now.
        const dx = Math.max(a.l - b.r, b.l - a.r, 0);
        const dy = Math.max(a.t - b.b, b.t - a.b, 0);
        const gap = Math.max(dx, dy);
        if (gap < 8 - 0.5)
          fails.push(`${name(a.el)} and ${name(b.el)} only ${gap.toFixed(1)} px apart`);
      }
    return fails;
  }, INTERACTIVE);
}

test.describe('the phone layout at every width (§8.8)', () => {
  for (const width of WIDTHS)
    test.describe(`${width} px`, () => {
      test.use({ viewport: { width, height: PHONE.height } });

      test('no sideways scroll; the hotbar is one named <nav> of five links', async ({ page }) => {
        await page.goto(V2);
        const over = await page.evaluate(() => ({
          html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.body.clientWidth,
        }));
        expect(over).toEqual({ html: 0, body: 0 });
        const bar = page.getByRole('navigation', { name: copy.nav.sections_label });
        await expect(bar).toHaveCount(1);
        await expect(bar).toHaveClass(/hotbar/);
        await expect(bar.getByRole('link')).toHaveCount(5);
        const names = [...copy.nav.hotbar, copy.nav.hotbar_prefs];
        for (const [i, n] of names.entries())
          await expect(bar.getByRole('link').nth(i)).toHaveAccessibleName(n);
        // The desktop's links and gear are not there; the top bar keeps the logo, ⏸ and RÉSUMÉ.
        await expect(page.locator('.nav__links')).toBeHidden();
        await expect(page.locator('.nav [data-prefs-open]')).toBeHidden();
        await expect(page.locator('.nav [data-pause]')).toBeVisible();
        await expect(page.locator('.nav .mc-btn:visible')).toHaveText([
          new RegExp(`^${copy.nav.resume}`),
        ]);
        // The narrowest phones show the icons only; each slot keeps its name.
        const compact = await hotbar(page).evaluate((el) => el.hasAttribute('data-compact'));
        expect(compact).toBe(width < 375);
      });

      test('every control is a 44 px target, 8 px from the next (§8.4)', async ({ page }) => {
        test.slow();
        // At rest: the intro's rising cards are not where they settle until it ends.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(V2);
        await page.evaluate(() => document.fonts.ready);
        expect(await touchTargets(page)).toEqual([]);
      });

      test('axe: no serious or critical violations', async ({ page }) => {
        await page.goto(V2);
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
          [],
        );
      });
    });

  test('a phone on its side gets the tablet layout: top nav, no hotbar (§8.6)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(V2);
    await expect(page.locator('nav.hotbar')).toBeHidden();
    await expect(page.locator('.nav__links')).toBeVisible();
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over).toBe(0);
  });
});

test.describe('every locale once at 390, Night (§9.1)', () => {
  test.use({ viewport: { width: 390, height: PHONE.height } });
  for (const lp of LOCALE_PAGES)
    test(`axe and targets (${lp.locale})`, async ({ page }) => {
      test.slow();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(lp.path);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
        [],
      );
      await expect(hotbar(page).getByRole('link')).toHaveCount(5);
      expect(await touchTargets(page)).toEqual([]);
    });
});

test.describe('the other themes once at 390 (§9.1)', () => {
  test.use({ viewport: { width: 390, height: PHONE.height } });
  for (const theme of ['day', 'mono-dark', 'mono-light', 'cvd'] as const)
    test(`axe, and the bars are opaque (${theme})`, async ({ page }) => {
      await page.addInitScript(
        (t) => localStorage.setItem('zhic:prefs:v1', JSON.stringify({ theme: t })),
        theme,
      );
      await page.goto(V2);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
        [],
      );
      // WebKit repaints a translucent bar over a scrolling page slowly: both bars are opaque.
      for (const bar of ['.nav', '.hotbar'])
        expect(
          await page
            .locator(bar)
            .evaluate((el) => getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.[3] ?? '1'),
        ).toBe('1');
    });
});

test.describe('the hotbar (§8.2)', () => {
  test.use({ viewport: { width: 390, height: PHONE.height } });

  test('scroll-spy: the section in view is the current slot; none over the hero', async ({
    page,
  }) => {
    await page.goto(V2);
    const current = hotbar(page).locator('a[aria-current="true"]');
    await expect(current).toHaveCount(0);
    for (const id of ['about', 'projects', 'experience', 'contact']) {
      await page.evaluate((s) => document.getElementById(s)!.scrollIntoView(), id);
      await expect(current).toHaveAttribute('href', `#${id}`);
    }
    // At the foot of the page: the last section.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(current).toHaveAttribute('href', '#contact');
  });

  test('slides away on the way down, back on the way up; focus brings it back', async ({
    page,
  }) => {
    await page.goto(V2);
    const hidden = () => page.evaluate(() => document.documentElement.dataset.bars ?? 'shown');
    // A scroll as a swipe makes it (mobile WebKit has no mouse wheel to send).
    const scroll = (dy: number) => page.evaluate((y) => window.scrollBy(0, y), dy);
    await scroll(900);
    await expect.poll(hidden).toBe('hidden');
    // Moved off screen, never out of the accessibility tree or the Tab order.
    await expect
      .poll(async () => (await hotbar(page).boundingBox())!.y)
      .toBeGreaterThanOrEqual(PHONE.height - 1);
    await expect(hotbar(page).getByRole('link').first()).toBeAttached();
    expect(await hotbar(page).evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
    await scroll(-200);
    await expect.poll(hidden).toBe('shown');
    await scroll(900);
    await expect.poll(hidden).toBe('hidden');
    await hotbar(page).getByRole('link').first().focus();
    await expect.poll(hidden).toBe('shown');
    // The top bar goes and comes with it.
    await expect
      .poll(async () => (await page.locator('.nav').boundingBox())!.y)
      .toBeGreaterThan(-1);
  });

  test('clears the home indicator (env(safe-area-inset-bottom)) and the page foot clears it', async ({
    page,
  }) => {
    await page.goto(V2);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /viewport-fit=cover/,
    );
    const css = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>('.hotbar')!;
      const s = getComputedStyle(bar);
      return { pb: s.paddingBottom, h: bar.getBoundingClientRect().height, bottom: s.bottom };
    });
    expect(css.bottom).toBe('0px');
    expect(css.h).toBeGreaterThanOrEqual(64);
    // The rule itself (an emulator has no notch to measure): the inset is in the bar's padding.
    const rule = await page.evaluate(() =>
      [...document.styleSheets]
        .flatMap((s) => {
          try {
            return [...s.cssRules].map((r) => r.cssText);
          } catch {
            return [];
          }
        })
        .some((t) => /\.hotbar/.test(t) && /safe-area-inset-bottom/.test(t)),
    );
    expect(rule).toBe(true);
    // At the very end of the page the footer's last line is above the bar.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = (await page.locator('.foot time').boundingBox())!;
    const bar = (await hotbar(page).boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(bar.y);
  });

  test('⚙ opens the settings over the page, docked above the bar, ⚙ selected; a tap on the bar closes them', async ({
    page,
  }) => {
    await page.goto(V2);
    const gear = hotbar(page).getByRole('link', { name: copy.nav.hotbar_prefs, exact: true });
    await expect(gear).toHaveAttribute('aria-haspopup', 'dialog');
    await gear.tap();
    await expect(prefsDialog(page)).toBeVisible();
    const win = (await prefsDialog(page).boundingBox())!;
    const bar = (await hotbar(page).boundingBox())!;
    expect(win.y + win.height).toBeLessThanOrEqual(bar.y);
    // Selected while its window is open: its edge is not the other slots' edge.
    const edge = (i: number) =>
      hotbar(page)
        .getByRole('link')
        .nth(i)
        .evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(await edge(4)).not.toBe(await edge(0));
    // No keyboard in use on a touch screen: no shortcuts, so no switch for them.
    await expect(
      prefsDialog(page).getByRole('group', { name: copy.prefs.keys.legend }),
    ).toBeHidden();
    await page.touchscreen.tap(bar.x + 30, bar.y + 30);
    await expect(prefsDialog(page)).toBeHidden();
    // Once a key is pressed, the switch is there (WCAG 2.1.4).
    await page.locator('body').press(',');
    await expect(
      prefsDialog(page).getByRole('group', { name: copy.prefs.keys.legend }),
    ).toBeVisible();
  });
});

test.describe('the hero (§8.3)', () => {
  test.use({ viewport: { width: 390, height: PHONE.height } });

  test('RÉSUMÉ and SAY HI in the bottom third; the terminal folds and unfolds', async ({
    page,
  }) => {
    await page.goto(V2);
    const ctas = page.locator('.hero__ctas--phone .mc-btn');
    await expect(ctas).toHaveText([copy.nav.resume, copy.nav.say_hi]);
    const box = (await ctas.first().boundingBox())!;
    expect(box.y).toBeGreaterThan(PHONE.height * 0.6);
    expect(box.y + box.height).toBeLessThan(PHONE.height);
    const more = page.locator('[data-fold]');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(more).toHaveAccessibleName(/more/);
    const summon = page.locator('.hero__ln--ok');
    await expect(summon).toBeHidden();
    await more.tap();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(more).toHaveAccessibleName(/less/);
    await expect(summon).toBeVisible();
    await more.tap();
    await expect(summon).toBeHidden();
  });

  test('the badges are a row to swipe, named and reachable', async ({ page }) => {
    await page.goto(V2);
    const row = page.getByRole('list', { name: copy.hero.badges_label });
    await expect(row).toHaveAttribute('tabindex', '0');
    const scrolls = await row.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrolls).toBe(true);
  });
});

test.describe('the ticker (§8.3)', () => {
  test.use({ viewport: { width: 390, height: PHONE.height } });

  test('kept, slower (30 px/s, 40 elsewhere); a tap holds it', async ({ page }) => {
    await page.goto(V2);
    const track = page.locator('.ticker__track').first();
    const { base, run } = await track.evaluate((el) => ({
      base: parseFloat(getComputedStyle(el.parentElement!).getPropertyValue('--ticker-s')),
      run: parseFloat(getComputedStyle(el).animationDuration),
    }));
    expect(run / base).toBeCloseTo(40 / 30, 2);
    await page.locator('.ticker').tap();
    await expect(track).toHaveCSS('animation-play-state', 'paused');
  });
});

test.describe('rows to swipe and the carousel (§8.3–8.4)', () => {
  test.use({ viewport: { width: 390, height: PHONE.height } });

  test('the other builds: native snap, keys step it, dots follow; every card stays reachable', async ({
    page,
  }) => {
    await page.goto(V2);
    const track = page.locator('#projects-carousel');
    await expect(track).toHaveAttribute('aria-roledescription', 'carousel');
    await expect(track).toHaveAttribute('role', 'region');
    expect(await track.evaluate((el) => getComputedStyle(el).scrollSnapType)).toMatch(/x/);
    const prev = page.locator('[data-carousel-step="-1"]');
    const next = page.locator('[data-carousel-step="1"]');
    const on = page.locator('.carousel__dots [data-on]');
    await expect(prev).toHaveAttribute('aria-disabled', 'true');
    await expect(prev).toHaveAccessibleName(/previous/);
    await next.click();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    await expect(prev).toHaveAttribute('aria-disabled', 'false');
    const dots = page.locator('.carousel__dots i');
    await expect(dots.nth(1)).toHaveAttribute('data-on', '');
    await next.click();
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(on).toHaveCount(1);
    // Each card says where it is ("2 of 3") and its links stay in the Tab order.
    const cards = track.locator(':scope > article');
    const count = await cards.count();
    for (let i = 0; i < count; i++)
      await expect(cards.nth(i).locator('.pc__pos')).toHaveText(
        copy.projects.position.replace('{n}', String(i + 1)).replace('{count}', String(count)),
      );
    // Never moves by itself (once a key's smooth scroll has come to rest).
    const left = () => track.evaluate((el) => Math.round(el.scrollLeft));
    let at = -1;
    await expect.poll(async () => at === (at = await left()), { intervals: [300] }).toBe(true);
    await page.waitForTimeout(1500);
    expect(await left()).toBe(at);
    // `list all ▸` opens the directory.
    await expect(page.locator('.carousel__all')).toHaveAttribute('href', /projects\/$/);
  });

  test('coursework and each skill group are one row of 44 px slots; arrow keys walk them', async ({
    page,
  }) => {
    await page.goto(V2);
    for (const sel of ['.edu__course-list', '.sk__items']) {
      const row = page.locator(sel).first();
      expect(await row.evaluate((el) => getComputedStyle(el).flexWrap)).toBe('nowrap');
      expect(await row.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
      const h = await row
        .locator('[data-tip]')
        .first()
        .evaluate((el) => el.getBoundingClientRect().height);
      expect(h).toBeGreaterThanOrEqual(44);
    }
    // The XP card's honors are in the Education card on a phone (the same lines, not repeated).
    await expect(page.locator('.xp__honors')).toBeHidden();
    await expect(page.locator('.edu__honors--phone li')).toHaveCount(
      await page.locator('.xp__honors li[data-at-school]').count(),
    );
  });
});

test.describe('commit rows (§8.3)', () => {
  test.use({ viewport: { width: 390, height: PHONE.height } });

  test('real <details>: folded but the first, a 44 px summary opens one', async ({ page }) => {
    await page.goto(V2);
    const folds = page.locator('details.commit__fold');
    const n = await folds.count();
    expect(n).toBeGreaterThan(1);
    expect(await folds.evaluateAll((ds) => ds.map((d) => (d as HTMLDetailsElement).open))).toEqual(
      Array.from({ length: n }, (_, i) => i === 0),
    );
    const second = folds.nth(1);
    const summary = second.locator('summary');
    const box = (await summary.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(second.locator('.commit__body')).toBeHidden();
    await summary.tap();
    await expect(second).toHaveJSProperty('open', true);
    await expect(second.locator('.commit__body')).toBeVisible();
    // Its summary is named by the show command (`git show <hash>`), and folds it again.
    await expect(summary).toHaveAccessibleName(
      new RegExp(copy.experience.show_cmd.split('{')[0]!.trim()),
    );
    await summary.tap();
    await expect(second).toHaveJSProperty('open', false);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: PHONE.height } });

  test('the phone page is whole: nothing folded that cannot be opened, every link there', async ({
    page,
  }) => {
    await page.goto(V2);
    // Open details, the whole terminal, rows that wrap, cards that stack.
    expect(
      await page
        .locator('details.commit__fold')
        .evaluateAll((ds) => ds.every((d) => (d as HTMLDetailsElement).open)),
    ).toBe(true);
    await expect(page.locator('.hero__ln--ok')).toBeVisible();
    await expect(page.locator('[data-fold]')).toBeHidden();
    expect(
      await page.locator('.edu__course-list').evaluate((el) => getComputedStyle(el).flexWrap),
    ).toBe('wrap');
    await expect(page.locator('.carousel')).toBeHidden();
    // The hotbar's four section links work as anchors.
    await expect(hotbar(page).getByRole('link')).toHaveCount(4);
  });
});

test.describe('tap-to-copy (§8.3 Contact)', () => {
  test.use({ viewport: { width: 390, height: PHONE.height } });

  test('copies the address, says so on the key and in a status toast above the hotbar', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium’s');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(V2);
    const key = page.locator('[data-copy-email]').first();
    const address = (await key.getAttribute('data-copy-email'))!;
    await expect(key).toHaveAccessibleName(copy.hero.copy_label.replace('{handle}', address));
    await key.scrollIntoViewIfNeeded();
    await key.tap();
    const toast = page.getByRole('status').filter({ hasText: address });
    await expect(toast).toHaveText(`${copy.hero.ok} ${copy.hero.copied} ${address}`);
    await expect(key).toHaveAttribute('data-done', '');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
    const t = (await toast.boundingBox())!;
    const bar = (await hotbar(page).boundingBox())!;
    expect(t.y + t.height).toBeLessThanOrEqual(bar.y);
    // The bars stay while it shows.
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.dataset.bars ?? 'shown')).toBe(
      'shown',
    );
  });

  test('without the Clipboard API the address is still a link and selectable text', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined });
      document.execCommand = () => false;
    });
    await page.goto(V2);
    const row = page.locator('.contact__mail-list li').first();
    const link = row.locator('a[href^="mailto:"]');
    await expect(link).toHaveAttribute('href', /^mailto:/);
    await row.locator('[data-copy-email]').tap();
    // Nothing claimed; the address is selected for the system's own copy.
    expect(await page.evaluate(() => getSelection()?.toString())).toBe(await link.innerText());
    await expect(page.locator('[data-toast]')).toBeEmpty();
  });
});

test.describe('the Clock Stamp phone’s city keys (§6 row 11 on a phone)', () => {
  test.use({ viewport: { width: 390, height: PHONE.height } });

  test('a row of 44 px keys picks the city; the 24 px hand tags leave the Tab order', async ({
    page,
  }) => {
    await page.goto(V2);
    const row = page.getByRole('group', { name: copy.projects.phone.pick_label });
    await expect(row).toHaveCount(1);
    const keys = row.getByRole('button');
    await expect(keys).toHaveCount(copy.projects.phone.cities.length);
    const sha = copy.projects.phone.cities.find((c) => c.code === 'SHA')!;
    const key = row.locator(`[data-city-key="${sha.time_zone}"]`);
    await key.tap();
    await expect(key).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-clock-city]')).toHaveText(sha.name);
    expect(
      await page
        .locator('.dial .hand__tag')
        .evaluateAll((ks) => ks.every((k) => (k as HTMLElement).tabIndex === -1)),
    ).toBe(true);
    await expect(page.locator('.dial')).toHaveAttribute('aria-hidden', 'true');
  });
});

test.describe('mobile graphics (§8.5)', () => {
  test('tier 2 by default, and no WebGL context is ever made on a phone', async ({ page }) => {
    await page.addInitScript(() => {
      const made: string[] = [];
      (window as unknown as { __gl: string[] }).__gl = made;
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: string,
        ...rest: unknown[]
      ) {
        made.push(kind);
        return (get as (...a: unknown[]) => RenderingContext | null).call(this, kind, ...rest);
      } as typeof get;
    });
    await page.goto(`${V2}?tier=auto`);
    await expect(page.locator('html')).toHaveAttribute('data-tier', '2');
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(2500);
    const made = await page.evaluate(() => (window as unknown as { __gl: string[] }).__gl);
    expect(made.filter((k) => /webgl/i.test(k))).toEqual([]);
  });

  test('lite mode for a 4 GB phone: still stars, no motes, 1× pixels', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 }),
    );
    await page.goto(`${V2}?tier=2`);
    await expect(page.locator('html')).toHaveAttribute('data-lite', '');
    await expect(page.locator('html')).toHaveAttribute('data-lite-reason', 'memory');
    const canvas = page.locator('canvas.ambient');
    await expect(canvas).toHaveCount(1, { timeout: 10_000 });
    await page.waitForTimeout(600);
    const s = await canvas.evaluate((c) => ({
      st: (c as HTMLCanvasElement & { ambientStatus: { motes: number; running: boolean } })
        .ambientStatus,
      ratio: (c as HTMLCanvasElement).width / c.getBoundingClientRect().width,
    }));
    expect(s.st.motes).toBe(0);
    expect(s.st.running).toBe(false);
    expect(s.ratio).toBeCloseTo(1, 1);
  });

  test('the ambient canvas keeps its size when only the height changes (an address bar)', async ({
    page,
  }) => {
    await page.goto(`${V2}?tier=2`);
    const canvas = page.locator('canvas.ambient');
    await expect(canvas).toHaveCount(1, { timeout: 10_000 });
    const before = await canvas.evaluate((c) => [
      (c as HTMLCanvasElement).width,
      (c as HTMLCanvasElement).height,
    ]);
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.width, height: vp.height - 80 });
    await page.waitForTimeout(400);
    expect(
      await canvas.evaluate((c) => [
        (c as HTMLCanvasElement).width,
        (c as HTMLCanvasElement).height,
      ]),
    ).toEqual(before);
  });
});
