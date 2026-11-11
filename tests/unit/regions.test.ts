// The globe's crosshair (PLAN-EXPERIENCE §6 row 4): real places, read from the globe's own map.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GLOBE_REGIONS,
  latLonLabel,
  latLonOnFlatGlobe,
  latLonOnSphere,
  regionAt,
  wrapLon,
  type Surface,
} from '../../src/lib/regions';
import { maskAt, parseCellSvg } from '../../src/scene/earth';
import { HERO_VIEW, domGlobeCenterLon } from '../../src/scene/geo';

const land = parseCellSvg(readFileSync('src/assets/voxel/globe/land.svg', 'utf8'));
const ice = parseCellSvg(readFileSync('src/assets/voxel/globe/ice.svg', 'utf8'));
/** What the globe shows at a place, and the region it names there. */
const onMap = (lat: number, lon: number) => {
  const surface: Surface = maskAt(ice, lat, lon)
    ? 'ice'
    : maskAt(land, lat, lon)
      ? 'land'
      : 'water';
  return regionAt(lat, lon, surface);
};

describe('regions on the globe’s own 10° map', () => {
  it.each([
    ['Seattle', 47.6, -122.3, 'north_america'],
    ['Mexico City', 19.4, -99.1, 'north_america'],
    ['Anchorage', 61.2, -149.9, 'north_america'],
    ['Greenland’s ice sheet', 72, -40, 'north_america'],
    ['Bogotá', 4.7, -74.1, 'south_america'],
    ['Rio de Janeiro', -22.9, -43.2, 'south_america'],
    ['Paris', 48.9, 2.3, 'europe'],
    ['Moscow', 55.8, 37.6, 'europe'],
    ['Athens', 38, 23.7, 'europe'],
    ['Cairo', 30, 31.2, 'africa'],
    ['Nairobi', -1.3, 36.8, 'africa'],
    ['Lagos', 6.5, 3.4, 'africa'],
    ['Riyadh', 24.7, 46.7, 'asia'],
    ['Ankara', 39.9, 32.9, 'asia'],
    ['Mumbai', 19, 72.9, 'asia'],
    ['Novosibirsk', 55, 82.9, 'asia'],
    ['Tokyo', 35.7, 139.7, 'asia'],
    ['Jakarta', -6.2, 106.8, 'asia'],
    ['Alice Springs', -23.7, 133.9, 'oceania'],
    ['Port Moresby', -9.4, 147.2, 'oceania'],
    ['the South Pole', -89, 0, 'antarctica'],
    ['the North Pole', 89, 0, 'arctic'],
    ['the mid-Atlantic', 30, -40, 'atlantic'],
    ['the South Atlantic', -30, -15, 'atlantic'],
    ['the Caribbean', 15, -75, 'atlantic'],
    ['the mid-Pacific', 0, -150, 'pacific'],
    ['off Peru', -15, -95, 'pacific'],
    ['the Indian Ocean', -20, 80, 'indian'],
    ['the Arabian Sea', 15, 65, 'indian'],
    ['the Southern Ocean', -65, 40, 'southern'],
    ['the Barents Sea', 75, 40, 'arctic'],
  ])('%s', (_, lat, lon, region) => {
    expect(onMap(lat, lon)).toBe(region);
  });
  it('names something everywhere (every region has a name in copy.yaml)', () => {
    for (let lat = -89; lat <= 89; lat += 7)
      for (let lon = -179; lon <= 179; lon += 7) expect(GLOBE_REGIONS).toContain(onMap(lat, lon));
  });
  it('wraps longitudes', () => {
    expect(wrapLon(190)).toBe(-170);
    expect(wrapLon(-190)).toBe(170);
    expect(wrapLon(540)).toBe(-180);
    expect(regionAt(47.6, -122.3 + 360, 'land')).toBe('north_america');
  });
});

describe('coordinates as copy.yaml writes them', () => {
  const words = { lat: { n: '{deg}°N', s: '{deg}°S' }, lon: { e: '{deg}°E', w: '{ deg }°W' } };
  it('whole degrees with their hemisphere', () => {
    expect(latLonLabel(47.6, -122.3, words)).toEqual({ lat: '48°N', lon: '122°W' });
    expect(latLonLabel(-33.9, 151.2, words)).toEqual({ lat: '34°S', lon: '151°E' });
    expect(latLonLabel(0.2, 0.4, words)).toEqual({ lat: '0°N', lon: '0°E' });
    expect(latLonLabel(-0.4, 179.8, words)).toEqual({ lat: '0°N', lon: '180°E' });
    expect(latLonLabel(-0.6, -179.8, words)).toEqual({ lat: '1°S', lon: '180°E' });
  });
});

describe('where the pointer is on each tier’s globe', () => {
  it('tiers 1–2: the flat map behind a round window, 1.8 px a degree', () => {
    const c = domGlobeCenterLon(0);
    expect(latLonOnFlatGlobe(162, 162, c)).toEqual({ lat: 0, lon: c });
    expect(latLonOnFlatGlobe(162, 0, c)!.lat).toBe(90);
    expect(latLonOnFlatGlobe(0, 162, 100)!.lon).toBe(10);
    expect(latLonOnFlatGlobe(162 + 18, 162 - 18, 0)).toEqual({ lat: 10, lon: 10 });
    // Outside the disc (its corner): nothing.
    expect(latLonOnFlatGlobe(5, 5, c)).toBeNull();
  });
  it('tier 3: the sphere seen along the stop 1 camera — its centre shows the slider’s longitude', () => {
    const p = latLonOnSphere(0, 0, 40, HERO_VIEW)!;
    expect(p.lon).toBeCloseTo(40, 5);
    // The camera sits a little above the equator.
    const up = HERO_VIEW[1] / Math.hypot(...HERO_VIEW);
    expect(p.lat).toBeCloseTo((Math.asin(up) * 180) / Math.PI, 5);
    // Up the disc is north, right is east.
    expect(latLonOnSphere(0, 0.5, 40, HERO_VIEW)!.lat).toBeGreaterThan(p.lat + 20);
    expect(latLonOnSphere(0.5, 0, 40, HERO_VIEW)!.lon).toBeGreaterThan(40 + 20);
    // Off the sphere: nothing.
    expect(latLonOnSphere(0.99, 0.99, 40, HERO_VIEW)).toBeNull();
  });
});
