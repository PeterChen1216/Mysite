/**
 * Runs for every page as it is generated (also at build time, for the static pages): turns the
 * English fallbacks the page data marked on a translated page into `<span lang="en">` (see
 * src/i18n/fallback.ts). A page without marks — every English page — passes through untouched.
 */
import { defineMiddleware } from 'astro:middleware';
import { hasFallback, renderFallbacks } from './i18n/fallback';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (!response.headers.get('content-type')?.startsWith('text/html')) return response;
  const html = await response.text();
  const body = hasFallback(html) ? renderFallbacks(html) : html;
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
});
