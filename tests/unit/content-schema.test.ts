import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { parse } from 'yaml';
import { describe, expect, it, vi } from 'vitest';
import { assertCommentsClosed, stripComments } from '../../src/content/guards';
import { list, parseYaml, singleton } from '../../src/content/parsers';
import { copyVars, fillCopy } from '../../src/lib/derive';
import {
  aviationSchema,
  copySchema,
  educationSchema,
  experienceSchema,
  honorSchema,
  interestsSchema,
  profileSchema,
  projectSchema,
  siteSchema,
  skillsSchema,
} from '../../src/content/schema';

const CONTENT = join(import.meta.dirname, '../../content');
const read = (name: string) => readFileSync(join(CONTENT, name), 'utf8');
/** Stand-in for Astro's image(): a relative path that must exist under content/. */
const image = () =>
  z.string().refine((p) => {
    try {
      readFileSync(join(CONTENT, p));
      return true;
    } catch {
      return false;
    }
  }, 'image file not found');

function frontmatter(md: string): unknown {
  const match = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!match) throw new Error('missing frontmatter');
  return parse(match[1]!);
}

describe('real content/ files validate against their schemas', () => {
  it('site.yaml', () => {
    expect(() => siteSchema.parse(singleton('site')(read('site.yaml'))[0])).not.toThrow();
  });
  it('profile.yaml', () => {
    expect(() =>
      profileSchema(image).parse(singleton('profile')(read('profile.yaml'))[0]),
    ).not.toThrow();
  });
  it('education.yaml', () => {
    for (const e of list('education.yaml')(read('education.yaml'))) educationSchema.parse(e);
  });
  it('experience.yaml', () => {
    for (const e of list('experience.yaml')(read('experience.yaml')))
      experienceSchema(image).parse(e);
  });
  it('honors.yaml', () => {
    for (const e of list('honors.yaml')(read('honors.yaml'))) honorSchema.parse(e);
  });
  it('interests.yaml', () => {
    interestsSchema.parse(singleton('interests')(read('interests.yaml'))[0]);
  });
  it('skills.yaml', () => {
    skillsSchema.parse(singleton('skills')(read('skills.yaml'))[0]);
  });
  it('aviation.yaml', () => {
    aviationSchema.parse(singleton('aviation')(read('aviation.yaml'))[0]);
  });
  it('copy.yaml', () => {
    expect(() => copySchema.parse(singleton('copy')(read('copy.yaml'))[0])).not.toThrow();
  });
  it('projects/*.md', () => {
    const files = readdirSync(join(CONTENT, 'projects')).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) projectSchema(image).parse(frontmatter(read(`projects/${f}`)));
  });
});

