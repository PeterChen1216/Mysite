/**
 * World-clock arithmetic for the Clock Stamp phone (PhoneMockup.astro): the time in a zone, where
 * its hand points on a 24-hour dial, and how far the zone is from home. Pure and dependency-free,
 * so the same functions draw the static face at build time and keep it live in the browser
 * (src/scripts/clock.ts). Unit-tested in tests/unit/world-clock.test.ts.
 */

export interface ZonedParts {
  year: number;
  /** 1–12. */
  month: number;
  day: number;
  /** 0–23. */
  hour: number;
  minute: number;
  /** `Sat`. */
  weekday: string;
  /** `Oct`. */
  monthName: string;
}

/**
 * The moment the phone is drawn for at build time, so every build gives the same page; it is what
 * shows without JavaScript (09:45 on a Saturday in Seattle, already Sunday in Tokyo).
 */
export const SAMPLE_MOMENT = new Date('2026-10-24T16:45:00Z');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** One formatter per zone: building an Intl.DateTimeFormat is the slow part. */
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** True for a zone name the runtime knows (`Asia/Tokyo`); `Seattle` is not one. */
export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The wall-clock date and time of `date` in an IANA zone. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const raw: Record<string, string> = {};
  for (const p of formatter(timeZone).formatToParts(date)) raw[p.type] = p.value;
  const monthName = raw.month ?? 'Jan';
  return {
    year: Number(raw.year),
    month: MONTHS.indexOf(monthName) + 1,
    day: Number(raw.day),
    hour: Number(raw.hour) % 24,
    minute: Number(raw.minute),
    weekday: raw.weekday ?? '',
    monthName,
  };
}

const two = (n: number) => String(n).padStart(2, '0');

/** `01`. */
export const hourLabel = (p: ZonedParts): string => two(p.hour);
/** `45`. */
export const minuteLabel = (p: ZonedParts): string => two(p.minute);
/** `01:45`. */
export const timeLabel = (p: ZonedParts): string => `${two(p.hour)}:${two(p.minute)}`;
/** `Sat, Oct 24`. */
export const dateLabel = (p: ZonedParts): string => `${p.weekday}, ${p.monthName} ${p.day}`;

/**
 * Where a hand points on a 24-hour dial, in degrees clockwise from the top: midnight is 0°,
 * 06:00 is 90°, noon 180°.
 */
export function dialAngle(p: ZonedParts): number {
  return ((p.hour * 60 + p.minute) / 1440) * 360;
}

/** A zone's offset from UTC at `date`, in minutes (Tokyo: 540). */
export function utcOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const instant = Math.floor(date.getTime() / 60_000) * 60_000;
  return Math.round((wall - instant) / 60_000);
}

/**
 * How far `timeZone` is ahead of (or behind) `homeZone` at `date`: `+16h`, `-3h`, `+0h`, and
 * `+5h30` for the zones that sit on a half or three-quarter hour.
 */
export function offsetLabel(date: Date, timeZone: string, homeZone: string): string {
  const diff = utcOffsetMinutes(date, timeZone) - utcOffsetMinutes(date, homeZone);
  const sign = diff < 0 ? '-' : '+';
  const hours = Math.floor(Math.abs(diff) / 60);
  const minutes = Math.abs(diff) % 60;
  return `${sign}${hours}h${minutes ? two(minutes) : ''}`;
}
