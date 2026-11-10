// Floating windows over the home page (M3; PLAN §8 M3 acceptance): `more ▸` grows Projects into
// its directory, a project opens in a window of its own with a real address, Back / Forward walk
// them, Esc / the close key / a click on the bar close them, focus goes in and comes back, the bar
// drags a window and its move key is the keyboard twin (WCAG 2.5.7), axe is clean with a window
// open in every locale. The pages themselves: tests/e2e/pages.spec.ts.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { pagePath } from '../../src/i18n/routing';
import { WINDOW } from '../../src/motion/params';
import { contentFor } from './locale';
import { LOCALE_PAGES, V2 } from './site';

/** Projects in the page's order (src/lib/content.ts getProjects): featured, newest, by title. */
const ordered = <P extends { fm: Record<string, unknown> }>(list: P[]) =>
  [...list].sort(
    (a, b) =>
      Number(!!b.fm.featured) - Number(!!a.fm.featured) ||
      Number(b.fm.year) - Number(a.fm.year) ||
      String(a.fm.title).localeCompare(String(b.fm.title)),
  );
const en = contentFor('en');
const w = en.copy.windows;
const [first, second] = ordered(en.projects) as [
  (typeof en.projects)[number],
  (typeof en.projects)[number],
];
const projectUrl = (id: string, locale: 'en' | 'zh-hans' | 'zh-hant' = 'en') =>
  pagePath(locale, { kind: 'project', id }, V2);
const directoryUrl = pagePath('en', { kind: 'projects' }, V2);

const directory = (page: Page) => page.getByRole('dialog', { name: w.directory_heading });
const projectWindow = (page: Page, title: string) => page.getByRole('dialog', { name: title });
const box = (l: Locator) => l.boundingBox().then((b) => b!);
/** The window's own scripted animations (growing, shrinking): not the CSS loops inside it. */
const grows = (el: Element) =>
  el
    .getAnimations({ subtree: true })
    .filter((a) => !(a instanceof CSSAnimation) && !(a instanceof CSSTransition)).length;
/** Wait until a window has finished growing (at full motion). */
const settled = (l: Locator) => expect.poll(() => l.evaluate(grows)).toBe(0);

async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

/** Open the directory from Projects' `more ▸` (by keyboard, so focus is where a visitor's is). */
async function openDirectory(page: Page) {
  const more = page.locator('#projects .sh__more');
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(directory(page)).toBeVisible();
  await settled(directory(page));
  return more;
}

test.describe('the directory: `more ▸` grows Projects into it', () => {
  test('opens with a real address; focus goes in; Esc closes it and focus comes back', async ({
    page,
  }) => {
    await page.goto(V2);
    const more = await openDirectory(page);
    await expect(page).toHaveURL(directoryUrl);
    // Focus in: the first project of the directory.
    await expect(
      directory(page).getByRole('link', { name: String(first.fm.title), exact: true }),
    ).toBeFocused();
    // Every project is listed, each a link to its page.
    for (const p of en.projects)
      await expect(
        directory(page).getByRole('link', { name: String(p.fm.title), exact: true }),
      ).toHaveAttribute('href', projectUrl(p.id));
    await page.keyboard.press('Escape');
    await expect(directory(page)).toBeHidden();
    await expect(page).toHaveURL(V2);
    await expect(more).toBeFocused();
  });

  test('the close key and a click on the bar close it too; Back closes it, Forward reopens it', async ({
    page,
  }) => {
    await page.goto(V2);
    await openDirectory(page);
    await directory(page).getByRole('button', { name: w.close, exact: true }).click();
    await expect(directory(page)).toBeHidden();
    await expect(page).toHaveURL(V2);

    await openDirectory(page);
    const bar = directory(page).locator('[data-win-bar]');
    const b = await box(bar);
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(directory(page)).toBeHidden();
    await expect(page).toHaveURL(V2);

    await openDirectory(page);
    await page.goBack();
    await expect(directory(page)).toBeHidden();
    await expect(page).toHaveURL(V2);
    await page.goForward();
    await expect(directory(page)).toBeVisible();
    await expect(page).toHaveURL(directoryUrl);
  });

  test('the page behind is inert while it is open (a modal window): Tab never reaches it', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'Safari does not Tab to every element by default');
    await page.goto(V2);
    await openDirectory(page);
    // Tab walks the window's keys and links, then may leave for the browser's own controls
    // (nothing on the page is focused then); it never lands on the page behind.
    let inside = 0;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return 'none';
        return el.closest('dialog[open]') ? 'window' : 'page';
      });
      expect(where, `Tab ${i + 1}`).not.toBe('page');
      if (where === 'window') inside++;
    }
    expect(inside).toBeGreaterThanOrEqual(5); // move, close, and the projects
    await page.keyboard.press('Escape');
    await expect(directory(page)).toBeHidden();
  });
});

