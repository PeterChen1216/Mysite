/**
 * The hero terminal's prompt (PLAN-EXPERIENCE §6 row 12, Q-H1 "build it, behind the easter-egg
 * prompt click"): what each command prints and does. Pure; the words and every fact it can print
 * come in `PromptWords`, built at build time from content/ and copy.yaml (Hero.astro) — the
 * prompt can only say what the page already says. src/scripts/prompt.ts is the form around it.
 */
import type { Theme } from '../prefs/model';

export interface PromptWords {
  /** copy.yaml hero.prompt. */
  help: string[];
  not_found: string;
  theme_set: string;
  opening: string;
  /** The hero terminal's own lines: `whoami`, `cat ~/interests.txt`. */
  whoami: string;
  interests: string;
  /** The page's sections as the nav names them (`~/about` …). */
  sections: string[];
  /** The résumé link and its file name. */
  resume: { href: string; name: string };
  /** Each theme's plain name (copy.yaml prefs.theme.options). */
  themes: Record<Theme | 'auto', string>;
}

export type PromptAction =
  | { kind: 'theme'; theme: Theme | 'auto' }
  | { kind: 'open'; href: string }
  | { kind: 'clear' }
  | { kind: 'exit' };

export interface PromptResult {
  lines: string[];
  action?: PromptAction;
}

/** The names `theme` takes: the themes' ids and their in-world names (copy.yaml notes). */
export const THEME_ALIASES: Readonly<Record<string, Theme | 'auto'>> = {
  night: 'night',
  day: 'day',
  overworld: 'day',
  mono: 'mono-dark',
  'mono-dark': 'mono-dark',
  bedrock: 'mono-dark',
  paper: 'mono-light',
  'mono-light': 'mono-light',
  prism: 'cvd',
  cvd: 'cvd',
  auto: 'auto',
};

const fill = (template: string, key: string, value: string) =>
  template.replace(new RegExp(`\\{\\s*${key}\\s*\\}`, 'g'), value);

/** Run one line typed at the prompt. */
export function runCommand(input: string, w: PromptWords): PromptResult {
  const line = input.trim().replace(/\s+/g, ' ');
  if (!line) return { lines: [] };
  const [cmd = '', ...args] = line.split(' ');
  const arg = args.join(' ').toLowerCase();
  switch (cmd.toLowerCase()) {
    case 'help':
    case '?':
      return { lines: [...w.help] };
    case 'whoami':
      return { lines: [w.whoami] };
    case 'ls':
      return { lines: [w.sections.join('  ')] };
    case 'cat':
      if (/^(~\/)?interests\.txt$/.test(arg)) return { lines: [w.interests] };
      break;
    case 'open':
      if (/^(resume|résumé|resume\.pdf|cv)$/.test(arg))
        return {
          lines: [fill(w.opening, 'name', w.resume.name)],
          action: { kind: 'open', href: w.resume.href },
        };
      break;
    case 'theme': {
      const theme = THEME_ALIASES[arg];
      if (theme)
        return {
          lines: [fill(w.theme_set, 'name', w.themes[theme])],
          action: { kind: 'theme', theme },
        };
      return { lines: [w.help.find((h) => h.startsWith('theme')) ?? w.help[0] ?? ''] };
    }
    case 'clear':
      return { lines: [], action: { kind: 'clear' } };
    case 'exit':
    case 'quit':
      return { lines: [], action: { kind: 'exit' } };
  }
  return { lines: [fill(w.not_found, 'cmd', line.slice(0, 40))] };
}
