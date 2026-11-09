import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findPlaceholders, isStrict } from '../../scripts/check-content.mjs';
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
  it('the real content/ folder is clean', () => {
    expect(findPlaceholders(join(import.meta.dirname, '../../content'))).toEqual([]);
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
