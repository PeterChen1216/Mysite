import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INTRO, motionCssVars, typingMs, UI } from '../../src/motion/params';

/** Every file under src/ that can hold CSS. */
function styleSources(dir = 'src'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return styleSources(path);
    return /\.(css|astro)$/.test(e.name) ? [path] : [];
  });
}

const defined = new Map(
  motionCssVars()
    .split(';')
    .map((decl) => decl.split(/:(.*)/s) as [string, string]),
);

describe('motion parameters reach the CSS', () => {
  const used = new Map<string, string[]>();
  for (const file of styleSources())
    for (const [, name] of readFileSync(file, 'utf8').matchAll(/var\((--m-[\w-]+)/g))
      used.set(name!, [...(used.get(name!) ?? []), file]);

  it('every --m-* variable the CSS reads is set from params.ts', () => {
    const missing = [...used].filter(([name]) => !defined.has(name));
    expect(missing).toEqual([]);
  });
  it('every --m-* variable params.ts sets is read somewhere', () => {
    expect([...defined.keys()].filter((name) => !used.has(name))).toEqual([]);
  });
  it('values are plain CSS values', () => {
    for (const [name, value] of defined) {
      expect(name).toMatch(/^--m-[a-z-]+$/);
      expect(value, name).toMatch(/^[^;{}]+$/);
    }
    expect(defined.get('--m-btn-hover')).toBe(
      `${UI.buttonHover.ms}ms steps(${UI.buttonHover.steps})`,
    );
    expect(defined.get('--m-word-dur')).toBe(`${INTRO.headline.durationMs}ms`);
  });
});

describe('typing pace', () => {
  it('is per character, within the line limits', () => {
    const { msPerChar, minLineMs, maxLineMs } = INTRO.typing;
    expect(typingMs(1)).toBe(minLineMs);
    expect(typingMs(40)).toBe(Math.max(minLineMs, 40 * msPerChar));
    expect(typingMs(10_000)).toBe(maxLineMs);
  });
});
