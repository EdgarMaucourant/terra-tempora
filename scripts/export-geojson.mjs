// Writes the built borders (public/data) as GeoJSON, for use in other tools.
//
//   npm run geojson                  every year, one feature per shape
//   npm run geojson -- 1914          the map of one year (as on 31 December)
//   npm run geojson -- 1914 out.json to another file (default: borders-<year|all>.geojson)
//
// Each feature is one realm for a run of years: its name, its years (from, to,
// both included), its kind when it isn't a realm's own land ("hatch" for
// land held or run by another state, "group" for a group of territories,
// "blank" for land no state held), and the source of its border. Land not
// reviewed yet is left out.
import { writeFileSync } from "node:fs";
import { loadShapes } from "./shapes.mjs";

const args = process.argv.slice(2);
const year =
  args[0] !== undefined && /^-?\d+$/.test(args[0])
    ? Number(args.shift())
    : null;
const out = args[0] ?? `borders-${year ?? "all"}.geojson`;

const { shapes } = loadShapes();
const KEEP = [
  "name",
  "display",
  "from",
  "to",
  "kind",
  "partOf",
  "groups",
  "by",
  "with",
  "since",
  "confirmed",
  "occupied",
  "trust",
  "land",
  "rough",
  "wikipedia",
  "wikidata",
  "source",
];

// RFC 7946: outer rings counter-clockwise, holes clockwise, first point repeated.
const signedArea = (ring) =>
  ring.reduce((s, [x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length];
    return s + (x2 - x1) * (y2 + y1);
  }, 0);
const closed = (ring, outer) => {
  const r = signedArea(ring) < 0 === outer ? ring : [...ring].reverse();
  return [...r, r[0]];
};

const features = shapes
  .filter(
    (s) =>
      s.kind !== "unreviewed" &&
      (year === null || (s.from <= year && year <= s.to)),
  )
  .map((s) => ({
    type: "Feature",
    properties: Object.fromEntries(
      KEEP.filter(
        (k) => s[k] !== undefined && s[k] !== null && s[k] !== "",
      ).map((k) => [k, s[k]]),
    ),
    geometry: {
      type: "MultiPolygon",
      coordinates: s.rings.map((ring, i) => [
        closed(ring, true),
        ...(s.holes?.[i] ?? []).map((hole) => closed(hole, false)),
      ]),
    },
  }));

writeFileSync(out, JSON.stringify({ type: "FeatureCollection", features }));
console.log(`${features.length} features written to ${out}`);