describe('schemas reject mistakes an owner could make', () => {
  const validHonor = { name: 'X', org: 'Y', year: '2024-2025', source: 's' };

  it('unknown (misspelled) fields fail', () => {
    expect(() => honorSchema.parse({ ...validHonor, yeer: '2025' })).toThrow();
  });
  it('a numeric year is accepted and normalised to a string', () => {
    expect(honorSchema.parse({ ...validHonor, year: 2025 }).year).toBe('2025');
  });
  it('bad year format fails', () => {
    expect(() => honorSchema.parse({ ...validHonor, year: '24-25' })).toThrow();
  });
  it('verifiable facts require a source', () => {
    const { source: _source, ...noSource } = validHonor;
    expect(() => honorSchema.parse(noSource)).toThrow();
  });

  const validJob = {
    company: 'C',
    role: 'R',
    start: '2024-07',
    end: '2024-09',
    location: 'L',
    highlights: ['h'],
    source: 's',
  };
  it('experience dates must be YYYY-MM', () => {
    expect(() => experienceSchema(image).parse({ ...validJob, start: 'July 2024' })).toThrow();
    expect(() => experienceSchema(image).parse({ ...validJob, start: '2024-13' })).toThrow();
  });
  it('experience end may be "present" but not before start', () => {
    expect(() => experienceSchema(image).parse({ ...validJob, end: 'present' })).not.toThrow();
    expect(() => experienceSchema(image).parse({ ...validJob, end: '2024-01' })).toThrow();
  });
  it('experience needs at least one highlight', () => {
    expect(() => experienceSchema(image).parse({ ...validJob, highlights: [] })).toThrow();
  });
  it('a logo is decorative, so alt text is optional', () => {
    expect(() =>
      experienceSchema(image).parse({ ...validJob, logo: './images/hashkey.webp' }),
    ).not.toThrow();
  });

  const validProfile = singleton('profile')(read('profile.yaml'))[0] as Record<string, unknown>;
  it('exactly one primary email', () => {
    const emails = [
      { address: 'a@x.edu', primary: true, public: true },
      { address: 'b@x.com', primary: true, public: true },
    ];
    expect(() => profileSchema(image).parse({ ...validProfile, emails })).toThrow(/primary/);
  });
  it('the primary email must be public', () => {
    const emails = [{ address: 'a@x.edu', primary: true, public: false }];
    expect(() => profileSchema(image).parse({ ...validProfile, emails })).toThrow(/public/);
  });
  it('a missing avatar file fails', () => {
    expect(() =>
      profileSchema(image).parse({ ...validProfile, avatar: './images/nope.jpg' }),
    ).toThrow();
  });

  it('project tagline is capped at 120 chars and status is an enum', () => {
    const p = {
      title: 't',
      tagline: 'x',
      status: 'wip',
      platform: ['ios'],
      year: 2026,
      source: 's',
    };
    expect(() => projectSchema(image).parse(p)).not.toThrow();
    expect(() => projectSchema(image).parse({ ...p, tagline: 'x'.repeat(121) })).toThrow();
    expect(() => projectSchema(image).parse({ ...p, status: 'done' })).toThrow();
  });

  it('aviation: IATA codes, ISO dates, max 6 watched routes', () => {
    const route = { from: 'SEA', to: 'NRT', airline: 'A', aircraft: '787-9', why: 'w' };
    expect(() => aviationSchema.parse({ watching: [route] })).not.toThrow();
    expect(() => aviationSchema.parse({ watching: [{ ...route, from: 'sea' }] })).toThrow();
    expect(() => aviationSchema.parse({ watching: Array(7).fill(route) })).toThrow();
    const news = { date: '2026-11-01', headline: 'h', url: 'https://example.com/' };
    expect(() => aviationSchema.parse({ news: [news] })).not.toThrow();
    expect(() => aviationSchema.parse({ news: [{ ...news, date: '11/01/2026' }] })).toThrow();
  });

  it('aviation: numeric aircraft are accepted, news is not capped in the file', () => {
    const route = { from: 'SEA', to: 'NRT', airline: 'A', aircraft: 787, why: 'w' };
    expect(aviationSchema.parse({ watching: [route] }).watching[0]?.aircraft).toBe('787');
    const news = { date: '2026-11-01', headline: 'h', url: 'https://example.com/' };
    expect(() => aviationSchema.parse({ news: Array(8).fill(news) })).not.toThrow();
  });

  it('project role, dates and extra links', () => {
    const p = {
      title: 't',
      tagline: 'x',
      status: 'completed',
      platform: ['research'],
      year: 2025,
      source: 's',
    };
    const ok = { ...p, role: 'Group Leader', start: '2025-09', end: '2025-12' };
    expect(() => projectSchema(image).parse(ok)).not.toThrow();
    expect(() => projectSchema(image).parse({ ...ok, end: 'present' })).not.toThrow();
    expect(() => projectSchema(image).parse({ ...ok, end: '2025-01' })).toThrow(/start/);
    expect(() => projectSchema(image).parse({ ...p, end: '2025-12' })).toThrow(/needs a `start`/);
    expect(() => projectSchema(image).parse({ ...p, start: '2025-09' })).toThrow(/needs an `end`/);
    const links = { other: [{ label: 'Lab', url: 'https://example.edu/lab/' }] };
    expect(projectSchema(image).parse({ ...p, links }).links?.other).toHaveLength(1);
    expect(() =>
      projectSchema(image).parse({
        ...p,
        links: { other: [{ label: 'Lab', url: 'example.edu' }] },
      }),
    ).toThrow();
  });

  it('education GPA label is optional (the page uses copy.yaml); tagline and location too', () => {
    const edu = list('education.yaml')(read('education.yaml'))[0] as Record<string, unknown>;
    const { gpa_label: _label, ...rest } = edu;
    // No built-in English default: page-data.ts fills it from copy.yaml labels.gpa.
    expect(educationSchema.parse(rest).gpa_label).toBeUndefined();
    const p = { title: 't', status: 'wip', platform: ['web'], year: 2026, source: 's' };
    expect(projectSchema(image).parse({ ...p, location: 'Seattle, WA' }).tagline).toBeUndefined();
  });

  it('skills need at least one group with items; numbers become text', () => {
    expect(() => skillsSchema.parse({ groups: [], source: 's' })).toThrow();
    expect(() => skillsSchema.parse({ groups: [{ name: 'X', items: [] }], source: 's' })).toThrow();
    const parsed = skillsSchema.parse({ groups: [{ name: 'Excel', items: [2016] }], source: 's' });
    expect(parsed.groups[0]?.items).toEqual(['2016']);
  });

  it('project cover needs alt text; icon is decorative', () => {
    const p = {
      title: 't',
      tagline: 'x',
      status: 'wip',
      platform: ['web'],
      year: 2026,
      source: 's',
    };
    expect(() => projectSchema(image).parse({ ...p, icon: './images/hashkey.webp' })).not.toThrow();
    expect(() => projectSchema(image).parse({ ...p, cover: './images/hashkey.webp' })).toThrow(
      /cover_alt/,
    );
  });

  it('copy: the phone clock needs a real IANA time zone', () => {
    const copy = copySchema.parse(singleton('copy')(read('copy.yaml'))[0]);
    const withZone = (time_zone: string) => ({
      ...copy,
      projects: { ...copy.projects, phone: { ...copy.projects.phone, time_zone } },
    });
    expect(() => copySchema.parse(withZone('Asia/Shanghai'))).not.toThrow();
    expect(() => copySchema.parse(withZone('Seattle'))).toThrow(/IANA/);
  });
  it('copy: every project status has exactly one label', () => {
    const copy = copySchema.parse(singleton('copy')(read('copy.yaml'))[0]);
    const withStatus = (status: Record<string, string>) => ({
      ...copy,
      labels: { ...copy.labels, status },
    });
    const { wip: _wip, ...missing } = copy.labels.status;
    expect(() => copySchema.parse(withStatus(missing))).toThrow();
    expect(() => copySchema.parse(withStatus({ ...copy.labels.status, beta: 'beta' }))).toThrow();
    expect(() => copySchema.parse(withStatus({ ...copy.labels.status, wip: ' ' }))).toThrow();
  });
  it('copy: every {placeholder} in copy.yaml is one the page can fill', () => {
    const copy = copySchema.parse(singleton('copy')(read('copy.yaml'))[0]);
    const vars = copyVars({
      displayName: 'A B',
      location: 'C, D',
      domain: 'e.f',
      email: 'g@h.i',
      edu: {
        school: 'S',
        degree: 'D',
        start: '2020-09',
        end: '2024-06',
        expected: false,
        gpa_label: 'GPA',
        honors: [],
      },
    });
    expect(() => fillCopy(copy, vars)).not.toThrow();
  });
  it('site: domain must be a bare hostname', () => {
    const site = singleton('site')(read('site.yaml'))[0] as Record<string, unknown>;
    expect(() => siteSchema.parse({ ...site, domain: 'https://zhic.me' })).toThrow(/Hostname/);
    expect(() => siteSchema.parse({ ...site, domain: 'zhic.me/' })).toThrow();
  });

  it('site: semver version and boolean launched', () => {
    const site = singleton('site')(read('site.yaml'))[0] as Record<string, unknown>;
    expect(() => siteSchema.parse({ ...site, version: '1.0' })).toThrow();
    expect(() => siteSchema.parse({ ...site, launched: 'yes' })).toThrow();
  });
});

