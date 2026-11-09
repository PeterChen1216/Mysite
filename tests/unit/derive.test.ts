import { describe, expect, it } from 'vitest';
import {
  classYear,
  copyVars,
  displayUrl,
  educationDates,
  experienceRows,
  fillCopy,
  fillTemplate,
  gitLog,
  githubHandle,
  glyphParts,
  gpaBadge,
  gpaRatio,
  heroEyebrow,
  highlightParts,
  inlineText,
  isDecorative,
  latestHonor,
  logRange,
  nowLines,
  nowProject,
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
/** The same school with every optional field left out. */
const bareEdu: EducationLike = {
  school: 'Some College',
  degree: 'BA',
  start: '2020-09',
  end: '2024-06',
  expected: false,
  gpa_label: 'GPA',
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
    expect(displayUrl('http://example.com')).toBe('example.com');
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
    expect(logRange('2026-10', 'present', 'present')).toBe('2026-10 → present');
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
    expect(highlightParts('[a] and [b] end')).toEqual([
      { text: 'a', hi: true },
      { text: ' and ', hi: false },
      { text: 'b', hi: true },
      { text: ' end', hi: false },
    ]);
    expect(highlightParts('plain')).toEqual([{ text: 'plain', hi: false }]);
  });
});

describe('facts come only from content', () => {
  it('hero eyebrow and whoami', () => {
    expect(heroEyebrow('Peter Chen', edu, 'Seattle, Washington')).toBe(
      '// player: Peter Chen  ·  UW iSchool ’27  ·  Seattle, Washington',
    );
    // Prefix from copy.yaml; no short name falls back to the school.
    expect(heroEyebrow('A B', bareEdu, 'X', '>>')).toBe('>> A B  ·  Some College ’24  ·  X');
    expect(whoamiLine('Zhicheng (Peter) Chen', edu)).toBe(
      'Zhicheng (Peter) Chen — Informatics · Data Science @ University of Washington, Seattle, class of ’27.',
    );
    // No major or track: the degree stands in.
    expect(whoamiLine('A B', bareEdu, 'Class of')).toBe('A B — BA @ Some College, Class of ’24.');
  });
  it('GPA badge uses the latest honor and real GPA', () => {
    expect(latestHonor(honors)?.year).toBe('2025-2026');
    expect(latestHonor([])).toBeUndefined();
    expect(gpaBadge(edu, honors)).toBe("GPA 3.84  ★  Annual Dean's List 2025–26");
    expect(gpaBadge(edu, [])).toBe('GPA 3.84');
    expect(gpaBadge({ ...edu, gpa: undefined }, honors)).toBeUndefined();
    expect(gpaRatio('3.84/4.00')).toBeCloseTo(0.96);
    expect(gpaRatio('4.2/4.0')).toBe(1);
    expect(gpaRatio('n/a')).toBeUndefined();
    expect(gpaRatio(undefined)).toBeUndefined();
  });
  it('project badge reflects status and App Store link', () => {
    expect(projectBadge(project())).toBe('Clock Stamp · iOS  [SHIPPED → App Store]');
    expect(projectBadge(project(), 'App Store')).toBe('Clock Stamp · iOS  [SHIPPED → App Store]');
    expect(projectBadge(project({ status: 'wip', links: {} }))).toBe(
      'Clock Stamp · iOS  [IN PROGRESS]',
    );
    // A platform without a label is shown as written; no links at all is fine.
    expect(projectBadge(project({ platform: ['ios', 'watch'], links: undefined }))).toBe(
      'Clock Stamp · iOS/watch  [SHIPPED]',
    );
  });
  it('now-building prefers ongoing featured projects', () => {
    const a = project({ id: 'a', featured: false, end: '2025-12' });
    const b = project({ id: 'b', featured: false, end: 'present' });
    const c = project({ id: 'c', featured: true, end: 'present' });
    expect(nowProject([a, b, c])?.id).toBe('c');
    expect(nowProject([a, b])?.id).toBe('b');
    expect(nowProject([a])).toBeUndefined();
    expect(nowProject([])).toBeUndefined();
    // A finished featured project is never shown as "now building".
    const done = project({ id: 'done', featured: true, status: 'completed', end: '2025-12' });
    expect(nowProject([done])).toBeUndefined();
  });
  it('status bars', () => {
    expect(statusBar('shipped')).toEqual({ filled: 10, total: 10, label: 'shipped' });
    expect(statusBar('wip').filled).toBeLessThan(10);
    expect(statusBar('idea').label).toBe('idea');
  });
  it('education dates', () => {
    expect(educationDates(edu)).toBe('Sep 2023 – Mar 2027 (expected)');
    expect(educationDates(edu, '(est.)')).toBe('Sep 2023 – Mar 2027 (est.)');
    expect(educationDates(bareEdu)).toBe('Sep 2020 – Jun 2024');
  });
});

