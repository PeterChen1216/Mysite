/**
 * `?debug=1` HUD (PLAN §9.3, PLAN-EXPERIENCE §7.5): fps, frame time, the graphics tier and why,
 * draw calls and pixel ratio, in one line at the top left. Loaded only with `?debug`. Its wording
 * is content/copy.yaml `scene.hud` (on the page as `data-scene-hud`).
 */
export interface HudStats {
  fps: number;
  frameMs: number;
  draws: number;
  dpr: number;
}

export function showHud() {
  const el = document.createElement('div');
  el.className = 'scene-hud';
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  const template = document.querySelector<HTMLElement>('[data-scene-hud]')?.dataset.sceneHud ?? '';
  const values: Record<string, string> = {
    fps: '–',
    ms: '–',
    tier: '',
    reason: '',
    draws: '–',
    dpr: '–',
  };
  const render = () => {
    el.textContent = template.replace(/\{\s*(\w+)\s*\}/g, (m, k: string) => values[k] ?? m);
  };
  render();
  return {
    tier(tier: string, reason: string) {
      values.tier = tier;
      values.reason = reason;
      render();
    },
    stats(s: HudStats) {
      values.fps = s.fps.toFixed(0);
      values.ms = s.frameMs.toFixed(1);
      values.draws = String(s.draws);
      values.dpr = s.dpr.toFixed(2);
      render();
    },
  };
}
