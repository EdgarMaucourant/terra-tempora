// What the camera shows of a realm: its heartland and the holdings near it,
// not the whole spread of an empire across the oceans, nor whichever overseas
// piece happens to be its largest.

/** Holdings this close to the heartland's part (km between their boxes) are framed with it. */
const NEAR_KM = 1500;
const KM_PER_DEGREE = 111.32;

interface Frame {
  /** [longitude, latitude] to look at. */
  center: [number, number];
  /** km² to fit on screen. */
  area: number;
}

interface Part {
  ring: number[];
  /** [west, south, east, north], longitudes unwrapped to sit near the heartland. */
  box: [number, number, number, number];
  area: number;
}

/** Whether a point lies inside a flat [lon, lat, …] ring (even-odd rule). */
export function inRing(ring: number[], lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** km between two boxes, 0 when they touch or overlap. */
function gap(a: Part["box"], b: Part["box"]): number {
  const dLon = Math.max(0, a[0] - b[2], b[0] - a[2]);
  const dLat = Math.max(0, a[1] - b[3], b[1] - a[3]);
  const lat = (Math.max(a[1], b[1]) + Math.min(a[3], b[3])) / 2;
  return Math.hypot(dLon * Math.cos((lat * Math.PI) / 180), dLat) * KM_PER_DEGREE;
}

/**
 * Frames a realm from its rings (flat [lon, lat, …] arrays) in one year: the
 * part holding its heartland, else the part nearest it, else the largest, and
 * every other part close to that one. French Guiana stays out of the French
 * Third Republic's frame, Algeria and West Africa come in with France.
 */
export function frameRealm(rings: number[][], home: [number, number] | null): Frame | null {
  if (!rings.length) return null;
  const ref = home?.[0] ?? rings[0][0];
  const parts: Part[] = rings.map((ring) => {
    // Shift the whole ring by a turn when it lies across the antimeridian from the heartland.
    const shift = Math.round((ref - ring[0]) / 360) * 360;
    let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
    let sum = 0;
    for (let i = 0; i < ring.length; i += 2) {
      const x = ring[i] + shift;
      const y = ring[i + 1];
      [w, s, e, n] = [Math.min(w, x), Math.min(s, y), Math.max(e, x), Math.max(n, y)];
      const j = (i + 2) % ring.length;
      sum += ring[i] * ring[j + 1] - ring[j] * ring[i + 1];
    }
    const area = (Math.abs(sum) / 2) * KM_PER_DEGREE ** 2 * Math.cos((((s + n) / 2) * Math.PI) / 180);
    return { ring: shift ? ring.map((v, i) => (i % 2 ? v : v + shift)) : ring, box: [w, s, e, n], area };
  });

  let anchor = parts.reduce((a, b) => (b.area > a.area ? b : a));
  if (home) {
    const point: Part["box"] = [home[0], home[1], home[0], home[1]];
    anchor =
      parts.find((p) => inRing(p.ring, home[0], home[1])) ??
      parts.reduce((a, b) => (gap(b.box, point) < gap(a.box, point) ? b : a));
  }

  let [w, s, e, n] = anchor.box;
  for (const p of parts) {
    if (p === anchor || gap(p.box, anchor.box) > NEAR_KM) continue;
    [w, s, e, n] = [Math.min(w, p.box[0]), Math.min(s, p.box[1]), Math.max(e, p.box[2]), Math.max(n, p.box[3])];
  }
  const lat = (s + n) / 2;
  const width = (e - w) * Math.cos((lat * Math.PI) / 180) * KM_PER_DEGREE;
  const height = (n - s) * KM_PER_DEGREE;
  const lon = ((((w + e) / 2 + 180) % 360) + 360) % 360 - 180;
  // Spread-out land fills about a quarter of its box, and the camera frames a
  // realm by its land's area.
  return { center: [lon, lat], area: Math.max(width, height) ** 2 / 4 };
}
