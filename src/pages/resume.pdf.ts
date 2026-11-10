import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRoute } from 'astro';

// /resume.pdf ← content/resume/Resume.pdf (PLAN §4.1): the address that never changes. This
// version also has its own address, /resume/<date>-<hash>.pdf (src/pages/resume/[version].pdf.ts).
// Resolved from the project root: bundled endpoints don't keep their source location.
export const GET: APIRoute = async () => {
  const pdf = await readFile(join(process.cwd(), 'content', 'resume', 'Resume.pdf'));
  return new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } });
};
