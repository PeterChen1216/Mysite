import { describe, expect, it } from 'vitest';
import {
  classYear,
  displayUrl,
  educationDates,
  gitLog,
  githubHandle,
  gpaBadge,
  gpaRatio,
  heroEyebrow,
  highlightParts,
  latestHonor,
  logRange,
  nowProject,
  pingLines,
  projectBadge,
  pseudoHash,
  shortAcademicYear,
  statusBar,
  tickerItems,
  whoamiLine,
  type EducationLike,
  type ProjectLike,
} from '../../src/lib/derive';

const edu: EducationLike = {
  school: 'University of Washington, Seattle',
  short: 'UW iSchool',
  department: 'Information School',
  degree: 'Bachelor of Science in Informatics',
  major: 'Informatics',
  track: 'Data Science',
  start: '2023-09',
  end: '2027-03',
  expected: true,
  gpa: '3.84/4.00',
  gpa_label: 'Cumulative GPA',
  honors: [],
};
const honors = [
  { name: "Annual Dean's List", year: '2024-2025' },
  { name: "Annual Dean's List", year: '2025-2026' },
];
const project = (over: Partial<ProjectLike> = {}): ProjectLike => ({
  id: 'p',
  title: 'Clock Stamp',
  status: 'shipped',
  platform: ['ios'],
  featured: true,
  year: 2026,
  start: '2026-03',
  end: 'present',
  links: { appstore: 'https://apps.apple.com/app/id1' },
  ...over,
});

describe('formatters', () => {
  it('class year and academic years', () => {
    expect(classYear('2027-03')).toBe('’27');
    expect(shortAcademicYear('2025-2026')).toBe('2025–26');
    expect(shortAcademicYear('2025')).toBe('2025');
  });
  it('urls and handles', () => {
    expect(displayUrl('https://www.linkedin.com/in/peterchen1216/')).toBe(
      'linkedin.com/in/peterchen1216',
    );
    expect(
      githubHandle([
        { network: 'github', label: 'GitHub', url: 'https://github.com/PeterChen1216' },
      ]),
    ).toBe('PeterChen1216');
    expect(githubHandle([])).toBeUndefined();
  });
  it('log ranges and hashes', () => {
    expect(logRange('2024-07', '2024-09')).toBe('2024-07 → 2024-09');
    expect(logRange('2026-10', 'present')).toBe('2026-10 → now');
    expect(pseudoHash('x')).toMatch(/^[0-9a-f]{7}$/);
    expect(pseudoHash('x')).toBe(pseudoHash('x'));
  });
  it('highlight markers', () => {
    expect(highlightParts('Crafting [data]')).toEqual([
      { text: 'Crafting ', hi: false },
      { text: 'data', hi: true },
    ]);
    expect(highlightParts('people love[_]')).toEqual([
      { text: 'people love', hi: false },
      { text: '_', hi: true },
    ]);
    expect(highlightParts('plain')).toEqual([{ text: 'plain', hi: false }]);
  });
});

describe('facts come only from content', () => {
  it('hero eyebrow and whoami', () => {
    expect(heroEyebrow('Peter Chen', edu, 'Seattle, Washington')).toBe(
      '// player: Peter Chen  ·  UW iSchool ’27  ·  Seattle, Washington',
    );
    expect(whoamiLine('Zhicheng (Peter) Chen', edu)).toBe(
      'Zhicheng (Peter) Chen — Informatics · Data Science @ University of Washington, Seattle, class of ’27.',
    );
  });
  it('GPA badge uses the latest honor and real GPA', () => {
    expect(latestHonor(honors)?.year).toBe('2025-2026');
    expect(gpaBadge(edu, honors)).toBe("GPA 3.84  ★  Dean's List 2025–26");
    expect(gpaBadge({ ...edu, gpa: undefined }, honors)).toBeUndefined();
    expect(gpaRatio('3.84/4.00')).toBeCloseTo(0.96);
    expect(gpaRatio(undefined)).toBeUndefined();
  });
  it('project badge reflects status and App Store link', () => {
    expect(projectBadge(project())).toBe('Clock Stamp · iOS  [SHIPPED → App Store]');
    expect(projectBadge(project({ status: 'wip', links: {} }))).toBe(
      'Clock Stamp · iOS  [IN PROGRESS]',
    );
  });
  it('now-building prefers ongoing featured projects', () => {
    const a = project({ id: 'a', featured: false, end: '2025-12' });
    const b = project({ id: 'b', featured: false, end: 'present' });
    const c = project({ id: 'c', featured: true, end: 'present' });
    expect(nowProject([a, b, c])?.id).toBe('c');
    expect(nowProject([a, b])?.id).toBe('b');
    expect(nowProject([a])).toBeUndefined();
  });
  it('status bars', () => {
    expect(statusBar('shipped')).toEqual({ filled: 10, total: 10, label: 'shipped' });
    expect(statusBar('wip').filled).toBeLessThan(10);
  });
  it('education dates', () => {
    expect(educationDates(edu)).toBe('Sep 2023 – Mar 2027 (expected)');
  });
});

