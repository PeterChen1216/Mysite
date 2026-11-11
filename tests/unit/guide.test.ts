/**
 * docs/CONTENT-GUIDE.md and CLAUDE.md stay true to the repository: every command they tell the
 * owner (or a Claude session) to run exists, and every picture the guide shows is there.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const scripts = Object.keys(JSON.parse(read('package.json')).scripts as Record<string, string>);
/** pnpm's own commands the docs may use. */
const BUILT_IN = ['install', 'exec'];

describe.each(['docs/CONTENT-GUIDE.md', 'CLAUDE.md', 'content/README.md'])('%s', (file) => {
  const text = read(file);
  it('names only pnpm commands that exist', () => {
    const used = [...text.matchAll(/\bpnpm ([a-z][\w:-]*)/g)].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(0);
    for (const name of new Set(used)) expect([...scripts, ...BUILT_IN], name).toContain(name);
  });
  it('shows only pictures that exist, each under 200 KB', () => {
    const dir = join(ROOT, file, '..');
    for (const [, src] of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      const path = join(dir, src!);
      expect(existsSync(path), src).toBe(true);
      expect(statSync(path).size, src).toBeLessThan(200 * 1024);
    }
  });
});

describe('docs/CONTENT-GUIDE.md', () => {
  const text = read('docs/CONTENT-GUIDE.md');
  it('has every section its table of contents, CLAUDE.md, CI and the scripts point to', () => {
    const headings = [...text.matchAll(/^## (\d+)\. (.+)$/gm)].map((m) => `${m[1]}. ${m[2]}`);
    expect(headings.map((h) => Number(h.split('.')[0]))).toEqual([...Array(17).keys()]);
    for (const [, n, title] of text.matchAll(/^(\d+)\. \[([^\]]+)\]\(#/gm))
      expect(headings).toContain(`${n}. ${title}`);
    expect(headings).toContain('11. CI 报错怎么读');
    expect(read('scripts/check-content.mjs')).toContain('"CI 报错怎么读"');
    expect(headings.find((h) => h.startsWith('12.'))).toMatch(/上线前先看效果/);
    expect(read('.github/workflows/ci.yml')).toContain('docs/CONTENT-GUIDE.md, section 12');
    expect(headings.find((h) => h.startsWith('1.'))).toMatch(/文件地图/);
    expect(read('CLAUDE.md')).toMatch(/CONTENT-GUIDE\.md` §1 maps/);
  });
  it('lists every content file the site reads', () => {
    for (const file of [
      'profile.yaml',
      'about.md',
      'now.md',
      'education.yaml',
      'experience.yaml',
      'honors.yaml',
      'interests.yaml',
      'skills.yaml',
      'aviation.yaml',
      'copy.yaml',
      'site.yaml',
      'resume/Resume.pdf',
    ])
      expect(text, file).toContain(`content/${file}`);
  });
});
