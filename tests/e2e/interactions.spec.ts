// The hover & interaction catalogue (PLAN-EXPERIENCE §6, acceptance E): every row with its
// keyboard twin, the pointer and touch inputs, what calm / off / pause / reduced motion keep, the
// particle cap, a tooltip under axe, and no sticky hover on touch. Night / English (§9.1). Rows
// are numbered as in the plan's table; row 5 (routes) is deferred — aviation.yaml lists none.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { gpaRatio } from '../../src/lib/derive';
import { HOVER } from '../../src/motion/params';
import { domGlobeCenterLon } from '../../src/scene/geo';
import { watchAttribute } from './animations';
import { copy } from './copy';
import { V2, open } from './site';

const KEY = 'zhic:prefs:v1';
const seed = (page: Page, prefs: object) =>
  page.addInitScript(([k, v]) => localStorage.setItem(k!, v!), [KEY, JSON.stringify(prefs)]);
const education = parse(readFileSync('content/education.yaml', 'utf8')) as Array<{ gpa?: string }>;

/** Tab until `target` has focus (a real keyboard focus: :focus-visible). */
async function tabTo(page: Page, target: Locator, max = 120) {
  for (let i = 0; i < max && !(await target.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
}
const noTab = 'Safari does not Tab to every element by default';
/** What the particle overlay has seen (src/scripts/particles.ts). */
const particles = (page: Page) =>
  page.evaluate(
    () =>
      (
        document.querySelector('.particles-layer') as
          | (HTMLCanvasElement & {
              particleStatus?: { alive: number; peak: number; bursts: number };
            })
          | null
      )?.particleStatus ?? { alive: 0, peak: 0, bursts: 0 },
  );
/** Wait for the intro to have played (its animations own the hero art meanwhile). */
const introDone = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => ((a as CSSAnimation).animationName ?? '').startsWith('intro-'))
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
const pseudo = (loc: Locator, which: string, prop: string) =>
  loc.evaluate((el, [w, p]) => getComputedStyle(el, w).getPropertyValue(p!), [which, prop]);
const style = (loc: Locator, prop: string) =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const token = (page: Page, name: string) =>
  page.evaluate((n) => {
    const probe = document.createElement('i');
    probe.style.color = `var(${n})`;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, name);

test.describe('1 · voxel block: punch', () => {
  test('a mouse punches a block: two frames of squash and a burst in its own colours', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'mouse');
    await page.goto(V2);
    await introDone(page);
    const block = page.locator('.stage__block img.voxel').nth(4);
    await block.hover();
    await expect(block).toHaveAttribute('data-punch', '');
    expect(
      await block.evaluate((el) =>
        el.getAnimations().map((a) => (a as CSSAnimation).animationName),
      ),
    ).toContain('punch');
    expect((await particles(page)).bursts).toBeGreaterThan(0);
    await expect(block).not.toHaveAttribute('data-punch', { timeout: 2000 });
  });

  test('a tap punches it on a touch screen', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch');
    await page.goto(V2);
    await introDone(page);
    const block = page.locator('.stage__block img.voxel').nth(4);
    await block.scrollIntoViewIfNeeded();
    await block.tap();
    expect((await particles(page)).bursts).toBeGreaterThan(0);
  });

  test('decoration: blocks take no keyboard focus', async ({ page }) => {
    await page.goto(V2);
    expect(
      await page
        .locator('img.voxel')
        .evaluateAll((els) => els.filter((el) => (el as HTMLElement).tabIndex >= 0).length),
    ).toBe(0);
  });

  for (const how of ['calm', 'off', 'paused'] as const)
    test(`${how}: no punch, no burst`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'mouse');
      if (how !== 'paused') await seed(page, { motion: how });
      await page.goto(V2);
      if (how === 'paused') await page.locator('body').press('p');
      const block = page.locator('.stage__block img.voxel').nth(4);
      await block.hover();
      await page.waitForTimeout(150);
      await expect(block).not.toHaveAttribute('data-punch');
      expect((await particles(page)).bursts).toBe(0);
    });

  test('at tier 3 the WebGL scene’s own block is punched where the DOM one stood', async ({
    page,
    isMobile,
    browserName,
  }) => {
    test.skip(isMobile || browserName !== 'chromium', 'the desktop scene, in Chromium');
    await open(page, `${V2}?tier=3`);
    const box = (await page.locator('.stage__block').nth(5).boundingBox())!;
    await page.mouse.move(box.x - 30, box.y - 30);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              document.querySelector('canvas.scene') as HTMLCanvasElement & {
                sceneStatus?: { punched: number };
              }
            ).sceneStatus?.punched ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    expect((await particles(page)).bursts).toBeGreaterThan(0);
  });
});

