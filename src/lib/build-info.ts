/**
 * "Last updated" and version stamps derived from git (PLAN §7.1, §7.4) — never hand-written.
 */
import { execFileSync } from 'node:child_process';

export interface ContentStamp {
  /** ISO date (YYYY-MM-DD) of the last commit touching content/. */
  date: string;
  /** Short hash of that commit, or "local" when git history is unavailable. */
  hash: string;
}

/** Parse `git log --format=%cs %h` output. Exported for tests. */
export function parseStamp(output: string): ContentStamp | null {
  const match = /^(\d{4}-\d{2}-\d{2}) ([0-9a-f]{4,40})$/.exec(output.trim());
  return match ? { date: match[1]!, hash: match[2]! } : null;
}

/** `vX.Y.Z+YYYYMMDD.<hash>` (PLAN §7.4). */
export function formatVersion(base: string, stamp: ContentStamp): string {
  return `v${base}+${stamp.date.replaceAll('-', '')}.${stamp.hash}`;
}

export function contentStamp(now: Date = new Date()): ContentStamp {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs %h', '--', 'content'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const parsed = parseStamp(out);
    if (parsed) return parsed;
  } catch {
    // Not a git checkout (e.g. a source tarball) — fall through.
  }
  return { date: now.toISOString().slice(0, 10), hash: 'local' };
}