describe('ticker', () => {
  const experience = [
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
  ];
  it('is built only from content facts', () => {
    const items = tickerItems({
      edu,
      honors,
      projects: [project(), project({ id: 'x', title: 'Hidden', featured: false })],
      experience,
      interests: [{ name: 'Choir', tag: 'choir' }, { name: 'No tag' }],
      now: ['Writing my thesis'],
      email: 'a@b.c',
    });
    expect(items).toEqual([
      { tag: 'XP', text: "Cumulative GPA 3.84/4.00 · Annual Dean's List 2025–26", tone: 'green' },
      { tag: 'NOW', text: 'Writing my thesis', tone: 'gold' },
      { tag: 'WORK', text: 'TA @ iSchool', tone: 'enchant' },
      { tag: 'iOS', text: 'Clock Stamp · shipped', tone: 'gold' },
      { tag: 'UW', text: 'Informatics · Data Science ’27', tone: 'diamond' },
      { tag: 'CHOIR', text: 'Choir', tone: 'enchant' },
      { tag: 'PING', text: 'a@b.c', tone: 'green' },
    ]);
  });
  it('uses the copy.yaml tag words and skips what content leaves out', () => {
    const items = tickerItems({
      edu: bareEdu,
      honors: [],
      projects: [],
      experience: [],
      interests: [{ name: 'Rock climbing', tag: 'climbing' }],
      now: [],
      tags: { xp: 'LVL', now: 'NOW', work: 'JOB', ping: 'MAIL', edu: 'SCHOOL' },
    });
    // No GPA → no XP item; no short name → the EDU tag word; degree when there is no major;
    // an interest without a design colour is diamond; no email → no ping item.
    expect(items).toEqual([
      { tag: 'SCHOOL', text: 'BA ’24', tone: 'diamond' },
      { tag: 'CLIMBING', text: 'Rock climbing', tone: 'diamond' },
    ]);
    expect(
      tickerItems({ edu, honors: [], projects: [], experience, interests: [], now: [] })[0],
    ).toEqual({ tag: 'XP', text: 'Cumulative GPA 3.84/4.00', tone: 'green' });
  });
});

describe('git log', () => {
  const rows = gitLog({
    status: 'Open to internships & collaborations',
    headHint: 'say hi ↓',
    headDates: 'now →',
    expectedLabel: '(expected)',
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
      dates: 'now →',
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
    // Education still in progress keeps its "(expected)" marker, as a note that may wrap.
    expect(rows.at(-1)).toMatchObject({ dates: '2023-09 → 2027-03', note: '(expected)' });
    expect(rows[1]?.note).toBeUndefined();
  });
  it('picks icons by kind and keeps logos', () => {
    expect(rows.map((r) => r.icon)).toEqual(['diamond', 'command', 'logo', 'grass', 'bookshelf']);
    expect(rows[2]?.logo).toBe('LOGO');
    expect(rows[2]?.logoAlt).toBe('HashKey');
  });
  it('a finished degree has no note; labels default when not given', () => {
    const log = gitLog({
      status: 's',
      headHint: 'h',
      headDates: 'd',
      experience: [
        { company: 'C', role: 'R', start: '2024-01', end: 'present', location: 'L' },
        { company: 'D', role: 'Q', start: '2023-01', end: '2023-06', location: 'L', logo: 'X' },
      ],
      education: [
        bareEdu,
        { ...bareEdu, school: 'Next', start: '2024-09', end: '2026-06', expected: true },
      ],
    });
    expect(log.map((r) => [r.dates, r.note, r.hash === 'init'])).toEqual([
      ['d', undefined, false],
      ['2024-09 → 2026-06', '(expected)', false],
      ['2024-01 → now', undefined, false],
      ['2023-01 → 2023-06', undefined, false],
      ['2020-09 → 2024-06', undefined, true],
    ]);
    // A logo without alt text gets an empty alt (decorative).
    expect(log.find((r) => r.icon === 'logo')?.logoAlt).toBe('');
    expect(log.find((r) => r.title === 'R')?.icon).toBe('command');
  });
});

describe('experienceRows', () => {
  it('maps volunteer entries to grass rows, newest first; finished work to terminal', () => {
    const rows = experienceRows(
      [
        {
          company: 'A',
          role: 'Volunteer',
          kind: 'volunteer',
          start: '2022-01',
          end: '2022-05',
          location: 'X',
        },
        { company: 'B', role: 'Dev', start: '2023-10', end: '2024-04', location: 'Y' },
      ],
      'present',
    );
    expect(rows.map((r) => [r.sub, r.icon, r.dates])).toEqual([
      ['B · Y', 'terminal', '2023-10 → 2024-04'],
      ['A · X', 'grass', '2022-01 → 2022-05'],
    ]);
  });
});