test.describe('2 · card: lift, accent edge, spotlight', () => {
  const lifted = async (card: Locator) => ({
    translate: await style(card, 'translate'),
    border: await style(card, 'border-top-color'),
  });

  test('hover lifts it 4 px onto its section’s accent; the spotlight follows the pointer', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'mouse');
    await page.goto(V2);
    const card = page.locator('#education');
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + 60, box.y + 80);
    await expect
      .poll(() => lifted(card))
      .toEqual({
        translate: '0px -4px',
        border: await token(page, '--color-accent-diamond'),
      });
    const spot = card.locator('.card__spot');
    await expect.poll(() => style(spot, 'opacity')).not.toBe('0');
    const at = () => spot.evaluate((el) => el.style.translate);
    const first = await at();
    await page.mouse.move(box.x + 160, box.y + 200, { steps: 3 });
    await expect.poll(at).not.toBe(first);
    // The spotlight is behind the content (it never covers the text).
    expect(await style(spot, 'z-index')).toBe('-1');
  });

  test('keyboard focus inside lifts it too', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', noTab);
    await page.goto(V2);
    const link = page.locator('#education .edu__school a');
    await tabTo(page, link);
    await expect.poll(() => style(page.locator('#education'), 'translate')).toBe('0px -4px');
  });

  test('a finger pressing it lifts it; letting go puts it back (no sticky hover)', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'touch');
    await page.goto(V2);
    const card = page.locator('#skills');
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const point = [{ x: box.x + 20, y: box.y + 12 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
    await expect(card).toHaveAttribute('data-press', '');
    await expect.poll(() => style(card, 'translate')).toBe('0px -4px');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(card).not.toHaveAttribute('data-press');
    await expect.poll(() => style(card, 'translate')).toBe('none');
  });

  test('calm keeps the lift and drops the step into it', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse');
    await seed(page, { motion: 'calm' });
    await page.goto(V2);
    const card = page.locator('#education');
    await card.hover();
    expect(await style(card, 'transition-duration')).toMatch(/^0s/);
    await expect.poll(() => style(card, 'translate')).toBe('0px -4px');
  });
});

test.describe('3 · inventory slots: roving focus, glint, tooltip', () => {
  const slots = (page: Page) => page.locator('#skills [data-tip]');
  const tip = (page: Page) => page.locator('#slot-tip');

  test('one Tab stop; arrows move; the tooltip names the group, place and count; Escape hides it', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', noTab);
    await page.goto(V2);
    const all = slots(page);
    expect(await all.evaluateAll((els) => els.map((e) => (e as HTMLElement).tabIndex))).toEqual([
      0,
      ...Array((await all.count()) - 1).fill(-1),
    ]);
    await tabTo(page, all.first());
    await expect(tip(page)).toBeVisible();
    await expect(tip(page)).toContainText(String(await all.first().getAttribute('data-tip')));
    await expect(all.first()).toHaveAttribute('aria-describedby', 'slot-tip');
    await page.keyboard.press('ArrowRight');
    await expect(all.nth(1)).toBeFocused();
    await expect(tip(page)).toContainText(String(await all.nth(1).getAttribute('data-tip')));
    await page.keyboard.press('End');
    await expect(all.last()).toBeFocused();
    // Escape: the tooltip goes, focus stays.
    await page.keyboard.press('Escape');
    await expect(tip(page)).toBeHidden();
    await expect(all.last()).toBeFocused();
    // The next Tab leaves the list (one stop), and comes back to the slot last used.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(all.last()).toBeFocused();
    // Its words come from copy.yaml.
    const n = await all.count();
    expect(await all.last().getAttribute('data-tip')).toMatch(new RegExp(`${n}|\\d`));
  });

  test('under the pointer: glint and tooltip; the tooltip can be hovered; one at a time', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'mouse');
    await page.goto(V2);
    const a = slots(page).nth(2);
    const glint = await watchAttribute(a, 'data-glint');
    // From now on, every frame: how far the tooltip's bottom is above the slot's top.
    await a.evaluate((slot) => {
      const log: number[] = [];
      (slot as unknown as { __gaps: number[] }).__gaps = log;
      const read = () => {
        const t = document.getElementById('slot-tip');
        if (t?.dataset.on === 'true')
          log.push(slot.getBoundingClientRect().top - t.getBoundingClientRect().bottom);
        if (log.length < 600) requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });
    await a.hover();
    await expect(tip(page)).toBeVisible();
    // It glinted (for 560 ms: recorded as it happened, not polled for).
    await expect.poll(async () => (await glint()).map((c) => c.value)).toContain('');
    // It never covers the slot: not while it rises and the card lifts (both 120 ms, in two steps;
    // each frame since the pointer arrived was read in one go — two reads apart could straddle a
    // step), and at rest it is the gap above the slot.
    await page.waitForTimeout(400);
    const gaps = await a.evaluate((slot) => (slot as unknown as { __gaps: number[] }).__gaps);
    expect(gaps.length).toBeGreaterThan(0);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0);
    const rest = await a.evaluate(
      (slot) =>
        slot.getBoundingClientRect().top -
        document.getElementById('slot-tip')!.getBoundingClientRect().bottom,
    );
    expect(rest).toBeCloseTo(HOVER.tooltip.gapPx, 0);
    const t = (await tip(page).boundingBox())!;
    // Hoverable: moving onto it keeps it.
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 4 });
    await page.waitForTimeout(400);
    await expect(tip(page)).toBeVisible();
    // Another slot: still one tooltip, now its.
    await slots(page).nth(5).hover();
    await expect(page.locator('[role="tooltip"]')).toHaveCount(1);
    await expect(tip(page)).toContainText(
      String(await slots(page).nth(5).getAttribute('data-tip')),
    );
    // Away: gone.
    await page.mouse.move(5, 5);
    await expect(tip(page)).toBeHidden();
  });

  test('a tap shows it on a touch screen; a tap elsewhere hides it', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch');
    await page.goto(V2);
    const course = page.locator('#education [data-tip]').first();
    await course.scrollIntoViewIfNeeded();
    await course.tap();
    await expect(tip(page)).toBeVisible();
    await page.locator('#education .edu__label').tap();
    await expect(tip(page)).toBeHidden();
  });

  test('axe: no serious or critical violations with a tooltip open', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse');
    await page.goto(V2);
    await slots(page).nth(1).hover();
    await expect(tip(page)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    expect(
      results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });

  test('calm: the tooltip, no glint', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse');
    await seed(page, { motion: 'calm' });
    await page.goto(V2);
    await slots(page).nth(2).hover();
    await expect(tip(page)).toBeVisible();
    await expect(slots(page).nth(2)).not.toHaveAttribute('data-glint');
  });
});

