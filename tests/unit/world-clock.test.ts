import { describe, expect, it } from 'vitest';
import {
  dateLabel,
  dialAngle,
  hourLabel,
  isTimeZone,
  minuteLabel,
  offsetLabel,
  timeLabel,
  utcOffsetMinutes,
  zonedParts,
} from '../../src/lib/world-clock';

// 09:45 in Seattle (PDT) on Saturday 24 October 2026.
const T = new Date('2026-10-24T16:45:00Z');

describe('world clock (the Clock Stamp phone)', () => {
  it('reads the wall clock of a zone, across the date line', () => {
    expect(zonedParts(T, 'America/Los_Angeles')).toMatchObject({
      year: 2026,
      month: 10,
      day: 24,
      hour: 9,
      minute: 45,
      weekday: 'Sat',
      monthName: 'Oct',
    });
    const tokyo = zonedParts(T, 'Asia/Tokyo');
    expect(timeLabel(tokyo)).toBe('01:45');
    expect(dateLabel(tokyo)).toBe('Sun, Oct 25');
    expect([hourLabel(tokyo), minuteLabel(tokyo)]).toEqual(['01', '45']);
  });

  it('writes midnight as 00, never 24', () => {
    const midnight = zonedParts(new Date('2026-10-24T15:00:00Z'), 'Asia/Tokyo');
    expect(midnight.hour).toBe(0);
    expect(timeLabel(midnight)).toBe('00:00');
    expect(dialAngle(midnight)).toBe(0);
  });

  it('points a hand on the 24-hour dial: midnight up, 06:00 right, noon down', () => {
    const at = (iso: string) => dialAngle(zonedParts(new Date(iso), 'UTC'));
    expect(at('2026-01-01T00:00:00Z')).toBe(0);
    expect(at('2026-01-01T06:00:00Z')).toBe(90);
    expect(at('2026-01-01T12:00:00Z')).toBe(180);
    expect(at('2026-01-01T18:00:00Z')).toBe(270);
    expect(at('2026-01-01T01:45:00Z')).toBeCloseTo(26.25);
    expect(at('2026-01-01T23:59:00Z')).toBeLessThan(360);
  });

  it('knows each zone’s offset from UTC, with daylight saving', () => {
    expect(utcOffsetMinutes(T, 'UTC')).toBe(0);
    expect(utcOffsetMinutes(T, 'Asia/Tokyo')).toBe(540);
    expect(utcOffsetMinutes(T, 'America/Los_Angeles')).toBe(-420); // PDT
    expect(utcOffsetMinutes(new Date('2026-12-24T16:45:00Z'), 'America/Los_Angeles')).toBe(-480);
    expect(utcOffsetMinutes(T, 'Asia/Kolkata')).toBe(330);
    // Seconds inside the minute don't change the answer.
    expect(utcOffsetMinutes(new Date('2026-10-24T16:45:59.900Z'), 'Asia/Tokyo')).toBe(540);
  });

  it('labels how far a city is from home', () => {
    expect(offsetLabel(T, 'Asia/Tokyo', 'America/Los_Angeles')).toBe('+16h');
    expect(offsetLabel(T, 'America/Los_Angeles', 'Asia/Tokyo')).toBe('-16h');
    expect(offsetLabel(T, 'America/Los_Angeles', 'America/Los_Angeles')).toBe('+0h');
    expect(offsetLabel(T, 'Asia/Kolkata', 'UTC')).toBe('+5h30');
    expect(offsetLabel(T, 'Asia/Kathmandu', 'UTC')).toBe('+5h45');
    expect(offsetLabel(T, 'America/St_Johns', 'UTC')).toBe('-2h30');
    // In winter Seattle is one hour further from Tokyo.
    expect(offsetLabel(new Date('2026-12-24T16:45:00Z'), 'Asia/Tokyo', 'America/Los_Angeles')).toBe(
      '+17h',
    );
  });

  it('tells a real zone name from a city name', () => {
    expect(isTimeZone('Pacific/Auckland')).toBe(true);
    expect(isTimeZone('Seattle')).toBe(false);
    expect(isTimeZone('')).toBe(false);
  });
});