test.describe("a project's window: the same content as its page, over the home page", () => {
  test('from its title: its address, its heading takes focus, its page’s content', async ({
    page,
  }) => {
    // Both pages show Clock Stamp's live clock: one fixed time for the whole context, so a minute
    // turning over between the two reads cannot make them differ (it did once: 09:28 / 09:29).
    await page.context().clock.setFixedTime(new Date('2026-10-24T16:45:00Z'));
    await page.goto(V2);
    const link = page.locator(`#project-${first.id} a[data-project-link]`);
    await link.focus();
    await page.keyboard.press('Enter');
    const win = projectWindow(page, String(first.fm.title));
    await expect(win).toBeVisible();
    await settled(win);
    await expect(page).toHaveURL(projectUrl(first.id));
    const heading = win.getByRole('heading', { level: 2, name: String(first.fm.title) });
    await expect(heading).toBeFocused();
    await expect(page).toHaveTitle(new RegExp(`^${String(first.fm.title)}`));
    // The window shows what the page shows (one source).
    const shown = (await win.locator(`[data-project="${first.id}"]`).innerText()).trim();
    const other = await page.context().newPage();
    await other.goto(projectUrl(first.id));
    expect(shown).toBe((await other.locator(`[data-project="${first.id}"]`).innerText()).trim());
    await other.close();
    // The home page keeps its one h1.
    await expect(page.locator('h1')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(win).toBeHidden();
    await expect(page).toHaveURL(V2);
    await expect(link).toBeFocused();
  });

  test('from the directory, then its neighbour: Back walks back through them', async ({ page }) => {
    await page.goto(V2);
    await openDirectory(page);
    await directory(page)
      .getByRole('link', { name: String(first.fm.title), exact: true })
      .click();
    const one = projectWindow(page, String(first.fm.title));
    await expect(one).toBeVisible();
    await expect(page).toHaveURL(projectUrl(first.id));
    await one.getByRole('link', { name: new RegExp(String(second.fm.title)) }).click();
    const two = projectWindow(page, String(second.fm.title));
    await expect(two).toBeVisible();
    await expect(page).toHaveURL(projectUrl(second.id));

    await page.goBack();
    await expect(projectWindow(page, String(first.fm.title))).toBeVisible();
    await expect(page).toHaveURL(projectUrl(first.id));
    await page.goBack();
    await expect(page.locator('dialog[data-window-kind="project"]')).toBeHidden();
    await expect(directory(page)).toBeVisible();
    await expect(
      directory(page).getByRole('link', { name: String(first.fm.title), exact: true }),
    ).toBeFocused();
    await page.goBack();
    await expect(directory(page)).toBeHidden();
    await expect(page).toHaveURL(V2);
    await page.goForward();
    await page.goForward();
    await expect(projectWindow(page, String(first.fm.title))).toBeVisible();
    await expect(directory(page)).toBeVisible();
  });

  test('a reload at its address shows the page itself (the deep link)', async ({ page }) => {
    await page.goto(V2);
    await page.locator(`#project-${first.id} a[data-project-link]`).click();
    await expect(page).toHaveURL(projectUrl(first.id));
    await page.reload();
    await expect(page.locator('h1')).toHaveText(String(first.fm.title));
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('a click with a modifier (a new tab) is left to the browser', async ({ page }) => {
    await page.goto(V2);
    await page
      .locator(`#project-${first.id} a[data-project-link]`)
      .click({ modifiers: ['ControlOrMeta'] });
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(V2);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });
});

test.describe('moving a window', () => {
  test.skip(({ isMobile }) => isMobile, 'dragging is for a fine pointer (desktop)');

  test('the bar drags it, kept whole on the desk; let go near its place, it docks again', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(V2);
    await openDirectory(page);
    const win = directory(page);
    const bar = win.locator('[data-win-bar]');
    const docked = await box(win);
    const b = await box(bar);
    const grab = { x: b.x + 200, y: b.y + b.height / 2 };
    // Left by 40 and down by 120: it ends within the snap distance of the desk's left edge.
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(grab.x - 40, grab.y + 120, { steps: 6 });
    await expect(win).toHaveAttribute('data-dragging', '');
    await page.mouse.up();
    const moved = await box(win);
    // Flush against the left edge (the margin), 120 px lower.
    expect(moved.x).toBeCloseTo(WINDOW.marginPx, 0);
    expect(moved.y).toBeCloseTo(docked.y + 120, 0);
    await expect(win).not.toHaveAttribute('data-dragging', '');
    // Far off the desk: it stays whole on it.
    const b2 = await box(bar);
    await page.mouse.move(b2.x + 300, b2.y + 10);
    await page.mouse.down();
    await page.mouse.move(b2.x + 300 + 4000, b2.y + 10 + 4000, { steps: 4 });
    await page.mouse.up();
    const far = await box(win);
    expect(far.x + far.width).toBeLessThanOrEqual(1440 - WINDOW.marginPx + 1);
    expect(far.y + far.height).toBeLessThanOrEqual(900 - WINDOW.marginPx + 1);
    // Back near its dock: it docks.
    const b3 = await box(bar);
    await page.mouse.move(b3.x + 300, b3.y + 10);
    await page.mouse.down();
    await page.mouse.move(
      b3.x + 300 + (docked.x - far.x) + 10,
      b3.y + 10 + (docked.y - far.y) - 10,
      { steps: 6 },
    );
    await page.mouse.up();
    const home = await box(win);
    expect(home.x).toBeCloseTo(docked.x, 0);
    expect(home.y).toBeCloseTo(docked.y, 0);
    // Dragging never closed it, and focus is still inside.
    await expect(win).toBeVisible();
    await expect(page).toHaveURL(directoryUrl);
  });

  test('its move key: arrows move it, Shift further, Home puts it back; Tab goes on, Esc closes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(V2);
    await openDirectory(page);
    const win = directory(page);
    const key = win.getByRole('button', { name: w.move_label });
    await expect(key).toHaveAccessibleDescription(w.move_hint);
    const docked = await box(win);
    await key.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    const moved = await box(win);
    expect(moved.x - docked.x).toBeCloseTo(2 * WINDOW.keyStepPx, 0);
    expect(moved.y - docked.y).toBeCloseTo(WINDOW.keyFarPx, 0);
    await page.keyboard.press('Home');
    const home = await box(win);
    expect(home.x).toBeCloseTo(docked.x, 0);
    expect(home.y).toBeCloseTo(docked.y, 0);
    // Not a trap: Tab moves on to the close key; Esc closes the window.
    await page.keyboard.press('Tab');
    await expect(win.getByRole('button', { name: w.close, exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(win).toBeHidden();
  });
});

test.describe('motion: the window grows out of its key at full motion only', () => {
  test.skip(({ isMobile }) => isMobile, 'one device is enough');
  test('full: the frame grows; reduced motion: it is simply there', async ({ browser }) => {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      const context = await browser.newContext({ reducedMotion });
      const page = await context.newPage();
      await page.goto(V2);
      // Count the window's animations at the moment it opens (they last a fraction of a second).
      await page.evaluate(() => {
        const d = document.querySelector('dialog[data-window-kind="directory"]')!;
        new MutationObserver(() => {
          if ((d as HTMLDialogElement).open)
            (window as unknown as { grew?: number }).grew = d
              .getAnimations({ subtree: true })
              .filter((a) => !(a instanceof CSSAnimation) && !(a instanceof CSSTransition)).length;
        }).observe(d, { attributes: true, attributeFilter: ['open'] });
      });
      await page.locator('#projects .sh__more').click();
      await expect(directory(page)).toBeVisible();
      const grew = await page.evaluate(() => (window as unknown as { grew?: number }).grew);
      if (reducedMotion === 'reduce') expect(grew).toBe(0);
      else expect(grew).toBeGreaterThan(0);
      await context.close();
    }
  });
});

for (const { locale, path } of LOCALE_PAGES)
  test.describe(`axe with a window open (${locale})`, () => {
    const { copy, projects } = contentFor(locale);
    test('the directory, then a project over it; keys are 24 px targets', async ({ page }) => {
      await page.goto(path);
      await page.locator('#projects .sh__more').click();
      const dir = page.getByRole('dialog', { name: copy.windows.directory_heading });
      await expect(dir).toBeVisible();
      await settled(dir);
      expect(await blockingViolations(page)).toEqual([]);
      for (const k of await dir.locator('.win__key').all()) {
        const b = await box(k);
        expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(24);
      }
      const p = ordered(projects)[0]!;
      await dir.getByRole('link', { name: String(p.fm.title), exact: true }).click();
      const win = page.getByRole('dialog', { name: String(p.fm.title) });
      await expect(win).toBeVisible();
      await settled(win);
      await expect(page).toHaveURL(projectUrl(p.id, locale));
      await expect(win.locator('[data-project]')).toBeVisible();
      expect(await blockingViolations(page)).toEqual([]);
    });
  });