test.describe('4 · globe: crosshair and the region under it', () => {
  const readout = (page: Page) => page.locator('.globe__probe-label');
  const where = (deg: number, lat: string, region: keyof typeof copy.hero.globe_regions) => {
    const lon = Math.round(domGlobeCenterLon(deg));
    const lonText = (lon >= 0 ? copy.hero.globe_lon.e : copy.hero.globe_lon.w).replace(
      /\{\s*deg\s*\}/,
      String(Math.abs(lon)),
    );
    return `${lat} ${lonText} · ${copy.hero.globe_regions[region]}`;
  };
  const equator = copy.hero.globe_lat.n.replace(/\{\s*deg\s*\}/, '0');

  test('the keyboard: at the centre, following the keys', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', noTab);
    await page.goto(V2);
    const globe = page.getByRole('slider', { name: copy.hero.globe_label, exact: true });
    await tabTo(page, globe);
    await page.keyboard.press('Home');
    await expect(readout(page)).toHaveText(where(0, equator, 'pacific'));
    await expect(readout(page)).toHaveAttribute('aria-hidden', 'true');
    await page.keyboard.press('PageUp');
    await expect(readout(page)).toHaveText(where(90, equator, 'indian'));
    // The slider's own value is unchanged by it (screen readers have that).
    await expect(globe).toHaveAttribute(
      'aria-valuetext',
      copy.hero.globe_value.replace(/\{\s*deg\s*\}/, '90'),
    );
    await page.keyboard.press('Tab');
    await expect(readout(page)).toHaveAttribute('data-on', 'false');
  });

  test('the pointer: lines through it and where it is; gone when it leaves', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'mouse');
    await page.goto(V2);
    await introDone(page);
    const box = (await page.locator('.stage [data-globe]').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.45, { steps: 3 });
    await expect(readout(page)).toHaveAttribute('data-on', 'true');
    const regions = Object.values(copy.hero.globe_regions);
    await expect(readout(page)).toHaveText(
      new RegExp(`\\d+°[NS] \\d+°[EW] · (${regions.join('|')})$`),
    );
    await page.mouse.move(5, 5);
    await expect(readout(page)).toHaveAttribute('data-on', 'false');
  });

  test('a finger dragging it', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch');
    await page.goto(V2);
    await introDone(page);
    const globe = page.locator('.stage [data-globe]');
    await globe.scrollIntoViewIfNeeded();
    const box = (await globe.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const at = (dx: number) => [{ x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(10) });
    await expect(readout(page)).toHaveAttribute('data-on', 'true');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(readout(page)).toHaveAttribute('data-on', 'false');
  });

  test('at tier 3 it reads the WebGL Earth through the invisible slider', async ({
    page,
    isMobile,
    browserName,
  }) => {
    test.skip(isMobile || browserName !== 'chromium', 'the desktop scene, in Chromium');
    await open(page, `${V2}?tier=3`);
    const box = (await page.locator('.stage [data-globe]').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
    await expect(readout(page)).toBeVisible();
    await expect(readout(page)).toHaveText(/°[NS] .*°[EW] · /);
  });
});

