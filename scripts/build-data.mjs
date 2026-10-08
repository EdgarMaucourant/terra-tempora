// Builds the prototype dataset from Cliopatria (CC BY 4.0).
// Input:  data-raw/cliopatria.geojson (unzipped from the Cliopatria repository)
// Output: public/data/polities.json, a compact list of time-stamped polity shapes.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import polylabel from "polylabel";

const FROM = 1100;
const TO = 1500;
// Polities shown as the featured subject; the rest of the world is context.
const MONGOL = new Set([
  "Mongol Empire",
  "Yuan Dynasty",
  "Ilkhanate",
  "Golden Horde",
  "Chagatai Khanate",
  "Northern Yuan",
  "Eastern Chagatai Khanate",
  "Mongol Khanate",
]);

// Approximate ring area in square degrees, corrected for latitude.
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y2 + y1) * Math.cos((((y1 + y2) / 2) * Math.PI) / 180);
  }
  return Math.abs(sum / 2);
}

// Area-weighted centroid of a ring (planar, in degrees).
function ringCentroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return a === 0 ? null : [cx / (3 * a), cy / (3 * a)];
}

function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Label at the visual centre when it falls inside the shape, otherwise at the
// point deepest inside it.
function labelPoint(polygon) {
  const c = ringCentroid(polygon[0]);
  const point = c && insideRing(c, polygon[0]) ? c : polylabel(polygon, 0.1);
  return point.map((v) => Math.round(v * 100) / 100);
}

const raw = JSON.parse(readFileSync("data-raw/cliopatria.geojson", "utf8"));
const period = raw.features.filter(
  (f) =>
    f.properties.Type === "POLITY" &&
    f.properties.ToYear >= FROM &&
    f.properties.FromYear <= TO,
);
console.log(`${period.length} polity shapes between ${FROM} and ${TO}`);

mkdirSync("tmp", { recursive: true });
writeFileSync("tmp/period.geojson", JSON.stringify({ type: "FeatureCollection", features: period }));
// Topology-aware simplification keeps shared borders aligned.
execFileSync(
  "npx",
  ["mapshaper", "tmp/period.geojson", "-simplify", "3%", "keep-shapes", "-o", "precision=0.001", "tmp/simplified.geojson"],
  { stdio: "inherit" },
);
const simplified = JSON.parse(readFileSync("tmp/simplified.geojson", "utf8"));

const polities = simplified.features
  .filter((f) => f.geometry)
  .map((f, i) => {
    const p = f.properties;
    const polygons = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates)
      // Drop degenerate rings left over by simplification.
      .filter((poly) => poly[0].length >= 4);
    const largest = polygons.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a), polygons[0]);
    const label = largest ? labelPoint(largest) : null;
    return {
      id: i,
      name: p.Name,
      from: p.FromYear,
      to: p.ToYear,
      wikipedia: p.Wikipedia || null,
      wikidata: p.Wikidata || null,
      area: Math.round(p.Area),
      featured: MONGOL.has(p.Name),
      label,
      // Outer rings only: holes are rare at this scale and cost triangulation time.
      rings: polygons.map((poly) => poly[0].flat()),
    };
  })
  .filter((p) => p.rings.length > 0);

mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/polities.json", JSON.stringify({ source: "Cliopatria (Seshat Global History Databank), CC BY 4.0", from: FROM, to: TO, polities }));
rmSync("tmp", { recursive: true, force: true });
const featured = polities.filter((p) => p.featured).length;
console.log(`wrote ${polities.length} shapes (${featured} featured)`);
