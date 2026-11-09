// content/copy.yaml as the page shows it: page-wide {placeholders} filled from content, exactly
// like src/lib/content.ts getCopy(), so tests follow copy edits instead of hardcoding wording.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { copyVars, fillCopy, type EducationLike } from '../../src/lib/derive';
import type { Copy } from '../../src/content/schema';

const yaml = (name: string) => parse(readFileSync(`content/${name}`, 'utf8'));
const profile = yaml('profile.yaml');
const site = yaml('site.yaml');
const education: EducationLike[] = yaml('education.yaml');
const latest = [...education].sort((a, b) => String(b.start).localeCompare(String(a.start)))[0]!;
const primary = profile.emails.find((e: { primary?: boolean }) => e.primary) ?? profile.emails[0];

export const copy: Copy = fillCopy(
  yaml('copy.yaml'),
  copyVars({
    displayName: profile.name.display,
    location: profile.location,
    domain: site.domain,
    email: primary.address,
    edu: { ...latest, short: latest.short, department: latest.department },
  }),
);

/** Escape a string for use inside a RegExp. */
export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
