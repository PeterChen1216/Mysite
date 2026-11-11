/**
 * The voxel Earth (PLAN §6.4: "InstancedMesh 体素球 ≈ 1200 实例"): the same 10° land and ice map
 * as the DOM globe (src/assets/voxel/globe/land.svg, ice.svg: 36 × 18 squares of 18 px), turned
 * into a shell of unit cubes — sea at radius R, land and ice one block higher, the ground under a
 * coast showing as dirt. Pure.
 */
import { vecToLatLon } from './geo';

export interface CellMask {
  cols: number;
  rows: number;
  /** Row-major, row 0 at the North Pole, column 0 at 180° W; 1 = covered. */
  cells: Uint8Array;
}

/** The squares of a pixel-map SVG (`M x y H … Z` paths of `cell` px) as a mask. */
export function parseCellSvg(svg: string, cell = 18, cols = 36, rows = 18): CellMask {
  const cells = new Uint8Array(cols * rows);
  for (const m of svg.matchAll(/M(\d+(?:\.\d+)?)[ ,](\d+(?:\.\d+)?)H/g)) {
    const x = Number(m[1]) / cell;
    const y = Number(m[2]) / cell;
    if (Number.isInteger(x) && Number.isInteger(y) && x < cols && y < rows) cells[y * cols + x] = 1;
  }
  return { cols, rows, cells };
}

/** Whether the mask covers a latitude / longitude (degrees). */
export function maskAt(mask: CellMask, lat: number, lon: number): boolean {
  const col = Math.min(mask.cols - 1, Math.floor(((lon + 180) / 360) * mask.cols));
  const row = Math.min(mask.rows - 1, Math.floor(((90 - lat) / 180) * mask.rows));
  return mask.cells[row * mask.cols + col] === 1;
}

export type EarthKind = 'water' | 'land' | 'ice' | 'dirt';

export interface EarthVoxel {
  /** Integer cube centre in the Earth frame (y = north, longitude 0 towards +z). */
  p: [number, number, number];
  kind: EarthKind;
}

/**
 * The visible cubes of an Earth of `radius` blocks: every cube of the solid (the sea sphere plus
 * one layer of land and ice) that has an empty neighbour on at least one side.
 */
export function earthVoxels(radius: number, land: CellMask, ice: CellMask): EarthVoxel[] {
  const sea = radius + 0.5; // centres closer than this make the sea sphere
  const top = radius + 1.5; // land and ice add one layer
  const n = Math.ceil(top) + 1;
  const size = 2 * n + 1;
  const kinds = new Int8Array(size * size * size).fill(-1);
  const at = (x: number, y: number, z: number) => (x + n) * size * size + (y + n) * size + (z + n);
  const KIND: EarthKind[] = ['water', 'land', 'ice', 'dirt'];
  for (let x = -n; x <= n; x++)
    for (let y = -n; y <= n; y++)
      for (let z = -n; z <= n; z++) {
        const d = Math.hypot(x, y, z);
        if (d >= top) continue;
        const { lat, lon } = vecToLatLon([x, y, z]);
        const isIce = maskAt(ice, lat, lon);
        const isLand = !isIce && maskAt(land, lat, lon);
        if (d < sea) kinds[at(x, y, z)] = isIce ? 2 : isLand ? 3 : 0;
        else if (isIce) kinds[at(x, y, z)] = 2;
        else if (isLand) kinds[at(x, y, z)] = 1;
      }
  const out: EarthVoxel[] = [];
  const solid = (x: number, y: number, z: number) =>
    Math.abs(x) <= n && Math.abs(y) <= n && Math.abs(z) <= n && kinds[at(x, y, z)]! >= 0;
  for (let x = -n; x <= n; x++)
    for (let y = -n; y <= n; y++)
      for (let z = -n; z <= n; z++) {
        const k = kinds[at(x, y, z)]!;
        if (k < 0) continue;
        const open =
          !solid(x + 1, y, z) ||
          !solid(x - 1, y, z) ||
          !solid(x, y + 1, z) ||
          !solid(x, y - 1, z) ||
          !solid(x, y, z + 1) ||
          !solid(x, y, z - 1);
        if (open) out.push({ p: [x, y, z], kind: KIND[k]! });
      }
  return out;
}
