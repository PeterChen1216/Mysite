import { describe, expect, it } from 'vitest';
import {
  aboutAreas,
  aboutCards,
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
  gridAreas,
  headlineWords,
  heroEyebrow,
  highlightParts,
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
  withGpaLabel,
  type EducationLike,
  type ProjectLike,
} from '../../src/lib/derive';

type Edu = EducationLike & { gpa_label: string };
const edu: Edu = {
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
const bareEdu: Edu = {
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
    expect(logRange('2024-07', '2024-09', 'now')).toBe('2024-07 → 2024-09');
    expect(logRange('2026-10', 'present', 'now')).toBe('2026-10 → now');
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

describe('hero headline', () => {
  const words = (lines: string[]) =>
    headlineWords(lines).map((line) =>
      line
        .map((t) => ('space' in t ? ' ' : `${t.text}${t.hi ? '*' : ''}${t.deco ? '!' : ''}`))
        .join(''),
    );
  it('numbers words across lines and marks the highlighted ones', () => {
    const lines = headlineWords(['Crafting [data]', 'people love[_]']);
    expect(
      lines
        .flat()
        .filter((t) => !('space' in t))
        .map((t) => ('i' in t ? t.i : -1)),
    ).toEqual([0, 1, 2, 3, 4]);
    expect(words(['Crafting [data]', 'people love[_]'])).toEqual([
      'Crafting data*',
      'people love_*!',
    ]);
  });
  it('hides only a highlighted part that is all symbols', () => {
    expect(words(['Crafting [data & design]', 'AI + [data] & ops', 'into [→] things'])).toEqual([
      'Crafting data* &* design*',
      'AI + data* & ops',
      'into →*! things',
    ]);
  });
});

/** copy.yaml words as shipped; derive.ts has no defaults, so tests pass them like the page does. */
const TAGS = { xp: 'XP', now: 'NOW', work: 'WORK', ping: 'PING', edu: 'EDU' };
const STATUS_WORDS = {
  idea: 'idea',
  wip: 'in progress',
  testflight: 'TestFlight',
  shipped: 'shipped',
  completed: 'completed',
  archived: 'archived',
};

describe('facts come only from content', () => {
  it('hero eyebrow and whoami', () => {
    expect(heroEyebrow('Peter Chen', edu, 'Seattle, Washington', '// player:')).toBe(
      '// player: Peter Chen  ·  UW iSchool ’27  ·  Seattle, Washington',
    );
    // Prefix from copy.yaml; no short name falls back to the school.
    expect(heroEyebrow('A B', bareEdu, 'X', '>>')).toBe('>> A B  ·  Some College ’24  ·  X');
    expect(whoamiLine('Zhicheng (Peter) Chen', edu, 'class of')).toBe(
      'Zhicheng (Peter) Chen — Informatics · Data Science @ University of Washington, Seattle, class of ’27.',
    );
    // No major or track: the degree stands in.
    expect(whoamiLine('A B', bareEdu, 'Class of')).toBe('A B — BA @ Some College, Class of ’24.');
  });
  it('GPA badge uses the latest honor and real GPA', () => {
    expect(latestHonor(honors)?.year).toBe('2025-2026');
    expect(latestHonor([])).toBeUndefined();
    expect(gpaBadge(edu, honors, 'GPA')).toBe("GPA 3.84  ★  Annual Dean's List 2025–26");
    expect(gpaBadge(edu, [], 'GPA')).toBe('GPA 3.84');
    // The label is copy.yaml labels.gpa.
    expect(gpaBadge(edu, [], 'Grade')).toBe('Grade 3.84');
    expect(gpaBadge({ ...edu, gpa: undefined }, honors, 'GPA')).toBeUndefined();
    expect(gpaRatio('3.84/4.00')).toBeCloseTo(0.96);
    expect(gpaRatio('4.2/4.0')).toBe(1);
    expect(gpaRatio('n/a')).toBeUndefined();
    expect(gpaRatio(undefined)).toBeUndefined();
  });
  it('project badge reflects status and App Store link', () => {
    expect(projectBadge(project(), 'App Store', STATUS_WORDS)).toBe(
      'Clock Stamp · iOS  [SHIPPED → App Store]',
    );
    // The store label is copy.yaml's, used as written (here with a no-break space).
    expect(projectBadge(project(), 'App\u00a0Store', STATUS_WORDS)).toBe(
      'Clock Stamp · iOS  [SHIPPED → App\u00a0Store]',
    );
    expect(projectBadge(project({ status: 'wip', links: {} }), 'App Store', STATUS_WORDS)).toBe(
      'Clock Stamp · iOS  [IN PROGRESS]',
    );
    // A platform without a label is shown as written; no links at all is fine.
    expect(
      projectBadge(
        project({ platform: ['ios', 'watch'], links: undefined }),
        'App Store',
        STATUS_WORDS,
      ),
    ).toBe('Clock Stamp · iOS/watch  [SHIPPED]');
    // Status words come from copy.yaml labels.status.
    expect(projectBadge(project(), 'Store', { ...STATUS_WORDS, shipped: 'live' })).toBe(
      'Clock Stamp · iOS  [LIVE → Store]',
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
    expect(statusBar('shipped', STATUS_WORDS)).toEqual({
      filled: 10,
      total: 10,
      label: 'shipped',
    });
    expect(statusBar('wip', STATUS_WORDS).filled).toBeLessThan(10);
    expect(statusBar('idea', STATUS_WORDS).label).toBe('idea');
    expect(statusBar('wip', { ...STATUS_WORDS, wip: 'building' }).label).toBe('building');
  });
  it('GPA label: the entry’s own, else copy.yaml’s', () => {
    const { gpa_label: _own, ...unlabelled } = bareEdu;
    expect(withGpaLabel([edu, unlabelled], 'Notenschnitt').map((e) => e.gpa_label)).toEqual([
      'Cumulative GPA',
      'Notenschnitt',
    ]);
  });
  it('education dates', () => {
    expect(educationDates(edu, '(expected)')).toBe('Sep 2023 – Mar 2027 (expected)');
    expect(educationDates(edu, '(est.)')).toBe('Sep 2023 – Mar 2027 (est.)');
    expect(educationDates(bareEdu, '(expected)')).toBe('Sep 2020 – Jun 2024');
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
      tags: TAGS,
      statusLabels: STATUS_WORDS,
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
      statusLabels: STATUS_WORDS,
    });
    // No GPA → no XP item; no short name → the EDU tag word; degree when there is no major;
    // an interest without a design colour is diamond; no email → no ping item.
    expect(items).toEqual([
      { tag: 'SCHOOL', text: 'BA ’24', tone: 'diamond' },
      { tag: 'CLIMBING', text: 'Rock climbing', tone: 'diamond' },
    ]);
    expect(
      tickerItems({
        edu,
        honors: [],
        projects: [],
        experience,
        interests: [],
        now: [],
        tags: TAGS,
        statusLabels: STATUS_WORDS,
      })[0],
    ).toEqual({ tag: 'XP', text: 'Cumulative GPA 3.84/4.00', tone: 'green' });
    // The featured project's status word comes from copy.yaml labels.status.
    const featured = tickerItems({
      edu: bareEdu,
      honors: [],
      projects: [project()],
      experience: [],
      interests: [],
      now: [],
      tags: TAGS,
      statusLabels: { ...STATUS_WORDS, shipped: 'live' },
    });
    expect(featured[0]).toEqual({ tag: 'iOS', text: 'Clock Stamp · live', tone: 'gold' });
  });
});

describe('git log', () => {
  const rows = gitLog({
    status: 'Open to internships & collaborations',
    headHint: 'say hi ↓',
    headDates: 'now →',
    nowLabel: 'now',
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
  it('a finished degree has no note; the labels are the ones passed in', () => {
    const log = gitLog({
      status: 's',
      headHint: 'h',
      headDates: 'd',
      nowLabel: 'ongoing',
      expectedLabel: '(est.)',
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
      ['2024-09 → 2026-06', '(est.)', false],
      ['2024-01 → ongoing', undefined, false],
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
    // Hyphenated names are placeholders too, so a typo like {first-name} can't print raw.
    expect(() => fillTemplate('Hi {first-name}', { first: 'x' })).toThrow(/\{first-name\}/);
  });
  it('allows spaces inside the braces', () => {
    expect(fillTemplate('built in { city }', { city: 'Seattle' })).toBe('built in Seattle');
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
    // The error names the copy.yaml key.
    expect(() => fillCopy({ footer: { tagline: 'built in {cty}' } }, { city: 'x' })).toThrow(
      /copy\.yaml footer\.tagline: .*\{cty\}/,
    );
  });
  it('keeps {from} and {to} only where they are filled later', () => {
    // hero.avgeek_route takes them; anywhere else each one is unknown, like any typo.
    expect(fillCopy({ hero: { avgeek_route: '{from} ⇄ {to}' } }, {})).toEqual({
      hero: { avgeek_route: '{from} ⇄ {to}' },
    });
    expect(() => fillCopy({ hero: { avgeek_badge: 'AvGeek ✈ {from}' } }, { city: 'x' })).toThrow(
      /copy\.yaml hero\.avgeek_badge: unknown or empty placeholder \{from\}/,
    );
    expect(() => fillCopy({ footer: { tagline: 'flown {to} SEA' } }, {})).toThrow(
      /copy\.yaml footer\.tagline: unknown or empty placeholder \{to\}/,
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
  it('treats emoji with presentation selectors and joiners as one symbol', () => {
    expect(glyphParts('say hi ✈️')).toEqual({ lead: '', text: 'say hi', trail: ' ✈️' });
    expect(glyphParts('👩‍💻 hire me')).toEqual({ lead: '👩‍💻 ', text: 'hire me', trail: '' });
  });
  it('never treats ASCII symbols as decoration', () => {
    expect(glyphParts('C++')).toEqual({ lead: '', text: 'C++', trail: '' });
    expect(glyphParts('cd ~')).toEqual({ lead: '', text: 'cd ~', trail: '' });
    expect(glyphParts('a <=> b')).toEqual({ lead: '', text: 'a <=> b', trail: '' });
  });
  it('stays fast on long runs of symbols', () => {
    const start = performance.now();
    expect(glyphParts(`${'★'.repeat(5000)} x`).text).toBe('x');
    expect(glyphParts(`x ${'★'.repeat(5000)}a`).trail).toBe('');
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('now.md lines', () => {
  // What Astro's Markdown pipeline (CommonMark + GFM + smartypants) renders for a now.md that
  // uses most of Markdown, captured from a real build of this site.
  const rendered = [
    "<!-- What you're doing right now -->",
    '<h1 id="now">Now</h1>',
    '<ul class="contains-task-list">',
    '<li>Shipping <a href="https://apps.apple.com/us/app/clock-stamp/id6800348277">Clock Stamp</a> <strong>1.2</strong></li>',
    '<li>Notes at <a href="https://zhic.me/notes">https://zhic.me/notes</a> and <a href="mailto:peter@example.com">peter@example.com</a></li>',
    '<li>Shipping <a href="https://apps.apple.com/us/app/clock-stamp/id6800348277">Clock Stamp</a> 1.2</li>',
    '<li><a href="https://en.wikipedia.org/wiki/Foo_(bar)">Foo</a> wiki</li>',
    '<li class="task-list-item"><input type="checkbox" checked disabled> Ship 1.2 task</li>',
    '<li>Teaching <code>**kwargs</code> in the INFO 180 Python labs</li>',
    '<li>Tom &amp; Jerry — “quotes” – dashes… it’s a &lt; b &amp; c</li>',
    '<li>Escaped *not em* and snake_case_name</li>',
    '<li>A line',
    'wrapped onto two</li>',
    '<li>Hard break<br>',
    'here</li>',
    '<li><img src="https://zhic.me/x.png" alt="logo"> image alt</li>',
    '<li>Nested parent',
    '<ul>',
    '<li>Nested child</li>',
    '</ul>',
    '</li>',
    '<li>Footnote ref<sup><a href="#user-content-fn-1" id="user-content-fnref-1" data-footnote-ref aria-describedby="footnote-label">1</a></sup></li>',
    '</ul>',
    '<blockquote>',
    '<p>Quote line</p>',
    '</blockquote>',
    '<p>Paragraph outside a list with <del>strike</del> and <em>em</em>.</p>',
    '<h1 id="setext-heading">Setext Heading</h1>',
    '<table>',
    '<thead>',
    '<tr>',
    '<th>a</th>',
    '<th>b</th>',
    '</tr>',
    '</thead>',
    '<tbody>',
    '<tr>',
    '<td>c</td>',
    '<td>d</td>',
    '</tr>',
    '</tbody>',
    '</table>',
    '<section data-footnotes class="footnotes"><h2 class="sr-only" id="footnote-label">Footnotes</h2>',
    '<ol>',
    '<li id="user-content-fn-1">',
    '<p>The footnote text. <a href="#user-content-fnref-1" data-footnote-backref="" aria-label="Back to reference 1" class="data-footnote-backref">↩</a></p>',
    '</li>',
    '</ol>',
    '</section>',
  ].join('\n');

  it('gives one plain line per list item or paragraph', () => {
    expect(nowLines(rendered)).toEqual([
      'Shipping Clock Stamp 1.2',
      'Notes at https://zhic.me/notes and peter@example.com',
      'Shipping Clock Stamp 1.2',
      'Foo wiki',
      'Ship 1.2 task',
      'Teaching **kwargs in the INFO 180 Python labs',
      'Tom & Jerry — “quotes” – dashes… it’s a < b & c',
      'Escaped *not em* and snake_case_name',
      'A line wrapped onto two',
      'Hard break here',
      'logo image alt',
      'Nested parent',
      'Nested child',
      'Footnote ref',
      'Quote line',
      'Paragraph outside a list with strike and em.',
      'a b',
      'c d',
    ]);
  });
  it('is empty for a file with only its comment', () => {
    expect(nowLines('<!-- one line per bullet -->\n')).toEqual([]);
    expect(nowLines('')).toEqual([]);
  });
  it('decodes character references with the full HTML table', () => {
    // Raw HTML in now.md passes through Markdown untouched, named references included.
    expect(
      nowLines(
        '<p>Reading <em>The Design of Everyday Things</em> &mdash; again&hellip;</p>\n<p>&#x26; &#38; &quot;x&quot; &apos;y&apos; a&nbsp;b caf&eacute; &copy; &unknown; &#0;</p>',
      ),
    ).toEqual([
      'Reading The Design of Everyday Things — again…',
      '& & "x" \'y\' a b café © &unknown; \ufffd',
    ]);
  });
  it('reads whole tags, even when attribute values hold "<" or ">"', () => {
    // Astro does not escape "<" in attribute values: an alt or a link title may contain one.
    const html = [
      '<ul>',
      '<li>Comparing <img src="https://zhic.me/ab.png" alt="Plan A<B chart"> results</li>',
      '<li>Shipping <a href="https://x.y" title="see <li> here">Clock Stamp</a> <strong>1.2</strong></li>',
      "<li><span title='1 > 0'>more</span> <img alt='a > b' src=\"x.png\"></li>",
      '</ul>',
    ].join('\n');
    expect(nowLines(html)).toEqual([
      'Comparing Plan A<B chart results',
      'Shipping Clock Stamp 1.2',
      'more a > b',
    ]);
  });
  it('gives a local image its alt text from Astro’s image marker', () => {
    const marker =
      '{&quot;src&quot;:&quot;./now-pic.png&quot;,&quot;alt&quot;:&quot;Orbit &amp; ring&quot;,&quot;index&quot;:0}';
    expect(
      nowLines(`<ul>\n<li>LI1 local <img __ASTRO_IMAGE_="${marker}"> image</li>\n</ul>`),
    ).toEqual(['LI1 local Orbit & ring image']);
    // A broken marker or no alt at all just leaves the image out.
    expect(nowLines('<p>a <img __ASTRO_IMAGE_="{oops"> b <img src="x.png"> c</p>')).toEqual([
      'a b c',
    ]);
    expect(nowLines('<p>a <img __ASTRO_IMAGE_="{&quot;src&quot;:&quot;x&quot;}"> b</p>')).toEqual([
      'a b',
    ]);
  });
  it('keeps a list item whose content is a heading, drops other headings and scripts', () => {
    const html = [
      '<h2 id="now">Now</h2>',
      '<ul>',
      '<li>',
      '<h2 id="q12-heading-in-item">Q12 heading in item</h2>',
      '</li>',
      '<li>Plain <script>if (a<b) { alert("</p>") }</script>item</li>',
      '</ul>',
      '<style>p { color: red }</style>',
      '<template><p>hidden</p></template>',
    ].join('\n');
    expect(nowLines(html)).toEqual(['Q12 heading in item', 'Plain item']);
  });
  it('leaves out only the tag when a dropped element is never closed', () => {
    // A status line that mentions a raw tag ("Fixing <style> leaks") must not hide the rest.
    const html = [
      '<ul>',
      '<li>C01 Fixing <style> leaks in Astro</li>',
      '<li>C02 Teaching the <script> tag</li>',
      '<li>C03 Reading about <template> elements</li>',
      '</ul>',
      '<p>C04 Teaching <h1> to <h6> today</p>',
      '<ul>',
      '<li>C05 last bullet</li>',
      '</ul>',
    ].join('\n');
    expect(nowLines(html)).toEqual([
      'C01 Fixing leaks in Astro',
      'C02 Teaching the tag',
      'C03 Reading about elements',
      'C04 Teaching to today',
      'C05 last bullet',
    ]);
  });
  it('reads attribute names only outside other attributes’ values', () => {
    const marker =
      '{&quot;src&quot;:&quot;./now-pic.jpg&quot;,&quot;alt&quot;:&quot;Orbit&quot;,&quot;title&quot;:&quot;old alt=new&quot;}';
    expect(
      nowLines(
        `<p>A06 local title <img __ASTRO_IMAGE_="${marker}"> end</p>\n<p>Read <a href="https://x.y" title="why data-footnote-ref matters">the guide</a> today</p>`,
      ),
    ).toEqual(['A06 local title Orbit end', 'Read the guide today']);
  });
  it('decodes text and attribute values exactly once', () => {
    // A code span showing `&lt;b&gt;` renders as `&amp;lt;b&amp;gt;`: the reader sees "&lt;b&gt;".
    const html =
      '<p><code>&amp;lt;b&amp;gt;</code> <img alt="&amp;amp; &amp;lt;"> <img __ASTRO_IMAGE_="{&quot;alt&quot;:&quot;&amp;lt;&quot;}"> &amp;lt;</p>';
    expect(nowLines(html)).toEqual(['&lt;b&gt; &amp; &lt; &lt; &lt;']);
  });
  it('treats <!--> and <!---> as empty comments', () => {
    expect(
      nowLines('<ul>\n<li>D01 one <!--> two</li>\n<li>D02 three <!---> four</li>\n</ul>'),
    ).toEqual(['D01 one two', 'D02 three four']);
  });
  it('stays fast on stray unterminated tags in raw HTML', () => {
    const start = performance.now();
    nowLines(`<p>${'<abc '.repeat(20_000)}</p>`);
    nowLines(`<div>${'x <longtagname '.repeat(5_000)}`);
    expect(performance.now() - start).toBeLessThan(2000);
  });
  it('treats a heading tag mentioned in text as text, not as the start of a heading', () => {
    // "Rewriting the site's <h2> styles" followed later by a real "## Later" heading.
    const html = [
      '<p>Rewriting the site’s <h2> styles</p>',
      '<ul>',
      '<li>C01 Shipping Clock Stamp 1.2</li>',
      '<li>C02 TA for INFO 180</li>',
      '</ul>',
      '<h2 id="later">Later</h2>',
      '<ul>',
      '<li>C03 Trip to Tokyo</li>',
      '</ul>',
    ].join('\n');
    expect(nowLines(html)).toEqual([
      'Rewriting the site’s styles',
      'C01 Shipping Clock Stamp 1.2',
      'C02 TA for INFO 180',
      'C03 Trip to Tokyo',
    ]);
  });
  it('a mentioned <li> does not turn later headings into ticker lines', () => {
    const html = [
      '<ul>',
      '<li>C01 Learning <li> semantics</li>',
      '<li>C02 Shipping Clock Stamp 1.2</li>',
      '</ul>',
      '<h2 id="notes">Notes</h2>',
      '<ul>',
      '<li>C03 Trip to Tokyo</li>',
      '</ul>',
    ].join('\n');
    expect(nowLines(html)).not.toContain('Notes');
    expect(nowLines(html)).toContain('C03 Trip to Tokyo');
  });
});

describe('About grid areas', () => {
  /** Problems with a grid-template-areas value: ragged rows, empty cells, non-rectangles. */
  function gridProblems(rows: string[]): string[] {
    const cells = rows.map((r) => r.split(/\s+/));
    const problems: string[] = [];
    if (new Set(cells.map((r) => r.length)).size !== 1) problems.push('rows differ in length');
    for (const name of new Set(cells.flat())) {
      if (name === '.') problems.push('empty cell');
      const at = cells.flatMap((r, y) => r.flatMap((n, x) => (n === name ? [[x, y]] : [])));
      const xs = at.map(([x]) => x!);
      const ys = at.map(([, y]) => y!);
      const w = Math.max(...xs) - Math.min(...xs) + 1;
      const h = Math.max(...ys) - Math.min(...ys) + 1;
      if (w * h !== at.length) problems.push(`${name} is not a rectangle`);
    }
    return problems;
  }

  for (const off of [true, false])
    for (const av of [true, false])
      it(`places every card with no holes (off-the-clock ${off}, AvGeek ${av})`, () => {
        const areas = aboutAreas({ off, av });
        const cards = [
          'who',
          'stack',
          'edu',
          'skills',
          ...(off ? ['off'] : []),
          ...(av ? ['av'] : []),
        ];
        for (const [layout, rows] of Object.entries(areas)) {
          expect(gridProblems(rows), layout).toEqual([]);
          expect(new Set(rows.join(' ').split(/\s+/)), layout).toEqual(new Set(cards));
        }
        expect(areas.lg[0]!.split(' ')).toHaveLength(3);
        expect(areas.md[0]!.split(' ')).toHaveLength(2);
        expect(areas.sm[0]!.split(' ')).toHaveLength(1);
      });

  it('writes the CSS value', () => {
    expect(gridAreas(['who who', 'edu av'])).toBe("'who who' 'edu av'");
  });
});

describe('About cards', () => {
  const choir = { name: 'Choir', tag: 'choir', icon: 'note' };
  const pingPong = { name: 'Table tennis', tag: 'table-tennis', icon: 'paddle' };
  const flying = { name: 'Aviation', tag: 'aviation' };
  const coding = { name: 'Vibe coding', tag: 'vibe-coding' };
  const noLists = { id: 'aviation', watching: [], seat_rules: [], tools: [] };
  const someLists = { ...noLists, tools: [{ name: 'ExpertFlyer', url: 'https://x.y' }] };

  it('shows each interest exactly once, on whichever card has room for it', () => {
    const all = aboutCards({
      interests: [choir, flying, coding, pingPong],
      aviation: someLists,
      building: true,
    });
    expect(all.offClock).toEqual([choir, pingPong]);
    expect(all.avgeek).toBe(true);
    expect(all.aviationInterest).toBe(flying);
    expect(all.others).toEqual([coding]);
    expect(all.stackOne).toBe(false);
    expect(all.areas).toEqual(aboutAreas({ off: true, av: true }));
    // No aviation lists: no AvGeek card, so the aviation interest goes to the whoami card.
    const bare = aboutCards({ interests: [flying, coding], aviation: noLists, building: false });
    expect(bare).toMatchObject({ avgeek: false, offClock: [], others: [flying, coding] });
    expect(bare.stackOne).toBe(true);
    expect(bare.areas).toEqual(aboutAreas({ off: false, av: false }));
  });
  it('counts any list in aviation.yaml, and nothing else', () => {
    const card = (aviation: Record<string, unknown>) =>
      aboutCards({ interests: [], aviation, building: true }).avgeek;
    expect(card({ id: 'aviation', news: [{ headline: 'x' }] })).toBe(true);
    expect(card({ id: 'aviation', future_list: ['x'] })).toBe(true);
    expect(card({ id: 'aviation', note: 'not a list', watching: [] })).toBe(false);
    expect(card({})).toBe(false);
  });
});
