// Preferences and the settings window (PLAN-EXPERIENCE §2): entry points, the form, storage,
// first paint, reset and the single-key shortcuts (WCAG 2.1.4).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { copy } from './copy';
import { V2 } from './site';

const KEY = 'zhic:prefs:v1';
const p = copy.prefs;

const dialog = (page: Page) => page.getByRole('dialog', { name: p.heading });
const group = (page: Page, legend: string) =>
  dialog(page).getByRole('group', { name: legend, exact: true });
/** A choice by its accessible name: the option's name and its note, as the label reads. */
const choice = (page: Page, legend: string, name: string, note?: string) =>
  group(page, legend).getByRole('radio', { name: note ? `${name} ${note}` : name, exact: true });
const themeChoice = (page: Page, t: keyof typeof p.theme.options) =>
  choice(page, p.theme.legend, p.theme.options[t].name, p.theme.options[t].note);
const stored = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
const htmlAttr = (page: Page, name: string) =>
  page.evaluate((n) => document.documentElement.getAttribute(n), name);

test.describe('settings window', () => {
  test.use({ reducedMotion: 'reduce' });

  test('opens from the nav key, the footer and the "," key; Escape closes it, focus returns', async ({
    page,
  }) => {
    await page.goto(V2);
    const gear = page.getByRole('button', { name: p.open_label, exact: true });
    await gear.click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(gear).toBeFocused();

    const foot = page.locator('footer').getByRole('button', { name: copy.footer.prefs });
    await foot.click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole('button', { name: p.close }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(foot).toBeFocused();

    await page.locator('body').press(',');
    await expect(dialog(page)).toBeVisible();
  });

  test('a labelled form, operable by keyboard alone; each choice applies at once', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'Safari does not Tab to every element by default');
    await page.goto(V2);
    await page.getByRole('button', { name: p.open_label, exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    // Focus starts on the chosen theme; arrow keys move the choice, which applies at once.
    await expect(themeChoice(page, 'night')).toBeFocused();
    await expect(themeChoice(page, 'night')).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(themeChoice(page, 'day')).toBeChecked();
    expect(await htmlAttr(page, 'data-theme')).toBe('day');
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).not.toBe(
      '#0b0f1a',
    );
    // Tab moves group to group: motion, the language links (X2: one per language offered, in
    // the plan's order theme · motion · language · text), text size.
    await page.keyboard.press('Tab');
    await expect(
      choice(page, p.motion.legend, p.motion.options.auto.name, p.motion.options.auto.note),
    ).toBeFocused();
    const languages = dialog(page).getByRole('navigation', { name: p.lang.legend });
    for (const link of await languages.getByRole('link').all()) {
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
    }
    await page.keyboard.press('Tab');
    const size = (n: number) =>
      choice(page, p.text.legend, p.text.option.replace('{size}', `${n}`));
    await expect(size(100)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(size(115)).toBeChecked();
    expect(
      await page.evaluate(() => document.documentElement.style.getPropertyValue('--text-scale')),
    ).toBe('1.15');
    expect(await stored(page)).toMatchObject({ theme: 'day', text: 115 });
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByRole('button', { name: p.open_label, exact: true })).toBeFocused();
  });

  test('axe: no serious or critical violations with the window open', async ({ page }) => {
    await page.goto(V2);
    await page.locator('body').press(',');
    await expect(dialog(page)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });

  test('one stored value; a choice survives a reload and is on <html> before the body exists', async ({
    page,
  }) => {
    await page.goto(V2);
    await page.locator('body').press(',');
    await themeChoice(page, 'mono-dark').check();
    await choice(
      page,
      p.motion.legend,
      p.motion.options.calm.name,
      p.motion.options.calm.note,
    ).check();
    await choice(page, p.text.legend, p.text.option.replace('{size}', '130')).check();
    expect(await stored(page)).toEqual({
      theme: 'mono-dark',
      motion: 'calm',
      text: 130,
      lang: 'auto',
      keys: true,
    });
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([KEY]);

    // What <html> carries when the parser first reaches <body>: set by the head script already.
    await page.addInitScript(() => {
      const w = window as unknown as { atBody?: object };
      new MutationObserver((_, obs) => {
        if (!document.body) return;
        const html = document.documentElement;
        w.atBody = {
          theme: html.dataset.theme,
          motion: html.dataset.motion,
          scale: html.style.getPropertyValue('--text-scale'),
        };
        obs.disconnect();
      }).observe(document, { childList: true, subtree: true });
    });
    await page.reload();
    // Reduced motion (this describe) outranks the stored "calm".
    expect(await page.evaluate(() => (window as unknown as { atBody: object }).atBody)).toEqual({
      theme: 'mono-dark',
      motion: 'off',
      scale: '1.3',
    });
  });

  test('reset goes back to the defaults and forgets the saved value', async ({ page }) => {
    await page.addInitScript(
      (k) => localStorage.getItem(k) ?? localStorage.setItem(k, '{"theme":"day","text":130}'),
      KEY,
    );
    await page.goto(V2);
    expect(await htmlAttr(page, 'data-theme')).toBe('day');
    await page.locator('body').press(',');
    await dialog(page).getByRole('button', { name: p.reset }).click();
    expect(await htmlAttr(page, 'data-theme')).toBe('night');
    expect(await page.evaluate(() => document.documentElement.style.cssText)).not.toContain(
      '--text-scale',
    );
    await expect(themeChoice(page, 'night')).toBeChecked();
    expect(await stored(page)).toBeNull();
  });

  test('shortcuts stay out of fields and can be turned off (WCAG 2.1.4)', async ({ page }) => {
    await page.goto(V2);
    // Typing in a field never opens the window or pauses the page.
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'probe';
      document.querySelector('main')!.prepend(input);
    });
    await page.locator('#probe').press(',');
    await page.locator('#probe').press('p');
    await expect(dialog(page)).toBeHidden();
    expect(await htmlAttr(page, 'data-paused')).toBeNull();
    await page.locator('#probe').evaluate((el) => el.remove());
    // With a modifier the key belongs to the browser.
    await page
      .locator('body')
      .press('Control+p')
      .catch(() => {});
    expect(await htmlAttr(page, 'data-paused')).toBeNull();

    await page.locator('body').press('p');
    expect(await htmlAttr(page, 'data-paused')).toBe('');
    await page.locator('body').press('p');
    expect(await htmlAttr(page, 'data-paused')).toBeNull();

    await page.locator('body').press(',');
    await choice(page, p.keys.legend, p.keys.off).check();
    expect(await stored(page)).toMatchObject({ keys: false });
    await page.keyboard.press('Escape');
    await page.locator('body').press(',');
    await page.locator('body').press('p');
    await expect(dialog(page)).toBeHidden();
    expect(await htmlAttr(page, 'data-paused')).toBeNull();
    // The keys in the nav still work.
    await page.getByRole('button', { name: p.open_label, exact: true }).click();
    await expect(dialog(page)).toBeVisible();
  });

  test('another tab’s change reaches this one', async ({ page, context }) => {
    await page.goto(V2);
    const other = await context.newPage();
    await other.goto(V2);
    await other.evaluate((k) => localStorage.setItem(k, '{"theme":"mono-light"}'), KEY);
    await expect.poll(() => htmlAttr(page, 'data-theme')).toBe('mono-light');
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the settings and pause keys are not shown (they could not work)', async ({ page }) => {
    await page.goto(V2);
    await expect(page.locator('[data-prefs-open], [data-pause]').first()).toBeHidden();
    for (const el of await page.locator('[data-prefs-open], [data-pause]').all())
      await expect(el).toBeHidden();
    expect(await htmlAttr(page, 'data-theme')).toBeNull();
  });
});
