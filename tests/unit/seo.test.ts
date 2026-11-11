// M5 SEO (PLAN §11): the Person JSON-LD from content/, its local schema.org check, the sitemap
// and robots.txt per stage (src/lib/seo.ts, src/lib/schema-org.ts).
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { isA, schemaProblems } from '../../src/lib/schema-org';
import {
  headIndexing,
  jsonLdText,
  movedPage,
  personJsonLd,
  robotsTxt,
  sitemapUrls,
  sitemapXml,
  type PersonFacts,
} from '../../src/lib/seo';

const facts: PersonFacts = {
  name: 'Ada Example',
  fullName: 'Ada B. Example',
  url: 'https://example.com/',
  sameAs: ['https://github.com/example', 'https://www.linkedin.com/in/example/'],
  schools: [
    { name: 'Example University', url: 'https://www.example.edu/', current: true },
    { name: 'Example High School', current: false },
  ],
};

describe('the Person JSON-LD', () => {
  it('states the names, the home, the profiles and the schools — nothing else', () => {
    expect(personJsonLd(facts)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Ada Example',
      alternateName: 'Ada B. Example',
      url: 'https://example.com/',
      sameAs: ['https://github.com/example', 'https://www.linkedin.com/in/example/'],
      affiliation: {
        '@type': 'CollegeOrUniversity',
        name: 'Example University',
        url: 'https://www.example.edu/',
      },
      alumniOf: { '@type': 'CollegeOrUniversity', name: 'Example High School' },
    });
  });
  it('leaves out what content does not give', () => {
    const bare = personJsonLd({ ...facts, fullName: facts.name, sameAs: [], schools: [] });
    expect(bare).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Ada Example',
      url: 'https://example.com/',
    });
    const two = personJsonLd({
      ...facts,
      schools: [
        { name: 'A', current: true },
        { name: 'B', current: true },
      ],
    });
    expect(two.affiliation).toHaveLength(2);
  });
  it('is valid schema.org, checked here (no online validator)', () => {
    expect(schemaProblems(personJsonLd(facts))).toEqual([]);
    expect(schemaProblems(personJsonLd({ ...facts, schools: [], sameAs: [] }))).toEqual([]);
  });
  it('from the real content: the profile, the socials and the school being attended', () => {
    const profile = parse(readFileSync('content/profile.yaml', 'utf8'));
    const education = parse(readFileSync('content/education.yaml', 'utf8')) as Array<{
      school: string;
      url?: string;
      expected?: boolean;
    }>;
    const data = personJsonLd({
      name: profile.name.display,
      fullName: profile.name.full,
      url: 'https://zhic.me/',
      sameAs: profile.socials.map((s: { url: string }) => s.url),
      schools: education.map((e) => ({ name: e.school, url: e.url, current: !!e.expected })),
    });
    expect(schemaProblems(data)).toEqual([]);
    expect(data.name).toBe(profile.name.display);
    expect(data.sameAs).toEqual(profile.socials.map((s: { url: string }) => s.url));
  });
  it('is written so no value can end the script element', () => {
    const text = jsonLdText({ name: '</script><!-- & -->' });
    expect(text).not.toMatch(/[<>&]/);
    expect(JSON.parse(text)).toEqual({ name: '</script><!-- & -->' });
  });
});

