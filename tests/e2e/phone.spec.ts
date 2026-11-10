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
const selected = cities[0]!;

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
  await expect(hands).toHaveCount(cities.length + 1); // one per city, and "here"
  const zones = [...cities.map((c) => c.time_zone), home];
  for (const [i, zone] of zones.entries()) {
    const hand = hands.nth(i);
    await expect(hand).toHaveAttribute('data-tz', zone);
    const angle = await hand.evaluate((el) => parseFloat(el.style.getPropertyValue('--a')));
    expect(angle).toBeCloseTo(dialAngle(zonedParts(moment, zone)), 1);
  }
  for (const c of cities) await expect(phone.getByText(c.name, { exact: true })).not.toHaveCount(0);
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
