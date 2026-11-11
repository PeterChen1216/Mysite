#!/usr/bin/env node
// Minimal static server that mimics GitHub Pages path resolution (dir → index.html, 404.html).
// Used by Playwright so E2E runs against the exact Pages artifact, and by the owner to look at a
// site CI built (`pnpm preview:site <unzipped folder>`, docs/CONTENT-GUIDE.md §12).
// Usage: node scripts/serve.mjs <dir> [port]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';

// pnpm runs scripts from the project root; INIT_CWD is where the command was typed.
const dir = process.argv[2] ?? '_site';
const typed = resolve(process.env.INIT_CWD ?? process.cwd(), dir);
const root = existsSync(typed) || !existsSync(resolve(dir)) ? typed : resolve(dir);
const port = Number(process.argv[3] ?? process.env.PORT ?? 4322);
if (!existsSync(join(root, 'index.html'))) {
  console.error(
    root.endsWith('.zip')
      ? `✖ ${root} is still a zip: unzip it first (double-click it), then pass the folder`
      : `✖ ${root} has no index.html — pass the folder of a built site (the unzipped site-… download, or _site)`,
  );
  process.exit(1);
}
/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let decoded;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  let path = normalize(join(root, decoded));
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) {
    if (!url.pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${url.pathname}/` }).end();
      return;
    }
    path = join(path, 'index.html');
  } else if (!existsSync(path) && existsSync(`${path}.html`)) {
    path = `${path}.html`;
  }
  if (!existsSync(path)) {
    const notFound = join(root, '404.html');
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    if (existsSync(notFound)) createReadStream(notFound).pipe(res);
    else res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} on http://localhost:${port}`);
  // Before launch the new site is under /v2/ (the old one keeps the root).
  const v2 = existsSync(join(root, 'v2', 'index.html'));
  console.log(`open http://localhost:${port}/${v2 ? 'v2/' : ''} — Ctrl+C stops it`);
});