describe('the local schema.org check', () => {
  const ok = { '@context': 'https://schema.org', '@type': 'Person', name: 'A' };
  it('knows the type tree', () => {
    expect(isA('CollegeOrUniversity', 'Organization')).toBe(true);
    expect(isA('Person', 'Organization')).toBe(false);
    expect(isA('ProfilePage', 'CreativeWork')).toBe(true);
  });
  it.each([
    [{ ...ok, '@context': 'http://schema.org/' }, '$: @context must be "https://schema.org"'],
    [{ ...ok, '@type': 'Persn' }, '$: unknown @type "Persn"'],
    [
      { ...ok, sameas: 'https://a.example/' },
      '$.sameas: not a schema.org property this check knows',
    ],
    [
      { ...ok, department: { '@type': 'Organization', name: 'D' } },
      '$.department: not a property of Person',
    ],
    [{ ...ok, url: 'zhic.me' }, '$.url: expected URL, got "zhic.me"'],
    [
      { ...ok, sameAs: ['https://a.example/', 'ftp://b'] },
      '$.sameAs[1]: expected URL, got "ftp://b"',
    ],
    [{ ...ok, name: ' ' }, '$.name: expected Text, got " "'],
    [{ ...ok, sameAs: [] }, '$.sameAs: empty list'],
    [{ ...ok, affiliation: 'UW' }, '$.affiliation: expected Organization, got "UW"'],
    [
      { ...ok, affiliation: { '@type': 'Person', name: 'B' } },
      '$.affiliation: a Person where Organization is expected',
    ],
    [
      {
        ...ok,
        affiliation: { '@context': 'https://schema.org', '@type': 'Organization', name: 'B' },
      },
      '$.affiliation: @context belongs on the top object only',
    ],
    [{ ...ok, affiliation: { name: 'B' } }, '$.affiliation: unknown @type undefined'],
    [[ok], '$: expected an object with an @type'],
  ])('finds %j', (data, problem) => {
    expect(schemaProblems(data)).toContain(problem);
  });
});

describe('the sitemap', () => {
  const page = (path: string, head: string) => ({
    path,
    html: `<html><head>${head}</head></html>`,
  });
  const pages = [
    page('index.html', '<link rel="canonical" href="https://zhic.me/">'),
    page('projects/index.html', '<link rel="canonical" href="https://zhic.me/projects/">'),
    page(
      'zh-hans/index.html',
      '<meta name="robots" content="noindex"><link rel="canonical" href="https://zhic.me/zh-hans/">',
    ),
    page('404.html', '<meta name="robots" content="noindex">'),
    page('copy/index.html', '<link href="https://zhic.me/" rel="canonical">'),
    page('elsewhere/index.html', '<link rel="canonical" href="https://other.example/">'),
  ];
  it('lists each indexable page once, at its canonical address', () => {
    expect(sitemapUrls(pages, 'https://zhic.me')).toEqual([
      'https://zhic.me/',
      'https://zhic.me/projects/',
    ]);
  });
  it('reads robots and canonical from the head only', () => {
    expect(headIndexing('<head><meta name="googlebot" content="none"></head>')).toEqual({
      canonical: null,
      noindex: true,
    });
    expect(
      headIndexing('<head></head><body><meta name="robots" content="noindex"></body>').noindex,
    ).toBe(false);
  });
  it('is sitemaps.org XML', () => {
    expect(sitemapXml(['https://zhic.me/', 'https://zhic.me/a?b=1&c=2'])).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <url><loc>https://zhic.me/</loc></url>\n' +
        '  <url><loc>https://zhic.me/a?b=1&amp;c=2</loc></url>\n' +
        '</urlset>\n',
    );
  });
});

describe('robots.txt', () => {
  it('before launch: the preview is closed, no sitemap is named', () => {
    expect(robotsTxt('preview', 'https://zhic.me')).toBe('User-agent: *\nDisallow: /v2/\n');
  });
  it('after launch: the old site is closed, the sitemap is named', () => {
    expect(robotsTxt('launched', 'https://zhic.me')).toBe(
      'User-agent: *\nDisallow: /legacy/\n\nSitemap: https://zhic.me/sitemap.xml\n',
    );
  });
});

describe('after launch, a preview address leads to the page at the root', () => {
  it('is a noindex page with the new address as canonical, a refresh and a link', () => {
    const html = movedPage('/projects/clock-stamp/', 'https://zhic.me', 'zhic.me');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('<link rel="canonical" href="https://zhic.me/projects/clock-stamp/">');
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=/projects/clock-stamp/">');
    expect(html).toContain(
      '<a href="/projects/clock-stamp/">https://zhic.me/projects/clock-stamp/</a>',
    );
    expect(html).not.toMatch(/<script/i);
    expect(headIndexing(html)).toEqual({
      canonical: 'https://zhic.me/projects/clock-stamp/',
      noindex: true,
    });
  });
});
