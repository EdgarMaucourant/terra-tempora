// Reads every shape of the border files in public/data at once, for the
// scripts that look at the whole map: the audit (audit.mjs), the place lookup
// (who.mjs) and the truth points of check-data.mjs.
import { readFileSync } from "node:fs";
import { readWindow } from "./border-files.mjs";
import { decodeRing } from "./grid.mjs";

/** Every shape, each once (a shape can sit in two windows), with its rings decoded to [lon, lat]. */
export function loadShapes(dir = "public/data") {
  const index = JSON.parse(readFileSync(`${dir}/index.json`, "utf8"));
  const byId = new Map();
  for (const w of index.windows) {
    for (const s of readWindow(dir, w.file)) {
      if (!byId.has(s.id)) byId.set(s.id, { ...s, rings: s.rings.map(decodeRing) });
    }
  }
  return { index, shapes: [...byId.values()].sort((a, b) => a.from - b.from || a.id - b.id) };
}

function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < xi + ((y - yi) / (yj - yi)) * (xj - xi)) inside = !inside;
  }
  return inside;
}

/** Whether a [lon, lat] point lies in a shape (shapes have no holes: each ring is a part). */
export function shapeHas(shape, point) {
  return shape.rings.some((ring) => insideRing(point, ring));
}

/** The names of the realms drawn at a point in a year, smallest first (the one on top). */
export function realmsAt(shapes, point, year) {
  return shapes
    .filter((s) => !s.kind && s.from <= year && year <= s.to && shapeHas(s, point))
    .sort((a, b) => a.area - b.area)
    // A territory (the Azores) is drawn as itself and as its state's land.
    .flatMap((s) => (s.partOf ? [s.name, s.partOf] : [s.name]));
}

/** The states drawn as holding a point in a year (hatched over its owner). */
export function holdersAt(shapes, point, year) {
  return shapes.filter((s) => s.kind === "hatch" && s.from <= year && year <= s.to && shapeHas(s, point)).map((s) => s.by);
}

/** Whether a point is drawn as not yet reviewed in a year. */
export function unreviewedAt(shapes, point, year) {
  return shapes.some((s) => s.kind === "unreviewed" && s.from <= year && year <= s.to && shapeHas(s, point));
}
