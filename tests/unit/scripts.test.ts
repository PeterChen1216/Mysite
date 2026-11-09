import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findBreakage, findPlaceholders, isStrict } from '../../scripts/check-content.mjs';
import { loadSiteConfig } from '../../site.config.mjs';

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  for (const [name, body] of Object.entries(files)) {
    const full = join(dir, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

describe('content guard', () => {
  it('flags TODO:, lorem and placeholder text with file:line', () => {
    const dir = fixture({
      'a.yaml': 'ok: 1\nname: "TODO: fill in"\n',
      'projects/p.md': 'Lorem ipsum\n',
      'b.yaml': 'x: placeholder\n',
    });
    const hits = findPlaceholders(dir).sort();
    expect(hits).toHaveLength(3);
    expect(hits[0]).toMatch(/^content\/a\.yaml:2:/);
  });
  it('ignores README.md and the artifacts/ drop folder', () => {
    const dir = fixture({
      'README.md': 'TODO: rules',
      'artifacts/notes.md': 'TODO: later',
      'ok.yaml': 'a: 1',
    });
    expect(findPlaceholders(dir)).toEqual([]);
  });
  it('matches TODO in any form, but not ordinary words', () => {
    const dir = fixture({
      'a.yaml': 'a: "TODO：x"\nb: x # TODO\nc: TODO\nd: My Todo app\ne: todos are fine\n',
    });
    expect(findPlaceholders(dir).map((h: string) => h.split(':')[1])).toEqual(['1', '2', '3']);
  });
  it('the real content/ folder has no breakage (placeholders are branch-dependent)', () => {
    expect(findBreakage(join(import.meta.dirname, '../../content'))).toEqual([]);
  });
  it.runIf(isStrict())('the real content/ folder has no placeholders (main only)', () => {
    expect(findPlaceholders(join(import.meta.dirname, '../../content'))).toEqual([]);
  });
});

describe('content breakage (always an error)', () => {
  it('flags an unclosed HTML comment in Markdown with its line', () => {
    const dir = fixture({ 'now.md': 'line one\n<!-- note\nrest of page\n', 'ok.md': '<!-- a -->' });
    expect(findBreakage(dir)).toEqual(['content/now.md:2: "<!--" is never closed with "-->"']);
    // `<!-->` and `<!--->` are complete, empty comments; an open one after them is still found.
    const empty = fixture({ 'now.md': 'a <!--> b\n<!---> c\nnext <!-- open\n' });
    expect(findBreakage(empty)).toEqual(['content/now.md:3: "<!--" is never closed with "-->"']);
    expect(findBreakage(fixture({ 'now.md': 'a <!--> b <!---> c\n' }))).toEqual([]);
    // Each on its own, with no later "-->" that could close a comment read the old way.
    expect(findBreakage(fixture({ 'now.md': 'a <!--> b\n', 'b.md': 'c <!---> d\n' }))).toEqual([]);
  });
  it('flags project files that are not lowercase-hyphen slugs', () => {
    const dir = fixture({
      'projects/clock-stamp.md': 'x',
      'projects/Clock Stamp.md': 'x',
      'projects/notes.txt': 'x',
    });
    const problems = findBreakage(dir);
    expect(problems).toHaveLength(2);
    expect(problems.join('\n')).toMatch(/Clock Stamp\.md/);
  });
  it('is strict on main and PRs into main only', () => {
    expect(isStrict({ GITHUB_REF: 'refs/heads/main' }, [])).toBe(true);
    expect(isStrict({ GITHUB_BASE_REF: 'main' }, [])).toBe(true);
    expect(isStrict({ GITHUB_REF: 'refs/heads/feat/x' }, [])).toBe(false);
    expect(isStrict({}, ['--strict'])).toBe(true);
  });
});

describe('site config', () => {
  it('derives the base path from the stage', () => {
    expect(loadSiteConfig({ SITE_STAGE: 'launched' }).base).toBe('/');
    expect(loadSiteConfig({ SITE_STAGE: 'preview' }).base).toBe('/v2/');
  });
  it('defaults to content/site.yaml (not launched → preview)', () => {
    const cfg = loadSiteConfig({});
    expect(cfg.stage).toBe(cfg.launched ? 'launched' : 'preview');
  });
  it('rejects an unknown stage', () => {
    expect(() => loadSiteConfig({ SITE_STAGE: 'prod' })).toThrow();
  });
});