test.describe('6 · commit row: node, rail, git show', () => {
  const head = (page: Page) => page.locator('#experience .commit').first();

  test('keyboard focus on its link lights the rail and turns the hash into git show', async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(browserName === 'webkit', noTab);
    test.skip(isMobile, 'the hash turns at 1024 px and up');
    await page.goto(V2);
    await tabTo(page, page.locator('#experience a[href="#contact"]'));
    await expect.poll(() => pseudo(head(page), '::before', 'scale')).toBe('1');
    expect(parseFloat(await pseudo(head(page), '::before', 'height'))).toBeGreaterThan(20);
    const hash = head(page).locator('.commit__hash');
    await expect.poll(() => pseudo(hash, '::after', 'opacity')).toBe('1');
    expect(await pseudo(hash, '::after', 'content')).toBe(
      `"${copy.experience.show_cmd.replace(/\{\s*hash\s*\}/, 'HEAD')}"`,
    );
  });

  test('under the pointer the node pulses (motion full)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse');
    await page.goto(V2);
    const row = page.locator('#experience .commit').nth(1);
    // The pulse lasts 2 × 300 ms: record it as it starts and ends, not by asking afterwards (CI's
    // WebKit beside the software-WebGL tests can answer a poll after it is over).
    const node = row.locator('.commit__node');
    await node.evaluate((el) => {
      const log: string[] = [];
      (el as unknown as { __pulse: string[] }).__pulse = log;
      el.addEventListener('animationstart', (e) =>
        log.push(`start ${(e as AnimationEvent).animationName}`),
      );
      el.addEventListener('animationend', (e) =>
        log.push(`end ${(e as AnimationEvent).animationName}`),
      );
    });
    await row.hover();
    await expect.poll(() => pseudo(row, '::before', 'scale')).toBe('1');
    await expect
      .poll(() => node.evaluate((el) => (el as unknown as { __pulse: string[] }).__pulse))
      .toEqual(['start node-pulse', 'end node-pulse']);
  });

  test('a tap lights a row until a tap elsewhere', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch');
    await page.goto(V2);
    const row = page.locator('#experience .commit').nth(1);
    // X4: on a phone the hash line (hash and dates) is the row's <summary> key; tap its title.
    await row.locator('.commit__title').scrollIntoViewIfNeeded();
    await row.locator('.commit__title').tap();
    await expect(row).toHaveAttribute('data-active', '');
    await expect.poll(() => pseudo(row, '::before', 'scale')).toBe('1');
    await page.locator('#experience .sh__h').tap();
    await expect(row).not.toHaveAttribute('data-active');
  });

  test('calm: the rail lights, the node does not pulse', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse');
    await seed(page, { motion: 'calm' });
    await page.goto(V2);
    const row = page.locator('#experience .commit').nth(1);
    await row.hover();
    await expect.poll(() => pseudo(row, '::before', 'scale')).toBe('1');
    expect(await row.locator('.commit__node').evaluate((el) => el.getAnimations().length)).toBe(0);
  });
});

test.describe('7 · ticker: the item under the pointer brightens', () => {
  test('hover pauses the band and brightens the item; focus pauses it (its keyboard twin)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'mouse');
    await page.goto(V2);
    const item = page.locator('.ticker__item').first();
    const before = await style(item, 'color');
    await item.hover();
    await expect.poll(() => style(item, 'color')).toBe(await token(page, '--color-text-hi'));
    expect(before).not.toBe(await style(item, 'color'));
    expect(
      await page
        .locator('.ticker__track')
        .first()
        .evaluate((el) => getComputedStyle(el).animationPlayState),
    ).toBe('paused');
  });
});