describe('copy.yaml templates', () => {
  it('fills {placeholders} from content', () => {
    expect(fillTemplate('online · {city}', { city: 'Seattle' })).toBe('online · Seattle');
    expect(
      fillTemplate('Hi, I’m {first} — {major}.', { first: 'Peter', major: 'Informatics' }),
    ).toBe('Hi, I’m Peter — Informatics.');
    expect(fillTemplate('no placeholders', {})).toBe('no placeholders');
    // `{rotate:1b}` in the summon command is not a placeholder.
    expect(fillTemplate('/summon ~ {rotate:1b}', {})).toBe('/summon ~ {rotate:1b}');
  });
  it('fails on unknown or empty placeholders instead of printing them', () => {
    expect(() => fillTemplate('Hi {nmae}', { name: 'x' })).toThrow(/\{nmae\}/);
    expect(() => fillTemplate('Hi {first}', { first: '' })).toThrow(/empty/);
  });
  it('keeps placeholders that are filled later', () => {
    expect(fillTemplate('{from} ⇄ {to} in {city}', { city: 'SEA' }, ['from', 'to'])).toBe(
      '{from} ⇄ {to} in SEA',
    );
  });
  it('fills every string in the copy tree, leaving local placeholders', () => {
    const copy = {
      id: 'copy',
      nav: { status: 'online · {city}', links: [{ label: '{first}', href: '#a' }] },
      hero: { avgeek_route: 'AvGeek ✈ {from} ⇄ {to}', headline: ['Crafting [data]'] },
      count: 3,
      on: true,
    };
    expect(fillCopy(copy, { city: 'Seattle', first: 'Peter' })).toEqual({
      id: 'copy',
      nav: { status: 'online · Seattle', links: [{ label: 'Peter', href: '#a' }] },
      hero: { avgeek_route: 'AvGeek ✈ {from} ⇄ {to}', headline: ['Crafting [data]'] },
      count: 3,
      on: true,
    });
    expect(() => fillCopy({ footer: { tagline: 'built in {cty}' } }, { city: 'x' })).toThrow(
      /\{cty\}/,
    );
  });
  it('placeholder values come from content, with fallbacks for optional fields', () => {
    const base = { displayName: 'Peter Chen', location: 'Seattle, Washington', domain: 'zhic.me' };
    expect(copyVars({ ...base, email: 'p@x.y', edu })).toEqual({
      first: 'Peter',
      host: 'peter',
      city: 'Seattle',
      domain: 'zhic.me',
      email: 'p@x.y',
      major: 'Informatics',
      department: 'Information School',
      school: 'University of Washington, Seattle',
      short: 'UW iSchool',
    });
    expect(
      copyVars({
        displayName: 'Mononym',
        location: 'Remote',
        domain: 'd',
        email: 'e',
        edu: bareEdu,
      }),
    ).toMatchObject({
      first: 'Mononym',
      city: 'Remote',
      major: 'BA',
      department: 'Some College',
      short: 'Some College',
    });
  });
});

describe('decorative symbols', () => {
  it('recognises symbol-only strings', () => {
    expect(isDecorative('_')).toBe(true);
    expect(isDecorative(' ↓ ')).toBe(true);
    expect(isDecorative('love')).toBe(false);
    expect(isDecorative('2027')).toBe(false);
  });
  it('splits symbols off the ends of a label, keeping ordinary punctuation', () => {
    expect(glyphParts('▲ back to spawn')).toEqual({ lead: '▲ ', text: 'back to spawn', trail: '' });
    expect(glyphParts('say hi ↓')).toEqual({ lead: '', text: 'say hi', trail: ' ↓' });
    expect(glyphParts('★ FEATURED ★')).toEqual({ lead: '★ ', text: 'FEATURED', trail: ' ★' });
    expect(glyphParts('??? (loading…)')).toEqual({ lead: '', text: '??? (loading…)', trail: '' });
    expect(glyphParts('plain')).toEqual({ lead: '', text: 'plain', trail: '' });
    // Only symbols: nothing to read, keep it as it is.
    expect(glyphParts('→')).toEqual({ lead: '', text: '→', trail: '' });
  });
});

describe('now.md lines', () => {
  it('turns bullets into plain ticker lines', () => {
    const md = [
      "<!-- What you're doing right now -->",
      '# Now',
      '',
      '- Shipping [Clock Stamp](https://apps.apple.com/app/id1) 1.2 with **home-screen widgets**',
      '* TA for `INFO_180` this quarter,',
      '  helping with _R labs_',
      '+ Reading ~~less~~ more',
      '1. Numbered works too',
      '---',
      'A loose paragraph',
      'over two lines.',
    ].join('\n');
    expect(nowLines(md)).toEqual([
      'Shipping Clock Stamp 1.2 with home-screen widgets',
      'TA for INFO_180 this quarter, helping with R labs',
      'Reading less more',
      'Numbered works too',
      'A loose paragraph over two lines.',
    ]);
  });
  it('is empty for a file with only its comment', () => {
    expect(nowLines('<!-- one line per bullet -->\n')).toEqual([]);
    expect(nowLines('')).toEqual([]);
  });
  it('reduces inline Markdown to its words', () => {
    expect(inlineText('![logo](x.png) [docs][1] <b>bold</b> *em* snake_case_name')).toBe(
      'logo docs bold em snake_case_name',
    );
    expect(inlineText('`2*3*4` stays \\*literal\\*')).toBe('2*3*4 stays *literal*');
  });
});
