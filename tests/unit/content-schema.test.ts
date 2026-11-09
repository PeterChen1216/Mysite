import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { list, singleton } from '../../src/content/parsers';
import {
  aviationSchema,
  educationSchema,
  experienceSchema,
  honorSchema,
  interestsSchema,
  profileSchema,
  projectSchema,
  siteSchema,
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
  it('aviation.yaml', () => {
    aviationSchema.parse(singleton('aviation')(read('aviation.yaml'))[0]);
  });
  it('projects/*.md', () => {
    const files = readdirSync(join(CONTENT, 'projects')).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) projectSchema.parse(frontmatter(read(`projects/${f}`)));
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
  it('logo requires alt text', () => {
    expect(() =>
      experienceSchema(image).parse({ ...validJob, logo: './images/hashkey.webp' }),
    ).toThrow();
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
    expect(() => projectSchema.parse(p)).not.toThrow();
    expect(() => projectSchema.parse({ ...p, tagline: 'x'.repeat(121) })).toThrow();
    expect(() => projectSchema.parse({ ...p, status: 'done' })).toThrow();
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

  it('site: semver version and boolean launched', () => {
    const site = singleton('site')(read('site.yaml'))[0] as Record<string, unknown>;
    expect(() => siteSchema.parse({ ...site, version: '1.0' })).toThrow();
    expect(() => siteSchema.parse({ ...site, launched: 'yes' })).toThrow();
  });
});

describe('YAML parsers', () => {
  it('singleton injects a fixed id', () => {
    expect(singleton('x')('a: 1')).toEqual([{ a: 1, id: 'x' }]);
  });
  it('singleton rejects a list', () => {
    expect(() => singleton('x')('- a: 1')).toThrow(/mapping/);
  });
  it('list numbers entries in order and keeps explicit ids', () => {
    expect(list('f')('- a: 1\n- id: custom\n  a: 2')).toEqual([
      { a: 1, id: '1' },
      { a: 2, id: 'custom' },
    ]);
  });
  it('list rejects a mapping and scalar items', () => {
    expect(() => list('f')('a: 1')).toThrow(/list/);
    expect(() => list('f')('- just text')).toThrow(/mapping/);
  });
  it('YAML dates and year-months stay strings (YAML 1.2 core schema)', () => {
    expect(singleton('x')('d: 2026-11-01\nm: 2024-07')).toEqual([
      { d: '2026-11-01', m: '2024-07', id: 'x' },
    ]);
  });
});