test.describe('8 · nav link: the sliding underline and the block cursor', () => {
  const bar = (page: Page) => page.locator('.nav__underline');
  const under = async (page: Page, link: Locator) => {
    const b = (await bar(page).boundingBox())!;
    const l = (await link.boundingBox())!;
    return Math.abs(b.x - l.x) <= 1 && Math.abs(b.width - l.width) <= 1 && b.y >= l.y + l.height;
  };

  test('Tab moves it to the focused link', async ({ page, browserName, isMobile }) => {
    test.skip(browserName === 'webkit', noTab);
    test.skip(isMobile, 'the desktop nav');
    await page.goto(V2);
    const links = page.locator('.nav__links a');
    await tabTo(page, links.nth(1));
    await expect(bar(page)).toHaveAttribute('data-on', 'true');
    await expect.poll(() => under(page, links.nth(1))).toBe(true);
    await page.keyboard.press('Tab');
    await expect.poll(() => under(page, links.nth(2))).toBe(true);
  });

  test('the pointer moves it from link to link; the current section ends in a block cursor', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'mouse');
    await page.goto(V2);
    const links = page.locator('.nav__links a');
    await links.nth(0).hover();
    await expect.poll(() => under(page, links.nth(0))).toBe(true);
    await links.nth(3).hover();
    await expect.poll(() => under(page, links.nth(3))).toBe(true);
    await page.mouse.move(5, 400);
    await expect(bar(page)).toHaveAttribute('data-on', 'false');
    await page.evaluate(() => document.getElementById('projects')!.scrollIntoView());
    const current = page.locator('.nav__links a[aria-current="true"]');
    await expect(current).toHaveCount(1);
    expect(await pseudo(current, '::after', 'width')).toBe('6px');
  });
});

test.describe('9 · MC button', () => {
  test('focus shows the hover colours; a press pushes it down 2 px', async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(browserName === 'webkit', noTab);
    test.skip(isMobile, 'keyboard and mouse');
    await page.goto(V2);
    const btn = page.locator('.hero .mc-btn').first();
    await tabTo(page, btn);
    await expect
      .poll(() => style(btn, 'background-color'))
      .toBe(await token(page, '--mc-grass-hover-bg'));
    const box = (await btn.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    expect(await style(btn, 'transform')).toBe('matrix(1, 0, 0, 1, 0, 2)');
    await page.mouse.up();
  });

  test('no sticky hover after a tap', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch');
    await page.goto(V2);
    // X4: a phone's first screen has RÉSUMÉ and SAY HI (a mailto link: its jump is held back
    // here, only the colour after the tap matters); larger screens SEE PROJECTS, an in-page jump.
    await page.evaluate(() =>
      document.addEventListener('click', (e) => e.preventDefault(), { capture: true }),
    );
    const btn = page.locator('.hero .mc-btn--grass:visible').first();
    await btn.tap();
    await page.waitForTimeout(200);
    expect(await style(btn, 'background-color')).toBe(await token(page, '--mc-grass-bg'));
  });
});

test.describe('10 · player card: photo, XP bar, copy key', () => {
  test('at rest the XP bar shows the real GPA ratio', async ({ page }) => {
    await page.goto(V2);
    const ratio = gpaRatio(education[0]?.gpa) ?? 1;
    expect(
      parseFloat(
        await page.locator('.stage__xp').evaluate((el) => el.style.getPropertyValue('--xp')),
      ),
    ).toBeCloseTo(ratio, 3);
  });

  test('the keyboard: focus shows the photo and fills the bar; the next stop copies the handle', async ({
    page,
    browserName,
    context,
  }) => {
    test.skip(browserName !== 'chromium', 'Tab and the clipboard: Chromium');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(V2);
    const card = page.locator('.stage__card');
    await tabTo(page, card);
    await expect(page.locator('.stage__photo')).toHaveCSS('opacity', '1');
    expect(
      await page.evaluate(() =>
        document
          .getAnimations()
          .map((a) => (a as CSSAnimation).animationName)
          .includes('xp-fill'),
      ),
    ).toBe(true);
    const key = page.locator('.stage__copy');
    if (!(await key.isVisible())) return; // the tag is hidden on narrow stages
    await page.keyboard.press('Tab');
    await expect(key).toBeFocused();
    await expect(key).toHaveCSS('opacity', '1');
    await expect(key).toHaveAccessibleName(
      copy.hero.copy_label.replace(/\{\s*handle\s*\}/, String(await key.getAttribute('data-copy'))),
    );
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-copy-status]')).toHaveText(copy.hero.copied);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await key.getAttribute('data-copy'),
    );
  });

  test('a tap shows what a hover shows, until a tap elsewhere', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch');
    await page.goto(V2);
    await introDone(page);
    const card = page.locator('.stage__card');
    await card.scrollIntoViewIfNeeded();
    await card.tap();
    await expect(card).toHaveAttribute('data-active', '');
    await expect(page.locator('.stage__photo')).toHaveCSS('opacity', '1');
    await page.locator('.hero__eyebrow:visible').tap();
    await expect(card).not.toHaveAttribute('data-active');
  });
});

