/**
 * Where airports are, to draw content/aviation.yaml `watching` routes on the scene's Earth
 * (DECISIONS "AvGeek 模块重设计": the owner lists the routes; the site never makes one up).
 * Public reference positions rounded to 0.01° — far finer than one block of the voxel Earth
 * (about 6°). A route whose airport is not listed here is not drawn (the AvGeek card still lists
 * it); `pnpm content:check` names the code to add.
 */
export const AIRPORTS: Readonly<Record<string, readonly [lat: number, lon: number]>> = {
  // North America
  SEA: [47.45, -122.31],
  SFO: [37.62, -122.38],
  LAX: [33.94, -118.41],
  SJC: [37.36, -121.93],
  PDX: [45.59, -122.6],
  YVR: [49.19, -123.18],
  YYZ: [43.68, -79.63],
  JFK: [40.64, -73.78],
  EWR: [40.69, -74.17],
  BOS: [42.36, -71.01],
  IAD: [38.95, -77.46],
  ORD: [41.98, -87.9],
  DFW: [32.9, -97.04],
  ATL: [33.64, -84.43],
  DEN: [39.86, -104.67],
  MIA: [25.79, -80.29],
  HNL: [21.32, -157.92],
  ANC: [61.17, -149.99],
  MEX: [19.44, -99.07],
  // South America, Africa
  GRU: [-23.43, -46.47],
  JNB: [-26.14, 28.25],
  CAI: [30.12, 31.41],
  ADD: [8.98, 38.8],
  // Europe
  LHR: [51.47, -0.45],
  LGW: [51.15, -0.19],
  CDG: [49.01, 2.55],
  FRA: [50.04, 8.56],
  MUC: [48.35, 11.79],
  AMS: [52.31, 4.76],
  ZRH: [47.46, 8.55],
  MAD: [40.47, -3.56],
  BCN: [41.3, 2.08],
  FCO: [41.8, 12.25],
  IST: [41.26, 28.74],
  HEL: [60.32, 24.96],
  CPH: [55.62, 12.66],
  // Middle East, South Asia
  DXB: [25.25, 55.36],
  DOH: [25.27, 51.61],
  AUH: [24.43, 54.65],
  DEL: [28.56, 77.1],
  BOM: [19.09, 72.87],
  // East and South-East Asia
  PEK: [40.08, 116.58],
  PKX: [39.51, 116.41],
  PVG: [31.14, 121.81],
  SHA: [31.2, 121.34],
  CAN: [23.39, 113.3],
  SZX: [22.64, 113.81],
  CTU: [30.58, 103.95],
  TFU: [30.31, 104.44],
  HGH: [30.23, 120.43],
  XIY: [34.45, 108.75],
  HKG: [22.31, 113.91],
  MFM: [22.15, 113.59],
  TPE: [25.08, 121.23],
  ICN: [37.46, 126.44],
  NRT: [35.77, 140.39],
  HND: [35.55, 139.78],
  KIX: [34.43, 135.24],
  SIN: [1.36, 103.99],
  BKK: [13.69, 100.75],
  KUL: [2.75, 101.71],
  MNL: [14.51, 121.02],
  // Oceania
  SYD: [-33.95, 151.18],
  MEL: [-37.67, 144.84],
  AKL: [-37.01, 174.79],
};

/** An airport's position, or null when it is not in the table. */
export function airport(code: string): { lat: number; lon: number } | null {
  const p = AIRPORTS[code.trim().toUpperCase()];
  return p ? { lat: p[0], lon: p[1] } : null;
}
