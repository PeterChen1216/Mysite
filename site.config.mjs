// Single source for build-time site settings shared by astro.config, scripts and tests.
// Reads content/site.yaml (owner-editable) and allows a CI/env override of the stage.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('.', import.meta.url));

/** @typedef {'preview' | 'launched'} Stage */

/**
 * `locales` is content/site.yaml `locales` as written (each language `live` or `preview`; the
 * build validates it).
 * @returns {{ domain: string, version: string, launched: boolean, stage: Stage, base: string, previewPath: string, locales: Record<string, string> }}
 */
export function loadSiteConfig(env = process.env) {
  const raw = parse(readFileSync(`${root}content/site.yaml`, 'utf8')) ?? {};
  const previewPath = '/v2/';
  const fromEnv = env.SITE_STAGE;
  if (fromEnv && fromEnv !== 'preview' && fromEnv !== 'launched') {
    throw new Error(`SITE_STAGE must be "preview" or "launched", got "${fromEnv}"`);
  }
  /** @type {Stage} */
  const stage =
    fromEnv === 'preview' || fromEnv === 'launched'
      ? fromEnv
      : raw.launched === true
        ? 'launched'
        : 'preview';
  return {
    domain: String(raw.domain ?? 'zhic.me'),
    version: String(raw.version ?? '0.0.0'),
    launched: raw.launched === true,
    stage,
    // Before launch (DECISIONS Q1) the legacy site stays at "/" and v2 is served from /v2/.
    base: stage === 'launched' ? '/' : previewPath,
    previewPath,
    locales: raw.locales && typeof raw.locales === 'object' ? { ...raw.locales } : { en: 'live' },
  };
}
