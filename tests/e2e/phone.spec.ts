import { expect, test, type Page } from '@playwright/test';
import {
  SAMPLE_MOMENT,
  dateLabel,
  dialAngle,
  hourLabel,
  minuteLabel,
  offsetLabel,
  timeLabel,
  zonedParts,
} from '../../src/lib/world-clock';
import { copy } from './copy';
import { V2 } from './site';

const { home_zone: home, cities } = copy.projects.phone;
// As PhoneMockup.astro: the city in the home zone is "here"; the first of the others is selected.
const here = cities.find((c) => c.time_zone === home);
const away = cities.filter((c) => c !== here);
const selected = away[0] ?? cities[0]!;
const mark = (c: (typeof cities)[number]) => c.code ?? c.name;

/** What the phone must show at `moment`: the selected city's clock and every hand's angle. */
async function expectFace(page: Page, moment: Date) {
  const phone = page.locator('.phone');
  await expect(phone).toHaveCount(1);
  const city = zonedParts(moment, selected.time_zone);
  await expect(phone.locator('[data-clock="hour"]')).toHaveText(hourLabel(city));
  await expect(phone.locator('[data-clock="minute"]')).toHaveText(minuteLabel(city));
  await expect(phone.locator('[data-clock="date"]')).toHaveText(dateLabel(city));
  await expect(phone.locator('[data-clock="offset"]')).toHaveText(
    offsetLabel(moment, selected.time_zone, home),
  );
  await expect(phone.locator('[data-clock="time"]')).toHaveText(
    timeLabel(zonedParts(moment, home)),
  );
  const hands = phone.locator('[data-clock="hand"]');
  await expect(hands).toHaveCount(away.length + 1); // one per city away from home, and "here"
  const zones = [...away.map((c) => c.time_zone), home];
  for (const [i, zone] of zones.entries()) {
    const hand = hands.nth(i);
    await expect(hand).toHaveAttribute('data-tz', zone);
    const angle = await hand.evaluate((el) => parseFloat(el.style.getPropertyValue('--a')));
    expect(angle).toBeCloseTo(dialAngle(zonedParts(moment, zone)), 1);
  }
  // Every city is marked on the dial by its code (or name); the selected one is named in full.
  for (const [i, c] of away.entries()) await expect(hands.nth(i)).toHaveText(mark(c));
  if (here) await expect(hands.last()).toHaveText(mark(here));
  await expect(phone.locator('.phone__city')).toHaveText(selected.name);
}

test.describe('the Clock Stamp phone', () => {
  test('runs on the real time and moves with each minute', async ({ page }) => {
    const now = new Date('2027-03-01T07:59:30Z'); // not the sample moment
    await page.clock.install({ time: now });
    await page.goto(V2);
    await expectFace(page, now);
    await page.clock.fastForward(45_000);
    await expectFace(page, new Date(now.getTime() + 45_000));
  });

  test('is hidden from assistive technology', async ({ page }) => {
    await page.goto(V2);
    await expect(page.locator('.phone')).toHaveAttribute('aria-hidden', 'true');
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('shows the sample moment it was built for', async ({ page }) => {
      await page.goto(V2);
      await expectFace(page, SAMPLE_MOMENT);
    });
  });
});