test.describe('11 · Clock Stamp phone: pick a city', () => {
  const { cities, home_zone: home } = copy.projects.phone;
  const keys = (page: Page) => page.getByRole('group', { name: copy.projects.phone.pick_label });

  test('Tab through the cities: each becomes the selected one; the others dim', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', noTab);
    await page.goto(V2);
    const away = cities.filter((c) => c.time_zone !== home);
    const last = away[away.length - 1]!;
    const key = keys(page).getByRole('button', { name: new RegExp(last.name) });
    await tabTo(page, key);
    await expect(key).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.phone__city')).toHaveText(last.name);
    await expect(page.locator('.phone [data-clock="hour"]')).toHaveAttribute(
      'data-tz',
      last.time_zone,
    );
    const dimmed = await page
      .locator('.phone .hand')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity));
    expect(dimmed.filter((o) => o === '0.4')).toHaveLength(dimmed.length - 1);
    for (const other of cities.filter((c) => c !== last))
      await expect(
        keys(page).getByRole('button', { name: new RegExp(other.name) }),
      ).toHaveAttribute('aria-pressed', 'false');
  });

  test('the pointer on a hand, or a tap, selects its city', async ({ page, isMobile }) => {
    await page.goto(V2);
    const here = cities.find((c) => c.time_zone === home)!;
    const key = keys(page).getByRole('button', { name: new RegExp(here.name) });
    await key.scrollIntoViewIfNeeded();
    if (isMobile) await key.tap();
    else await key.hover();
    await expect(page.locator('.phone__city')).toHaveText(here.name);
    await expect(page.locator('.phone [data-clock="offset"]')).toHaveText('+0h');
  });

  test('every city key is a 24 px target whatever the time (the hands turn; two tags can meet)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(V2);
    const sizes = await keys(page)
      .getByRole('button')
      .evaluateAll((els) =>
        els.map((e) => [(e as HTMLElement).offsetWidth, (e as HTMLElement).offsetHeight]),
      );
    expect(sizes.length).toBe(cities.length);
    for (const [w, h] of sizes) {
      expect(w).toBeGreaterThanOrEqual(24);
      expect(h).toBeGreaterThanOrEqual(24);
    }
  });

  test('a choice while paused shows that city at the held moment', async ({ page, isMobile }) => {
    const start = new Date('2027-03-01T07:59:30Z');
    await page.clock.install({ time: start });
    await page.goto(V2);
    await page.locator('body').press('p');
    await page.clock.fastForward(5 * 60_000);
    const sha = cities.find((c) => c.code === 'SHA') ?? cities[cities.length - 1]!;
    const key = keys(page).getByRole('button', { name: new RegExp(sha.name) });
    await key.scrollIntoViewIfNeeded();
    if (isMobile) await key.tap();
    else await key.click();
    const minute = new Intl.DateTimeFormat('en-US', { timeZone: sha.time_zone, minute: '2-digit' })
      .format(start)
      .padStart(2, '0');
    await expect(page.locator('.phone [data-clock="minute"]')).toHaveText(minute);
  });
});

test.describe('12 · terminal prompt (an easter egg with a real form control)', () => {
  test('the keyboard: open it, run commands, close it; nothing on the page moves', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', noTab);
    await page.goto(V2);
    // X4: on a phone the prompt is in the folded part of the terminal: unfold it first.
    if (await page.locator('[data-fold]').isVisible()) await page.locator('[data-fold]').click();
    const key = page.getByRole('button', { name: copy.hero.prompt.open, exact: true });
    // Where the buttons under the terminal are on the page (not in the window, which scrolls;
    // X4: a phone has its own pair, so the pair on screen).
    const ctas = page.locator('.hero__ctas:visible');
    const onPage = () =>
      ctas.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
      });
    const before = await onPage();
    await tabTo(page, key);
    await page.keyboard.press('Enter');
    const field = page.getByRole('textbox', { name: copy.hero.prompt.label, exact: true });
    await expect(field).toBeFocused();
    await page.keyboard.type('whoami');
    await page.keyboard.press('Enter');
    const log = page.getByRole('log');
    await expect(log).toContainText(await page.locator('.hero__ln--out').first().innerText());
    await page.keyboard.type('nonsense');
    await page.keyboard.press('Enter');
    await expect(log).toContainText(
      copy.hero.prompt.not_found.replace(/\{\s*cmd\s*\}/, 'nonsense'),
    );
    await page.keyboard.type('theme mono');
    await page.keyboard.press('Enter');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe('mono-dark');
    // Typing in it never fires the single-key shortcuts.
    await page.keyboard.type('p,');
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-paused'))).toBe(
      false,
    );
    expect(await onPage()).toEqual(before);
    await page.keyboard.press('Escape');
    await expect(key).toBeFocused();
    await expect(field).toHaveCount(0);
  });

  test('opening it moves nothing, also when the terminal is a fraction of a pixel tall', async ({
    page,
    isMobile,
  }) => {
    await page.goto(V2);
    if (await page.locator('[data-fold]').isVisible()) await page.locator('[data-fold]').tap();
    // Whatever the fonts and the wording make of its lines, the terminal here ends on half a
    // pixel: the case in which a rounded height pushed the page down (CI, PR #7).
    const body = page.locator('.term__body').first();
    const whole = await body.evaluate((el) => el.getBoundingClientRect().height);
    await body.evaluate((el, h) => {
      el.style.boxSizing = 'border-box';
      el.style.minHeight = `${Math.floor(h) + 1.5}px`;
    }, whole);
    expect((await body.evaluate((el) => el.getBoundingClientRect().height)) % 1).toBe(0.5);
    const ctas = page.locator('.hero__ctas:visible');
    const onPage = () =>
      ctas.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
      });
    const before = await onPage();
    const key = page.getByRole('button', { name: copy.hero.prompt.open, exact: true });
    if (isMobile) await key.tap();
    else await key.click();
    await expect(page.getByRole('textbox', { name: copy.hero.prompt.label })).toBeFocused();
    expect(await onPage()).toEqual(before);
  });

  test('a tap opens it; axe is clean with it open', async ({ page, isMobile }) => {
    await page.goto(V2);
    // X4: on a phone the prompt is in the folded part of the terminal: unfold it first.
    if (await page.locator('[data-fold]').isVisible()) await page.locator('[data-fold]').tap();
    const key = page.getByRole('button', { name: copy.hero.prompt.open, exact: true });
    if (isMobile) await key.tap();
    else await key.click();
    await expect(page.getByRole('textbox', { name: copy.hero.prompt.label })).toBeFocused();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(
      results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => v.id),
    ).toEqual([]);
  });
});

