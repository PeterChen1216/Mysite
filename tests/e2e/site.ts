// Stage-aware paths shared by the E2E specs.
import { loadSiteConfig } from '../../site.config.mjs';

const cfg = loadSiteConfig();
export const STAGE = cfg.stage;
/** Where the v2 site lives in the Pages artifact. */
export const V2 = cfg.base;
