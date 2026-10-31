// Reads and writes the border window files (public/data/borders-*.json).
// A realm is redrawn as a new shape each time any of its borders moves, so most
// rings repeat from shape to shape: a window file lists each distinct ring once
// and each shape points at its rings by position. The file name carries a hash
// of its content, so browsers can keep a window for good (see public/_headers).
// Each window also comes coarse, for the globe seen from afar (coarsen below).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// Douglas-Peucker tolerance of the coarse windows, in 0.01° steps: 0.2°, about
// 22 km, a pixel or less on the whole globe.
const COARSE_TOLERANCE = 20;

/**
 * Writes one window's shapes, named after its years, its level (when given)
 * and its content; returns the file name and size.
 */
export function writeWindow(dir, w, shapes, level = "") {
  const rings = [];
  const seen = new Map();
  const list = shapes.map((s) => ({
    ...s,
    rings: s.rings.map((ring) => {
      const key = ring.join(",");
      if (!seen.has(key)) seen.set(key, rings.push(ring) - 1);
      return seen.get(key);
    }),
  }));
  const json = JSON.stringify({ rings, shapes: list });
  const hash = createHash("sha256").update(json).digest("hex").slice(0, 10);
  const file = `borders-${w.from}-${w.to}.${level ? `${level}.` : ""}${hash}.json`;
  writeFileSync(`${dir}/${file}`, json);
  return { file, size: json.length };
}

/** One window's shapes, each with its own rings (delta-encoded, as in toShape). */
export function readWindow(dir, file) {
  const { rings, shapes } = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
  return shapes.map((s) => ({ ...s, rings: s.rings.map((i) => rings[i]) }));
}

/**
 * The same shapes with simpler rings. A ring that would fall below three
 * points keeps its detail: it is small, and would otherwise vanish.
 */
export function coarsen(shapes) {
  const memo = new Map();
  const coarse = (ring) => {
    const key = ring.join(",");
    if (!memo.has(key)) {
      const simple = encode(simplify(decode(ring), COARSE_TOLERANCE));
      memo.set(key, simple.length >= 6 ? simple : ring);
    }
    return memo.get(key);
  };
  return shapes.map((s) => ({ ...s, rings: s.rings.map(coarse) }));
}

function decode(ring) {
  const points = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < ring.length; i += 2) points.push([(x += ring[i]), (y += ring[i + 1])]);
  return points;
}

function encode(points) {
  return points.flatMap(([x, y], i) => (i === 0 ? [x, y] : [x - points[i - 1][0], y - points[i - 1][1]]));
}

// Douglas-Peucker: the points that stay within `tolerance` of the line, first and last kept.
export function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    let best = -1;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
      const qx = ax + t * dx - px;
      const qy = ay + t * dy - py;
      const d = qx * qx + qy * qy;
      if (d > best) {
        best = d;
        index = i;
      }
    }
    if (best > t2) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