test.describe('13 · external link: the arrow hops, the status line names the host', () => {
  test('keyboard focus and the pointer', async ({ page, browserName, isMobile }) => {
    test.skip(browserName === 'webkit', noTab);
    await page.goto(V2);
    // X4: the hero's links are in Contact's row of keys on a phone.
    const link = page
      .locator(isMobile ? '.contact__key[target="_blank"]' : '.hero__links a[target="_blank"]')
      .first();
    const host = new URL(String(await link.getAttribute('href'))).host.replace(/^www\./, '');
    await tabTo(page, link);
    const line = page.locator('.linkline');
    await expect(line).toHaveAttribute('data-on', 'true');
    await expect(line).toHaveText(`↗ ${host}`);
    await expect(line).toHaveAttribute('aria-hidden', 'true');
    expect(await style(link.locator(isMobile ? '.contact__key-ext' : '.ext-arrow'), 'left')).toBe(
      '1px',
    );
    await page.keyboard.press('Shift+Tab');
    await expect(line).toHaveAttribute('data-on', 'false');
    if (isMobile) return;
    await link.hover();
    await expect(line).toHaveAttribute('data-on', 'true');
    // An in-page link says nothing.
    await page.locator('.nav__links a').first().hover();
    await expect(line).toHaveAttribute('data-on', 'false');
  });
});

test.describe('14 · section header: the command types once, then the heading resolves', () => {
  const projects = (page: Page) => page.locator('#projects');

  /** The section's entrances as they happen (each lasts about half a second). */
  const watch = (page: Page) => watchAttribute(projects(page), 'data-enter', '.sh__cmd');

  test('motion full: as it first comes into view; then it is at rest', async ({ page }) => {
    await page.goto(V2);
    const entrances = await watch(page);
    await page.evaluate(() =>
      document.getElementById('projects')!.scrollIntoView({ block: 'start' }),
    );
    await expect
      .poll(async () => (await entrances()).map((c) => c.value))
      .toEqual([expect.stringMatching(/header/), null]);
    const [start, end] = await entrances();
    expect(start!.animations).toContain('enter-type');
    // It ran its course: the typing, then the heading resolving.
    expect(end!.at - start!.at).toBeGreaterThanOrEqual(HOVER.header.minMs);
    await expect(projects(page)).not.toHaveAttribute('data-enter');
    // Once per visit: back up and down again, nothing replays (not even for a moment).
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.getElementById('projects')!.scrollIntoView());
    await page.waitForTimeout(200);
    expect(await entrances()).toHaveLength(2);
    await expect(projects(page)).not.toHaveAttribute('data-enter');
  });

  for (const how of ['calm', 'off', 'paused', 'in view at load'] as const)
    test(`${how}: the section is simply there`, async ({ page }) => {
      if (how === 'calm' || how === 'off') await seed(page, { motion: how });
      await page.goto(how === 'in view at load' ? `${V2}#projects` : V2);
      if (how === 'paused') await page.locator('body').press('p');
      await page.evaluate(() => document.getElementById('projects')!.scrollIntoView());
      await page.waitForTimeout(250);
      await expect(projects(page)).not.toHaveAttribute('data-enter');
      expect(
        await projects(page)
          .locator('.sh__h')
          .evaluate((el) => el.getAnimations().length),
      ).toBe(0);
    });

  test('pausing during it ends it at once', async ({ page }) => {
    await page.goto(V2);
    const entrances = await watch(page);
    // The page's own pause key is pressed the moment the entrance starts: a key press sent from
    // here could arrive after it has ended by itself in a slow browser.
    await projects(page).evaluate((el) =>
      new MutationObserver((_, mo) => {
        if (!el.hasAttribute('data-enter')) return;
        mo.disconnect();
        document.querySelector<HTMLElement>('[data-pause]')!.click();
      }).observe(el, { attributes: true, attributeFilter: ['data-enter'] }),
    );
    await page.evaluate(() => document.getElementById('projects')!.scrollIntoView());
    await expect
      .poll(async () => (await entrances()).map((c) => c.value))
      .toEqual([expect.stringMatching(/header/), null]);
    await expect(page.locator('html')).toHaveAttribute('data-paused', '');
    const [start, end] = await entrances();
    // At once: long before it would have ended by itself.
    expect(end!.at - start!.at).toBeLessThan(HOVER.header.minMs / 2);
  });
});

