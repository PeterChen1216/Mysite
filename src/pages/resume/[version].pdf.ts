import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { RESUME_SOURCE, resumeInfo } from '../../lib/resume';

// /resume/<date>-<hash>.pdf ← content/resume/Resume.pdf: this version's own address (src/lib/resume.ts).
// Only the current version is published; /resume.pdf (src/pages/resume.pdf.ts) is the one that
// never changes.
export const getStaticPaths = (() => [
  { params: { version: resumeInfo().version } },
]) satisfies GetStaticPaths;

export const GET: APIRoute = async () => {
  const pdf = await readFile(join(process.cwd(), RESUME_SOURCE));
  return new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } });
};