describe('YAML parsing guards', () => {
  it('rejects a value cut off by an unquoted " #"', () => {
    expect(() => parseYaml('why: the #1 seat on the A350\n')).toThrow(/cut off at "#"/);
    expect(() => parseYaml('items:\n  - name: row #12\n')).toThrow(/quotes/);
  });
  it('allows real trailing comments and quoted hashes', () => {
    expect(parseYaml('version: 0.1.0 # bump for structural changes\n')).toEqual({
      version: '0.1.0',
    });
    expect(parseYaml('why: "the #1 seat"\n')).toEqual({ why: 'the #1 seat' });
  });
  it('rejects YAML syntax errors instead of guessing', () => {
    expect(() => parseYaml('a: [1, 2\n')).toThrow();
    expect(() => parseYaml('a: 1\na: 2\n')).toThrow();
  });
  it('prints the file name and reason before failing (Astro hides thrown errors)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => singleton('profile')('name: [oops')).toThrow();
    expect(spy.mock.calls[0]?.[0]).toMatch(/^✖ content\/profile\.yaml: /);
    spy.mockRestore();
  });
  it('unclosed HTML comments in Markdown fail the build', () => {
    expect(() => assertCommentsClosed('a <!-- b', 'content/now.md')).toThrow(/never closed/);
    expect(() => assertCommentsClosed('<!-- a --> b <!-- c -->', 'x')).not.toThrow();
    expect(() => assertCommentsClosed(undefined, 'x')).not.toThrow();
    // `<!-->` and `<!--->` are complete (empty) comments in Markdown and HTML.
    expect(() => assertCommentsClosed('one <!--> two <!---> three', 'x')).not.toThrow();
    expect(() => assertCommentsClosed('a <!--> b <!-- c', 'x')).toThrow(/never closed/);
    expect(stripComments('a<!-- x -->b<!-->c<!--->d')).toBe('abcd');
    // Removing a comment must not join the text around it into a new "<!--".
    expect(() => assertCommentsClosed('a <!-<!-- x -->- b', 'x')).not.toThrow();
    expect(() => assertCommentsClosed('<!<!---->--', 'x')).not.toThrow();
  });
});

describe('YAML parsers', () => {
  it('singleton injects a fixed id', () => {
    expect(singleton('x')('a: 1')).toEqual([{ a: 1, id: 'x' }]);
  });
  it('singleton rejects a list', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => singleton('x')('- a: 1')).toThrow(/key: value/);
    vi.restoreAllMocks();
  });
  it('list numbers entries in order and keeps explicit ids', () => {
    expect(list('f')('- a: 1\n- id: custom\n  a: 2')).toEqual([
      { a: 1, id: '1' },
      { a: 2, id: 'custom' },
    ]);
  });
  it('list rejects a mapping and scalar items', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => list('f')('a: 1')).toThrow(/list/);
    expect(() => list('f')('- just text')).toThrow(/key: value/);
    vi.restoreAllMocks();
  });
  it('YAML dates and year-months stay strings (YAML 1.2 core schema)', () => {
    expect(singleton('x')('d: 2026-11-01\nm: 2024-07')).toEqual([
      { d: '2026-11-01', m: '2024-07', id: 'x' },
    ]);
  });
});
