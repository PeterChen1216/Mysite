// Graphics tiers and the WebGL scene (PLAN-EXPERIENCE §7, acceptance F; PLAN §8 M2).
// Headless Chromium draws WebGL in software (SwiftShader): an automated or software-rendering
// browser never gets the scene by default, so the scene's tests force it with `?tier=3`.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { THEMES } from '../../src/prefs/model';
import { changedFraction, samplePositions, webglShare } from '../../src/scene/share';
import { runningLoops } from './animations';
import { copy } from './copy';
import { V2, open } from './site';

const KEY = 'zhic:prefs:v1';
const TIER3 = `${V2}?tier=3`;

const tierOf = (page: Page) =>
  page.evaluate(() => ({
    tier: document.documentElement.dataset.tier,
    reason: document.documentElement.dataset.tierReason,
  }));

interface Status {
  state: string;
  frames: number;
  firstFrameAt: number | null;
  shownAt: number | null;
  settled: boolean;
  fade: number;
  scroll: number;
  draws: number;
  dpr: number;
  running: boolean;
  time: number;
  earth: number;
  sky: number[];
  stop: number;
  stopName: string;
  stops: Array<{ name: string; at: number }>;
  assembled: string[];
  cartRow: number;
  cartY: number;
  beam: number;
  windowOpen: boolean;
}
const status = (page: Page) =>
  page.evaluate(
    () =>
      (
        document.querySelector('canvas.scene') as
          (HTMLCanvasElement & { sceneStatus?: unknown }) | null
      )?.sceneStatus ?? null,
  ) as Promise<Status | null>;

/** Scroll to `y` and wait for the scene to have drawn (or skipped) the frame for it. */
async function sceneAt(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.waitForFunction(() => {
    const s = (
      document.querySelector('canvas.scene') as HTMLCanvasElement & {
        sceneStatus?: { scroll: number; settled: boolean };
      }
    )?.sceneStatus;
    return !!s && Math.abs(s.scroll - window.scrollY) < 1 && s.settled;
  });
}

/** The viewport as raw RGBA pixels. */
async function pixels(page: Page) {
  const png = await page.screenshot();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

/**
 * The share of the viewport the scene changes: with the canvas, and with it made transparent
 * (its fade-in transition switched off for the measurement).
 */
async function sceneFraction(page: Page) {
  await page.addStyleTag({ content: 'canvas.scene { transition: none !important; }' });
  const on = await pixels(page);
  const hide = await page.addStyleTag({ content: 'canvas.scene { opacity: 0 !important; }' });
  const off = await pixels(page);
  await hide.evaluate((el) => (el as Element).remove());
  return changedFraction(on.data, off.data);
}

/**
 * Text set on the page background, measured over what is really behind it: every visible line of
 * text in the nav, the hero copy, the ticker and the section headers, against the pixels in its
 * box once all text is made transparent. A line fails when more than 2 % of those pixels are
 * below WCAG's ratio for its size (4.5, or 3 for large text) against the text's colour.
 */
async function textContrastProblems(page: Page): Promise<string[]> {
  const lines = await page.evaluate(() => {
    const lum = (c: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
    };
    const out: Array<{ text: string; rects: number[][]; lum: number; ratio: number }> = [];
    const roots = document.querySelectorAll(
      '.nav, .hero__copy > :not(.term):not(.hero__ctas), .ticker, .sh, .community__head, .contact__head, .contact__mail, .pc--next',
    );
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement!;
        const text = (n.textContent ?? '').trim();
        if (!text || el.closest('[aria-hidden="true"], .visually-hidden, .mc-btn, .term')) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden') continue;
        const rgb = (cs.color.match(/[\d.]+/g) ?? []).map(Number);
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
        const range = document.createRange();
        range.selectNodeContents(n);
        const rects = [...range.getClientRects()]
          .filter((r) => r.width > 2 && r.bottom > 0 && r.top < innerHeight)
          .map((r) => [r.left, r.top, r.right, r.bottom]);
        if (rects.length)
          out.push({ text: text.slice(0, 24), rects, lum: lum(rgb), ratio: large ? 3 : 4.5 });
      }
    }
    return out;
  });
  const hide = await page.addStyleTag({
    content: '* { color: transparent !important; text-shadow: none !important; }',
  });
  const { data, width, height } = await pixels(page);
  await hide.evaluate((el) => (el as Element).remove());
  const dpr = width / (await page.evaluate(() => innerWidth));
  const lum = (o: number) => {
    const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(data[o]!) + 0.7152 * f(data[o + 1]!) + 0.0722 * f(data[o + 2]!);
  };
  const problems: string[] = [];
  for (const line of lines) {
    let total = 0;
    let low = 0;
    let worst = Infinity;
    for (const [l, t, r, b] of line.rects) {
      for (
        let y = Math.max(0, Math.floor(t! * dpr));
        y < Math.min(height, Math.ceil(b! * dpr));
        y++
      )
        for (
          let x = Math.max(0, Math.floor(l! * dpr));
          x < Math.min(width, Math.ceil(r! * dpr));
          x++
        ) {
          const bg = lum((y * width + x) * 4);
          const ratio = (Math.max(bg, line.lum) + 0.05) / (Math.min(bg, line.lum) + 0.05);
          total++;
          if (ratio < line.ratio) low++;
          worst = Math.min(worst, ratio);
        }
    }
    if (total && low / total > 0.02)
      problems.push(
        `"${line.text}": ${((low / total) * 100).toFixed(1)} % of its background below ${line.ratio}:1 (worst ${worst.toFixed(2)})`,
      );
  }
  return problems;
}

