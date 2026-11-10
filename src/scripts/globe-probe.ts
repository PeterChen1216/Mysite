/**
 * The hero globe's crosshair (PLAN-EXPERIENCE §6 row 4), loaded the first time the globe is
 * pointed at, focused or touched (src/scripts/globe.ts): pixel lines through the point, and a
 * readout of its latitude, longitude and the continent or ocean there — read from the globe's own
 * 10° map (src/lib/regions.ts), the way the current tier draws it: the flat map behind the round
 * window at tiers 1–2, the WebGL sphere at tier 3 (the slider stays over it, invisible).
 *
 * Mouse: follows the pointer over the globe (and the globe turning under it). Keyboard focus: at
 * the centre, following the arrow keys. Touch: under the finger while it drags. Decoration
 * (aria-hidden): screen readers have the slider's own value. Words: copy.yaml hero.globe_*.
 */
import iceSvg from '../assets/voxel/globe/ice.svg?raw';
import landSvg from '../assets/voxel/globe/land.svg?raw';
import {
  latLonLabel,
  latLonOnFlatGlobe,
  latLonOnSphere,
  regionAt,
  type GlobeRegion,
} from '../lib/regions';
import { maskAt, parseCellSvg } from '../scene/earth';
import { HERO_VIEW, domGlobeCenterLon } from '../scene/geo';
import { GLOBE_TURN_EVENT } from './globe';
import { loopsAllowed } from './prefs';

interface Words {
  lat: { n: string; s: string };
  lon: { e: string; w: string };
  regions: Record<GlobeRegion, string>;
}

const SIZE = 324;
const land = parseCellSvg(landSvg);
const ice = parseCellSvg(iceSvg);

export function attachProbe(
  globe: HTMLElement,
  angle: () => number,
  first?: { x: number; y: number; kind: 'pointer' | 'press' | 'focus' },
): void {
  if (globe.querySelector('.globe__probe')) return;
  let words: Words;
  try {
    words = JSON.parse(globe.dataset.probe ?? '') as Words;
  } catch {
    return;
  }
  const probe = document.createElement('span');
  probe.className = 'globe__probe';
  probe.setAttribute('aria-hidden', 'true');
  probe.innerHTML = '<i class="globe__probe-h"></i><i class="globe__probe-v"></i>';
  const label = document.createElement('span');
  label.className = 'globe__probe-label';
  label.setAttribute('aria-hidden', 'true');
  label.dataset.surface = 'dark';
  globe.append(probe, label);
  const h = probe.firstElementChild as HTMLElement;
  const v = probe.lastElementChild as HTMLElement;

  /** Where the crosshair is, in the disc's px (0–324); null = hidden. */
  let at: { x: number; y: number } | null = null;
  let raf = 0;
  let text = '';

  const read = (x: number, y: number) => {
    const centre = domGlobeCenterLon(angle());
    const p =
      document.documentElement.dataset.scene === 'live'
        ? latLonOnSphere(
            (x - SIZE / 2) / (SIZE / 2),
            (SIZE / 2 - y) / (SIZE / 2),
            centre,
            HERO_VIEW,
          )
        : latLonOnFlatGlobe(x, y, centre, SIZE);
    if (!p) return null;
    const surface = maskAt(ice, p.lat, p.lon)
      ? 'ice'
      : maskAt(land, p.lat, p.lon)
        ? 'land'
        : 'water';
    const l = latLonLabel(p.lat, p.lon, words);
    return `${l.lat} ${l.lon} · ${words.regions[regionAt(p.lat, p.lon, surface)]}`;
  };

  const draw = () => {
    raf = 0;
    if (!at) {
      probe.dataset.on = 'false';
      label.dataset.on = 'false';
      return;
    }
    const t = read(at.x, at.y);
    if (!t) {
      probe.dataset.on = 'false';
      label.dataset.on = 'false';
    } else {
      h.style.translate = `0 ${Math.round(at.y) - 1}px`;
      v.style.translate = `${Math.round(at.x) - 1}px 0`;
      if (t !== text) label.textContent = text = t;
      // Above the point, kept over the disc's width; below it near the top.
      label.style.translate = `${Math.round(at.x)}px ${Math.round(at.y)}px`;
      label.dataset.side = at.y < 40 ? 'below' : 'above';
      probe.dataset.on = 'true';
      label.dataset.on = 'true';
    }
    // The globe turns under a still pointer: keep reading while it spins.
    if (loopsAllowed()) raf = requestAnimationFrame(draw);
  };
  const show = (point: { x: number; y: number } | null) => {
    at = point;
    if (!raf) raf = requestAnimationFrame(draw);
  };
  const local = (e: { clientX: number; clientY: number }) => {
    const r = globe.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * SIZE) / r.width,
      y: ((e.clientY - r.top) * SIZE) / r.height,
    };
  };
  const centre = { x: SIZE / 2, y: SIZE / 2 };
  let dragging = false;
  const focused = () => globe.matches(':focus-visible');

  globe.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || dragging) show(local(e));
  });
  globe.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') show(local(e));
  });
  globe.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') show(focused() ? centre : null);
  });
  globe.addEventListener('pointerdown', (e) => {
    dragging = true;
    show(local(e));
  });
  const up = () => {
    dragging = false;
    if (!globe.matches(':hover')) show(focused() ? centre : null);
  };
  globe.addEventListener('pointerup', up);
  globe.addEventListener('pointercancel', up);
  globe.addEventListener('focus', () => {
    if (focused() && !at) show(centre);
  });
  globe.addEventListener('blur', () => {
    if (!globe.matches(':hover')) show(null);
  });
  globe.addEventListener(GLOBE_TURN_EVENT, () => {
    if (at) show(at);
  });

  // The event that loaded this module, if it still holds now that it has loaded (a press does
  // until the pointer is let go: the globe captures it while it is dragged).
  if (first?.kind === 'focus' && focused()) show(centre);
  else if (first?.kind === 'pointer' && globe.matches(':hover')) show({ x: first.x, y: first.y });
  else if (first?.kind === 'press') {
    dragging = true;
    show({ x: first.x, y: first.y });
  }
}