test.describe('15 · cursor: a crosshair over blocks, the system’s over text and controls', () => {
  test('desktop', async ({ page, isMobile, browserName }) => {
    test.skip(isMobile, 'desktop only');
    await page.goto(V2);
    const cursor = (sel: string) => style(page.locator(sel).first(), 'cursor');
    expect(await cursor('.stage__block img.voxel')).toMatch(/url\(.*crosshair/);
    expect(await cursor('.stage')).toMatch(/url\(/);
    expect(await cursor('.hero__eyebrow')).toBe('auto');
    expect(await cursor('.stage__card')).toBe('auto');
    // A link keeps the browser's own: Chromium says pointer, WebKit auto (it picks the hand).
    const link = browserName === 'webkit' ? 'auto' : 'pointer';
    expect(await cursor('.hero__links a')).toBe(link);
    expect(await cursor('.nav__logo img.voxel')).toBe(link);
    expect(await cursor('.stage [data-globe]')).toBe('grab');
  });
});

test.describe('16 · back to spawn: a block falls as the page scrolls up', () => {
  /** "Back to spawn": the footer's link, or on a phone (X4) the top bar's logo. */
  const spawnLink = (page: Page) =>
    page.locator(
      page.viewportSize()!.width < 768 ? 'a.nav__logo[data-spawn-block]' : 'a.foot__top',
    );
  /**
   * How far the page is from where the link goes: #top, the hero, under the nav (on a phone, X4,
   * just under the top bar, which stays at the top of the screen).
   */
  const fromTop = (page: Page) =>
    page.evaluate(() => {
      const nav = document.querySelector('.nav')!;
      const under =
        getComputedStyle(nav).position === 'sticky' ? nav.getBoundingClientRect().bottom : 0;
      return Math.abs(document.getElementById('top')!.getBoundingClientRect().top - under);
    });
  test('the keyboard: Enter on it drops a block and goes to the top', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', noTab);
    await page.goto(V2);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const link = spawnLink(page);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.spawn-block')).toHaveCount(1);
    await expect.poll(() => fromTop(page), { timeout: 5000 }).toBeLessThanOrEqual(1);
    await expect(page.locator('.spawn-block')).toHaveCount(0, { timeout: 3000 });
  });

  test('a tap does the same', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch');
    await page.goto(V2);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const link = spawnLink(page);
    await link.scrollIntoViewIfNeeded();
    await link.tap();
    await expect(page.locator('.spawn-block')).toHaveCount(1);
    await expect.poll(() => fromTop(page), { timeout: 5000 }).toBeLessThanOrEqual(1);
  });

  for (const how of ['calm', 'off'] as const)
    test(`${how}: instant, and nothing falls`, async ({ page }) => {
      await seed(page, { motion: how });
      await page.goto(V2);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await spawnLink(page).click();
      await expect(page.locator('.spawn-block')).toHaveCount(0);
      expect(await fromTop(page)).toBeLessThanOrEqual(1);
    });
});

test.describe('particles (acceptance E: at most 60 alive)', () => {
  test('a storm of bursts never has more than 60 flying', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse');
    await page.goto(V2);
    await introDone(page);
    const targets = page.locator('.hero .mc-btn, .stage__block img.voxel, .stage__card');
    const boxes = [];
    for (const t of await targets.all()) {
      const b = await t.boundingBox();
      if (b && b.y > 0 && b.y < 880) boxes.push(b);
    }
    for (let round = 0; round < 3; round++)
      for (const b of boxes) {
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.mouse.move(2, 880);
      }
    const s = await particles(page);
    expect(s.bursts).toBeGreaterThan(5);
    expect(s.peak).toBeLessThanOrEqual(60);
  });
});