const seed = (page: Page, prefs: object) =>
  page.addInitScript(([k, v]) => localStorage.setItem(k!, v!), [KEY, JSON.stringify(prefs)]);

test.describe('graphics tiers (§7.2)', () => {
  test('an automated browser gets the plain page, and the scene is never fetched', async ({
    page,
  }) => {
    const fetched: string[] = [];
    page.on('request', (r) => fetched.push(r.url()));
    await page.goto(V2, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    expect(await tierOf(page)).toEqual({ tier: '1', reason: 'automation' });
    expect(fetched.filter((u) => /\/renderer\.[\w-]+\.js$/.test(u))).toEqual([]);
    expect(await page.locator('canvas.scene').count()).toBe(0);
  });

  test('decided as for a person (?tier=auto): a software renderer or a phone gets no scene', async ({
    page,
    isMobile,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'WebKit masks its renderer; its default tier is not asserted',
    );
    await page.goto(`${V2}?tier=auto`);
    await expect
      .poll(() => tierOf(page), { timeout: 10_000 })
      .toEqual(isMobile ? { tier: '2', reason: 'device' } : { tier: '1', reason: 'software' });
    expect(await page.locator('canvas.scene').count()).toBe(0);
  });

  test('?tier=0: static from the first paint — no loops, no intro', async ({ page }) => {
    await page.goto(`${V2}?tier=0`);
    expect(
      await page.evaluate(() => ({
        tier: document.documentElement.dataset.tier,
        classes: [...document.documentElement.classList].sort(),
      })),
    ).toEqual({ tier: '0', classes: ['js'] });
    await page.waitForTimeout(300);
    expect(await runningLoops(page)).toBe(0);
  });

  test('reduced motion wins over ?tier=3; more contrast keeps the plain page', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(TIER3);
    expect(await tierOf(page)).toEqual({ tier: '0', reason: 'motion' });
    await page.emulateMedia({ reducedMotion: 'no-preference', contrast: 'more' });
    await page.goto(`${V2}?tier=auto`);
    expect(await tierOf(page)).toEqual({ tier: '1', reason: 'contrast' });
  });
});

