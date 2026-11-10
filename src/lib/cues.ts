/**
 * Redundant cues (PLAN-EXPERIENCE §1.4.2, §3.3; WCAG 1.4.1): every accent colour that carries a
 * category also has a glyph, so Mono, the colour-blind theme, more contrast and forced colours
 * lose nothing when the hues go. One glyph per role, the same everywhere (ticker tags, chips):
 *   ok / terminal green ◆ · highlight / gold ▶ · special / enchant ■ · info / diamond ● ·
 *   alert / redstone ▲.  White and other neutral tones carry no category and get none.
 * Drawn as a ::before from `data-cue` (global.css) where tokens.css sets --cue-display: every
 * theme but Night, which is the design as shipped and relies on its words.
 */
export type CueRole = 'ok' | 'highlight' | 'special' | 'info' | 'alert';

export const CUE_GLYPH: Readonly<Record<CueRole, string>> = {
  ok: '◆',
  highlight: '▶',
  special: '■',
  info: '●',
  alert: '▲',
};

/** The component tone names used across the site, by the role their colour plays. */
const TONE_ROLE: Readonly<Record<string, CueRole>> = {
  green: 'ok',
  grass: 'ok',
  gold: 'highlight',
  enchant: 'special',
  diamond: 'info',
  cyan: 'info',
  redstone: 'alert',
};

/** The glyph for a tone, or undefined for a neutral one (white). */
export function cueFor(tone: string): string | undefined {
  const role = TONE_ROLE[tone];
  return role ? CUE_GLYPH[role] : undefined;
}
