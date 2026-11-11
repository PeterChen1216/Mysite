import { describe, expect, it } from 'vitest';
import { checkColors, findColorLiterals } from '../../scripts/check-colors.mjs';

const literals = (text: string, file = 'x.astro') =>
  findColorLiterals(text, file).map((h: { literal: string }) => h.literal);

describe('colour literal check (PLAN-EXPERIENCE §2.3)', () => {
  it('src/ has no colour outside src/styles/tokens.css', () => {
    expect(checkColors()).toEqual([]);
  });

  it('finds hex colours and colour functions anywhere, with their line', () => {
    const text = [
      '---',
      "const glow = 'rgb(74 237 217 / 0.35)';",
      '---',
      '<style>',
      '  .a { color: #fff; background: #12172a80; }',
      '  .b { box-shadow: 0 0 0 1px hsl(0 0% 0%), 0 0 0 2px oklch(0.5 0.1 200); }',
      '</style>',
    ].join('\n');
    expect(findColorLiterals(text, 'x.astro')).toEqual([
      { line: 2, literal: 'rgb(' },
      { line: 5, literal: '#fff' },
      { line: 5, literal: '#12172a80' },
      { line: 6, literal: 'hsl(' },
      { line: 6, literal: 'oklch(' },
    ]);
  });

  it('finds named colours in CSS only', () => {
    expect(literals('<style>.a { color: white; border: 1px solid Red }</style>')).toEqual([
      'white',
      'Red',
    ]);
    expect(literals('<p style="color: black">x</p>')).toEqual(['black']);
    expect(literals('.a { outline-color: navy; }', 'x.css')).toEqual(['navy']);
    // TypeScript and markup words are not colours.
    expect(literals("const TONES = ['gold', 'white'];\n<Chip tone=\"white\" />")).toEqual([]);
  });

  it('allows tokens, keywords, system colours, SVG data URIs and comments', () => {
    const ok = [
      '<style>',
      '  .a { color: var(--color-text-hi); background: transparent; fill: currentColor; }',
      '  .b { border-color: CanvasText; outline: 2px solid Highlight; }',
      "  .c { --glyph: url(\"data:image/svg+xml,%3Csvg stroke='%23000' fill='#000'/%3E\"); }",
      '  /* Figma #a335ee was 4.3:1 */',
      '  .d { font-family: var(--font-code); grid-area: gold; content: "white"; }',
      '</style>',
      '<!-- #fff -->',
      '// rgb(0 0 0) in a comment',
      '<a href="#fed">jump</a>',
      'const color = theme.color(x);',
    ].join('\n');
    expect(literals(ok)).toEqual([]);
  });
});