test.describe('the scene at tier 3', () => {
  test.skip(({ isMobile }) => isMobile, 'tier 3 is the desktop scene (DECISIONS Q2)');

  test('loads after the page is usable, as its own chunk, decorative and behind everything', async ({
    page,
  }) => {
    const chunk: { at: number }[] = [];
    page.on('request', (r) => {
      if (/\/renderer\.[\w-]+\.js$/.test(r.url())) chunk.push({ at: Date.now() });
    });
    await open(page, TIER3);
    expect(chunk).toHaveLength(1);
    const t = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const res = performance
        .getEntriesByType('resource')
        .find((r) => /\/renderer\.[\w-]+\.js$/.test(r.name))!;
      return { load: nav.loadEventEnd, chunk: res.startTime };
    });
    expect(t.chunk).toBeGreaterThanOrEqual(t.load);
    const s = (await status(page))!;
    expect(s.firstFrameAt!).toBeGreaterThan(t.load);
    // PLAN-EXPERIENCE §7.5: first scene frame ≤ 1.5 s after LCP.
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) =>
          new PerformanceObserver((list) => {
            const all = list.getEntries();
            resolve(all[all.length - 1]!.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true }),
        ),
    );
    expect(s.firstFrameAt! - lcp).toBeLessThanOrEqual(1500);

    const canvas = page.locator('canvas.scene');
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(
      await canvas.evaluate((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          position: cs.position,
          z: cs.zIndex,
          events: cs.pointerEvents,
          tab: (el as HTMLElement).tabIndex,
          fills:
            r.width === innerWidth - (innerWidth - document.documentElement.clientWidth) &&
            r.height === innerHeight,
        };
      }),
    ).toEqual({ position: 'fixed', z: '-1', events: 'none', tab: -1, fills: true });
    // One WebGL context on the page (PLAN-EXPERIENCE §1.4.5).
    expect(await page.locator('canvas').count()).toBeLessThanOrEqual(2); // + the 2D hover layer
  });

  test('replaces the DOM art behind the same content; the globe slider turns the WebGL Earth', async ({
    page,
    browserName,
  }) => {
    await open(page, TIER3);
    const hidden = (sel: string) =>
      page
        .locator(sel)
        .first()
        .evaluate((el) => getComputedStyle(el).visibility);
    await expect.poll(() => hidden('.bg')).toBe('hidden');
    for (const sel of [
      '.stage__block',
      '.stage__orbit',
      '.stage__globe .globe__inner',
      '.about__block',
    ])
      await expect.poll(() => hidden(sel), { message: sel }).toBe('hidden');
    for (const sel of ['.stage__card', '.stage__tip', '.stage [data-globe]', 'h1', '#about .inv'])
      await expect(page.locator(sel).first(), sel).toBeVisible();
    test.skip(browserName === 'webkit', 'Safari does not Tab to every element by default');
    const globe = page.getByRole('slider', { name: copy.hero.globe_label, exact: true });
    await globe.focus();
    await page.keyboard.press('Home');
    await expect.poll(async () => Math.round((await status(page))!.earth)).toBe(0);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Math.round((await status(page))!.earth)).toBe(15);
  });

  test('paused, the globe slider still turns the WebGL Earth (and nothing else moves)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'keyboard focus on the slider: Chromium (as above)');
    await open(page, TIER3);
    await page.keyboard.press('p');
    const globe = page.getByRole('slider', { name: copy.hero.globe_label, exact: true });
    await globe.focus();
    await page.keyboard.press('Home');
    await expect.poll(async () => Math.round((await status(page))!.earth)).toBe(0);
    await page.keyboard.press('PageUp');
    await expect.poll(async () => Math.round((await status(page))!.earth)).toBe(90);
    const held = (await status(page))!;
    await page.waitForTimeout(400);
    expect((await status(page))!.frames).toBe(held.frames);
    expect((await status(page))!.time).toBe(held.time);
  });

  test('the camera follows the scroll through stops 1–6, all the way down; held, it stops drawing', async ({
    page,
  }) => {
    await open(page, TIER3);
    await page.keyboard.press('p'); // hold the loops: frames now come only from scrolling
    await sceneAt(page, 0);
    const { stops } = (await status(page))!;
    // M3: hero, island, orbit (M2) and the workbench, the canyon (top and end), the world.
    expect(stops.map((s) => s.name)).toEqual([
      'hero',
      'island',
      'orbit',
      'workbench',
      'canyon',
      'canyon-end',
      'world',
    ]);
    for (const [i, s] of stops.entries()) {
      await sceneAt(page, Math.round(s.at));
      const now = (await status(page))!;
      expect(now.stopName, s.name).toBe(s.name);
      expect(now.stop).toBe(i);
      // It no longer dissolves after About (M2): the world goes on behind Projects and below.
      expect(now.fade).toBe(0);
      await expect(page.locator('canvas.scene')).toHaveCSS('visibility', 'visible');
    }
    // Settled and held at the bottom: no more frames until something changes.
    const frames = (await status(page))!.frames;
    await page.waitForTimeout(400);
    expect((await status(page))!.frames).toBe(frames);
    await sceneAt(page, 0);
    expect((await status(page))!.frames).toBeGreaterThan(frames);
    expect((await status(page))!.stopName).toBe('hero');
  });

  test('keyboard flight: ↓ / PgDn fly through the stops in order, Home flies back (no scroll-jacking)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'keyboard scrolling of the page body: Chromium');
    await open(page, TIER3);
    await page.keyboard.press('p');
    await page.locator('body').click({ position: { x: 4, y: 300 } });
    const seen: string[] = [];
    const settle = () =>
      page.waitForFunction(() => {
        const s = (
          document.querySelector('canvas.scene') as HTMLCanvasElement & {
            sceneStatus?: { scroll: number; settled: boolean };
          }
        )?.sceneStatus;
        return !!s && Math.abs(s.scroll - window.scrollY) < 1 && s.settled;
      });
    for (let i = 0; i < 60; i++) {
      const before = await page.evaluate(() => scrollY);
      await page.keyboard.press(i % 2 ? 'PageDown' : 'ArrowDown');
      await page.waitForFunction((y) => scrollY !== y, before, { timeout: 2000 }).catch(() => {});
      await settle();
      const name = (await status(page))!.stopName;
      if (seen.at(-1) !== name) seen.push(name);
      if (
        await page.evaluate(
          () => scrollY + innerHeight >= document.documentElement.scrollHeight - 1,
        )
      )
        break;
    }
    // Every stop, each once, in order: the camera follows the page; it never jumps or runs back.
    expect(seen).toEqual(['hero', 'island', 'orbit', 'workbench', 'canyon', 'canyon-end', 'world']);
    await page.keyboard.press('Home');
    await page.waitForFunction(() => scrollY === 0);
    await settle();
    expect((await status(page))!.stopName).toBe('hero');
  });

  test('stop 4: each project assembles on the workbench as its card comes into view', async ({
    page,
  }) => {
    await open(page, TIER3);
    const ids = await page
      .locator('#projects article[id^="project-"]')
      .evaluateAll((els) => els.map((e) => e.id.replace('project-', '')));
    expect((await status(page))!.assembled).toEqual([]);
    for (const id of ids) {
      await page.locator(`#project-${id}`).scrollIntoViewIfNeeded();
      await expect.poll(async () => (await status(page))!.assembled).toContain(id);
    }
  });

  test('stop 5: the minecart rides beside the git log, at the row in the middle of the view', async ({
    page,
  }) => {
    await open(page, TIER3);
    await page.keyboard.press('p');
    const rows = await page
      .locator('#experience .commit, #community .commit')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top + scrollY));
    expect(rows.length).toBeGreaterThan(1);
    for (const i of [0, rows.length - 1]) {
      const vh = await page.evaluate(() => innerHeight);
      await sceneAt(page, Math.round(rows[i]! + 20 - vh / 2));
      await expect.poll(async () => (await status(page))!.cartRow).toBe(i);
      const s = (await status(page))!;
      expect(Math.abs(s.cartY - (rows[i]! + 20))).toBeLessThan(40);
    }
  });

  test('stop 6: the beacon’s beam is on at Contact and pulses with the ping; pause holds it', async ({
    page,
  }) => {
    await open(page, TIER3);
    await sceneAt(page, 0);
    expect((await status(page))!.beam).toBe(0);
    const bottom = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    await sceneAt(page, bottom);
    // Running: the level changes as the pings come (one a second).
    const levels = new Set<number>();
    for (let i = 0; i < 8; i++) {
      levels.add(Math.round((await status(page))!.beam * 100));
      await page.waitForTimeout(150);
    }
    expect(Math.max(...levels)).toBeGreaterThan(0);
    expect(levels.size).toBeGreaterThan(1);
    await page.keyboard.press('p');
    const held = (await status(page))!.beam;
    await page.waitForTimeout(500);
    expect((await status(page))!.beam).toBe(held);
  });

  test('a window open over the page holds the world, which goes on when it closes', async ({
    page,
  }) => {
    await open(page, TIER3);
    await page.locator('#projects .sh__more').click();
    await expect(page.locator('dialog[data-window-kind="directory"]')).toBeVisible();
    await expect.poll(async () => (await status(page))!.windowOpen).toBe(true);
    await expect.poll(async () => (await status(page))!.running).toBe(false);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await status(page))!.running).toBe(true);
  });

  test('pause holds it, calm slows it, motion off removes it and brings the DOM art back', async ({
    page,
  }) => {
    await open(page, TIER3);
    const now = async () => (await status(page))!;
    /** The scene clock's rate against the wall clock over `ms` (frames may be slow: in software
     * WebGL a frame can take longer than the clock's 100 ms step, so only ratios are compared). */
    const rate = async (ms: number) => {
      const a = await now();
      const t = Date.now();
      await page.waitForTimeout(ms);
      const b = await now();
      return { rate: (b.time - a.time) / (Date.now() - t), frames: b.frames - a.frames };
    };
    // Full motion: the scene clock runs.
    const full = await rate(1200);
    expect(full.frames).toBeGreaterThan(0);
    expect(full.rate).toBeGreaterThan(0);
    // Pause: nothing moves, no frames are drawn.
    await page.keyboard.press('p');
    await page.waitForTimeout(600);
    const held = await rate(600);
    expect(held).toEqual({ rate: 0, frames: 0 });
    await page.keyboard.press('p');
    // Calm: a third of full motion's pace.
    await page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({ motion: 'calm' }));
      window.dispatchEvent(new StorageEvent('storage', { key: k }));
    }, KEY);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.motion))
      .toBe('calm');
    const calm = await rate(1200);
    expect(calm.frames).toBeGreaterThan(0);
    expect(calm.rate / full.rate).toBeGreaterThan(0.15);
    expect(calm.rate / full.rate).toBeLessThan(0.6);
    // Off: tier 0 — the scene goes, the DOM art is back.
    await page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({ motion: 'off' }));
      window.dispatchEvent(new StorageEvent('storage', { key: k }));
    }, KEY);
    await expect.poll(() => tierOf(page)).toEqual({ tier: '0', reason: 'motion' });
    await expect(page.locator('canvas.scene')).toHaveCSS('visibility', 'hidden');
    expect(await page.evaluate(() => document.documentElement.dataset.scene)).toBeUndefined();
    await expect(page.locator('.stage__block').first()).toBeVisible();
    // Back on: the scene returns without a reload.
    await page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({ motion: 'full' }));
      window.dispatchEvent(new StorageEvent('storage', { key: k }));
    }, KEY);
    await expect.poll(() => tierOf(page)).toEqual({ tier: '3', reason: 'query' });
    await expect(page.locator('canvas.scene')).toHaveCSS('visibility', 'visible');
  });

  test('the watchdog: slow frames lower the resolution, then the tier, for the session', async ({
    page,
  }) => {
    test.slow();
    await open(page, `${TIER3}&debug=slow`);
    await expect
      .poll(async () => (await status(page))?.dpr ?? 0, { timeout: 15_000 })
      .toBeLessThan(1);
    await expect
      .poll(() => tierOf(page), { timeout: 30_000 })
      .toEqual({
        tier: '2',
        reason: 'watchdog',
      });
    expect(await page.locator('canvas.scene').count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.dataset.scene)).toBeUndefined();
    await expect(page.locator('.stage__block').first()).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('zhic:tier'))).toBe('2');
    // The rest of the session, decided as for a person: tier 2, and why.
    await page.goto(`${V2}?tier=auto`);
    expect(await tierOf(page)).toEqual({ tier: '2', reason: 'watchdog' });
  });

  test('?debug=1 shows the HUD: fps, frame time, tier and why, draw calls, pixel ratio', async ({
    page,
  }) => {
    await open(page, `${TIER3}&debug=1`);
    const hud = page.locator('.scene-hud');
    await expect(hud).toHaveAttribute('aria-hidden', 'true');
    const pattern = copy.scene.hud
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{(fps|ms|draws|dpr)\\\}/g, '[\\d.]+')
      .replace('\\{tier\\}', '3')
      .replace('\\{reason\\}', 'query');
    await expect(hud).toHaveText(new RegExp(`^${pattern}$`), { timeout: 5000 });
    // At tier 1 the HUD still says which tier and why.
    await page.goto(`${V2}?debug=1`);
    await expect(page.locator('.scene-hud')).toContainText('automation');
  });

  test('axe: no serious or critical violations with the scene live; no layout shift', async ({
    page,
  }) => {
    await open(page, TIER3);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    expect(
      results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => v.id),
    ).toEqual([]);
    const cls = await page.evaluate(
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
    expect(cls).toBeLessThanOrEqual(0.05);
  });
});