describe('ticker', () => {
  it('is built only from content facts', () => {
    const items = tickerItems({
      edu,
      honors,
      projects: [project(), project({ id: 'x', title: 'Hidden', featured: false })],
      experience: [
        { company: 'iSchool', role: 'TA', start: '2026-10', end: 'present', location: 'Seattle' },
        { company: 'Old', role: 'Intern', start: '2024-07', end: '2024-09', location: 'Shanghai' },
        {
          company: 'Bank',
          role: 'Volunteer',
          kind: 'volunteer',
          start: '2023-10',
          end: 'present',
          location: 'S',
        },
      ],
      interests: [{ name: 'Choir', tag: 'choir' }, { name: 'No tag' }],
      now: ['Writing my thesis'],
      email: 'a@b.c',
    });
    expect(items).toEqual([
      { tag: 'XP', text: "Cumulative GPA 3.84/4.00 · Dean's List 2025–26" },
      { tag: 'NOW', text: 'Writing my thesis' },
      { tag: 'WORK', text: 'TA @ iSchool' },
      { tag: 'iOS', text: 'Clock Stamp · shipped' },
      { tag: 'UW', text: 'Informatics · Data Science ’27' },
      { tag: 'CHOIR', text: 'Choir' },
      { tag: 'PING', text: 'a@b.c' },
    ]);
  });
});

describe('git log', () => {
  const rows = gitLog({
    status: 'Open to internships & collaborations',
    headHint: 'say hi ↓',
    currentYear: 2026,
    experience: [
      {
        company: 'HashKey Global',
        role: 'Operations Intern (Summer)',
        start: '2024-07',
        end: '2024-09',
        location: 'Shanghai, China',
        logo: 'LOGO',
        logo_alt: 'HashKey',
      },
      { company: 'iSchool', role: 'TA', start: '2026-10', end: 'present', location: 'Seattle, WA' },
      {
        company: 'Food Bank',
        role: 'Volunteer',
        kind: 'volunteer',
        start: '2023-10',
        end: '2024-04',
        location: 'Seattle, WA',
      },
    ],
    education: [edu],
  });
  it('starts with HEAD from the profile status', () => {
    expect(rows[0]).toMatchObject({
      hash: 'HEAD -> main',
      head: true,
      dates: '2026 →',
      title: 'Open to internships & collaborations',
    });
  });
  it('orders the rest newest first and labels the oldest init', () => {
    expect(rows.slice(1).map((r) => r.title)).toEqual([
      'TA',
      'Operations Intern (Summer)',
      'Volunteer',
      'Bachelor of Science in Informatics · Data Science',
    ]);
    expect(rows.at(-1)?.hash).toBe('init');
    expect(rows[1]?.dates).toBe('2026-10 → now');
  });
  it('picks icons by kind and keeps logos', () => {
    expect(rows.map((r) => r.icon)).toEqual(['diamond', 'command', 'logo', 'grass', 'bookshelf']);
    expect(rows[2]?.logo).toBe('LOGO');
  });
});

describe('contact', () => {
  it('ping transcript uses the given address', () => {
    expect(pingLines('a@b.c')[0]).toBe('PING peter (a@b.c): 56 data bytes');
    expect(pingLines('a@b.c')).toHaveLength(3);
  });
});

describe('experienceRows', () => {
  it('maps volunteer entries to grass rows, newest first', async () => {
    const { experienceRows } = await import('../../src/lib/derive');
    const rows = experienceRows([
      {
        company: 'A',
        role: 'Volunteer',
        kind: 'volunteer',
        start: '2022-01',
        end: '2022-05',
        location: 'X',
      },
      {
        company: 'B',
        role: 'Volunteer',
        kind: 'volunteer',
        start: '2023-10',
        end: '2024-04',
        location: 'Y',
      },
    ]);
    expect(rows.map((r) => [r.sub, r.icon])).toEqual([
      ['B · Y', 'grass'],
      ['A · X', 'grass'],
    ]);
  });
});