test.describe('the scene in every theme', () => {
  test.skip(({ isMobile }) => isMobile, 'tier 3 is the desktop scene');
  for (const theme of THEMES) {
    test(`${theme}: the world is there, on the theme's own sky, and follows a theme change`, async ({
      page,
      browserName,
    }) => {
      await seed(page, { theme });
      // In Chromium, the same day and night and the same face of the Earth on every run (the
      // pinned clock and Home key of 5d1a308): with the real time, how much of the world is lit
      // depends on the hour and on where the turning globe stopped — CI measured cvd at 4.4 % at
      // 18:28 UTC (aa02a4d). WebKit keeps the real time: those two steps do not work there
      // (768e421), and it draws the world larger (13.7 % at the same hour).
      const pinned = browserName === 'chromium';
      if (pinned) await page.clock.install({ time: new Date('2026-11-10T20:00:00Z') });
      await open(page, TIER3);
      await page.keyboard.press('p');
      if (pinned) {
        await page.getByRole('slider', { name: copy.hero.globe_label, exact: true }).focus();
        await page.keyboard.press('Home');
        await expect.poll(async () => Math.round((await status(page))!.earth)).toBe(0);
        await page.locator('h1').click(); // focus away (its ring is not part of the world)
      }
      await sceneAt(page, 0);
      // The content hidden: what is left is the canvas.
      await page.addStyleTag({ content: '.page, .scene-hud { visibility: hidden !important; }' });
      const bg = await page.evaluate(
        () => getComputedStyle(document.documentElement).backgroundColor,
      );
      const [r, g, b] = (bg.match(/[\d.]+/g) ?? []).map(Number) as [number, number, number];
      const { data, width, height } = await pixels(page);
      const at = (x: number, y: number) => {
        const o = (y * width + x) * 4;
        return [data[o]!, data[o + 1]!, data[o + 2]!];
      };
      // The sky — the colour most of the canvas shows — is the page background.
      const counts = new Map<string, number>();
      for (let y = 0; y < height; y += 7)
        for (let x = 0; x < width; x += 7) {
          const k = at(x, y).join(',');
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      const sky = [...counts]
        .sort((p, q) => q[1] - p[1])[0]![0]
        .split(',')
        .map(Number);
      expect(Math.max(...sky.map((c, i) => Math.abs(c - [r, g, b][i]!)))).toBeLessThanOrEqual(1);
      // The world: a good part of the screen differs from the background.
      let world = 0;
      for (let i = 0; i < data.length; i += 4)
        if (
          Math.max(Math.abs(data[i]! - r), Math.abs(data[i + 1]! - g), Math.abs(data[i + 2]! - b)) >
          24
        )
          world++;
      console.log(
        `${theme}: the world covers ${((world / (width * height)) * 100).toFixed(1)} % of the screen`,
      );
      // How much of the Earth is lit follows the real time, and Mono dark's night side is close
      // to its black sky: 5 % (65,000 px at 1440 × 900) is far more than an empty sky, and less
      // than any theme shows at night (Chromium, pinned to 20:00 UTC: 10.0–10.9 %; CI's Mono dark
      // at night: 7.4 %).
      expect(world / (width * height)).toBeGreaterThan(0.05);
    });
  }

  test('a theme change recolours the scene without a reload', async ({
    page,
    browserName,
  }, info) => {
    await open(page, TIER3);
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    await page.keyboard.press(',');
    const before = (await status(page))!.frames;
    await page.locator('input[name="theme"][value="day"]').check();
    await page.keyboard.press('Escape');
    const bg = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
    expect(bg).not.toBe('rgb(11, 15, 26)'); // Day's paper, not Night's navy
    // The scene re-read its colours from the tokens: its sky is Day's page background …
    await expect.poll(async () => `rgb(${(await status(page))!.sky.join(', ')})`).toBe(bg);
    // … and it has drawn with them (a few frames: in software WebGL a frame is slow).
    await expect
      .poll(async () => (await status(page))!.frames, { timeout: 15_000 })
      .toBeGreaterThan(before + 3);
    await page.addStyleTag({ content: '.page { visibility: hidden !important; }' });
    // On screen: the colour most of the canvas shows.
    const { data, width, height } = await pixels(page);
    const counts = new Map<string, number>();
    for (let y = 0; y < height; y += 7)
      for (let x = 0; x < width; x += 7) {
        const o = (y * width + x) * 4;
        const k = `rgb(${data[o]}, ${data[o + 1]}, ${data[o + 2]})`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    const shown = [...counts].sort((p, q) => q[1] - p[1])[0]![0];
    if (browserName === 'webkit') {
      // CI's WebKit screenshots kept showing the pre-change frame of its software-rendered
      // canvas while the scene had switched (WebKitGTK here shows the change on screen;
      // docs/STATUS.md). Recorded, not asserted, there.
      info.annotations.push({ type: 'webkit sky on screen', description: `${shown} (page ${bg})` });
      console.log(`[webkit] after a theme change: scene sky ${shown} on screen, page ${bg}`);
    } else expect(shown).toBe(bg);
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  });
});

test.describe('text over the scene keeps its contrast (the scrim, every theme)', () => {
  test.skip(
    ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
    'measured once, on desktop Chromium (pixels, not engine behaviour)',
  );
  for (const theme of THEMES)
    for (const width of [1440, 1024])
      test(`${theme} at ${width} px: hero, About, Projects, Experience, Contact`, async ({
        page,
      }) => {
        // Nine places since M3, each two screenshots of a software-drawn scene: held (pause), so
        // each place is drawn once and settles at once.
        test.slow();
        await page.setViewportSize({ width, height: 900 });
        await seed(page, { theme });
        await open(page, TIER3);
        await page.keyboard.press('p');
        await page.addStyleTag({ content: 'canvas.scene { transition: none !important; }' });
        const at = await page.evaluate(() => {
          const top = (sel: string) =>
            document.querySelector(sel)!.getBoundingClientRect().top + scrollY;
          const about = document.querySelector('#about')!.getBoundingClientRect();
          return {
            header: top('#about .sh') - innerHeight * 0.16,
            avgeek: top('#avgeek') - innerHeight * 0.3,
            fading: about.bottom + scrollY - innerHeight * 0.35,
            // M3: the workbench in Projects' header, the "next chunk" card, the canyon beside the
            // git log, the community log's heading, and the world at Contact.
            projects: top('#projects .sh') - innerHeight * 0.16,
            next: top('.pc--next') - innerHeight * 0.3,
            experience: top('#experience .sh') - innerHeight * 0.2,
            community: top('#community') - innerHeight * 0.3,
            contact: document.documentElement.scrollHeight - innerHeight,
          };
        });
        const problems: string[] = [];
        for (const y of Object.values(at)) {
          await sceneAt(page, Math.round(y));
          problems.push(
            ...(await textContrastProblems(page)).map((p) => `at ${Math.round(y)}: ${p}`),
          );
        }
        expect(problems).toEqual([]);
      });
});

test.describe('the WebGL share (§7.2: ≥ 60 % of the desktop scroll length at M3)', () => {
  test.skip(
    ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
    'measured once, on desktop Chromium',
  );
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [1280, 800],
    [1024, 768],
  ] as const) {
    test(`${width} × ${height}`, async ({ page }, info) => {
      test.slow();
      await page.setViewportSize({ width, height });
      // Held (pause): each sample is the world at that scroll position without the motes and
      // sweeps that come and go — a lower bound, the same on every run, and fast enough for CI.
      await open(page, TIER3);
      await page.keyboard.press('p');
      const length = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );
      const samples = [];
      for (const scroll of samplePositions(length, 40)) {
        await sceneAt(page, scroll);
        samples.push({ scroll, visible: await sceneFraction(page) });
      }
      const share = webglShare(samples);
      await info.attach('share', {
        body: JSON.stringify({ width, height, length, ...share, samples }, null, 1),
        contentType: 'application/json',
      });
      console.log(
        `WebGL share ${width}×${height}: ${(share.share * 100).toFixed(1)} % of ${length} px` +
          ` (mean ${(share.meanVisible * 100).toFixed(1)} % of the view; ${(share.meanWhenInView * 100).toFixed(1)} % where in view)`,
      );
      // M3 (stops 4–6): ≥ 60 % at every desktop width — 1024 px too, which M2 could only report
      // (PLAN §13 ADR-018 ⑦): the canyon's face now fills the margins beside every section.
      expect(share.share).toBeGreaterThanOrEqual(0.6);
    });
  }
});
