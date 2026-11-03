// Builds scripts/continents.json, the continent of every half-degree cell,
// which build-civilizations.mjs and build-countries.mjs read to tell where a
// realm stood. Run once by hand with Natural Earth's 1:50m countries:
//   curl -O https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
//   node scripts/make-continents.mjs ne_50m_admin_0_countries.geojson
//
// Natural Earth puts all of Russia in Europe: east of the Urals (60°E) is
// counted as Asia here. Sea cells near land take the continent of the nearest
// land, so coasts and small islands drawn a little off still find theirs.
import { readFileSync, writeFileSync } from "node:fs";
import { makeGrid } from "./grid.mjs";

const CODES = { Africa: "af", Asia: "as", Europe: "eu", "North America": "na", "South America": "sa", Oceania: "oc" };
// How far (in cells) land reaches out to sea.
const REACH = 8;

const { COLS, ROWS, fillRing } = makeGrid(0.5);
const grid = new Uint8Array(COLS * ROWS);
const letters = [" ", ...Object.values(CODES)];
const { features } = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const f of features) {
  const code = CODES[f.properties.CONTINENT];
  if (!code) continue;
  const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const polygon of polygons) {
    const cells = new Set();
    fillRing(polygon[0], cells);
    for (const cell of cells) {
      const lon = ((cell % COLS) + 0.5) * 0.5 - 180;
      const asia = f.properties.ADM0_A3 === "RUS" && (lon > 60 || lon < -150);
      grid[cell] = letters.indexOf(asia ? "as" : code);
    }
  }
}
for (let step = 0; step < REACH; step++) {
  const next = grid.slice();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r * COLS + c]) continue;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = r + dr;
        if (rr < 0 || rr >= ROWS) continue;
        const v = grid[rr * COLS + ((c + dc + COLS) % COLS)];
        if (v) {
          next[r * COLS + c] = v;
          break;
        }
      }
    }
  }
  grid.set(next);
}
// One line per row, run-length encoded: "120 eu3 as" is 120 cells of sea,
// then 3 of Europe, then one of Asia.
const rows = [];
for (let r = 0; r < ROWS; r++) {
  const runs = [];
  for (let c = 0; c < COLS; ) {
    let n = 1;
    while (c + n < COLS && grid[r * COLS + c + n] === grid[r * COLS + c]) n++;
    const name = grid[r * COLS + c] ? letters[grid[r * COLS + c]] : "";
    runs.push(`${name}${n}`);
    c += n;
  }
  rows.push(runs.join(" "));
}
writeFileSync("scripts/continents.json", `${JSON.stringify({ cell: 0.5, codes: Object.values(CODES), rows }, null, 1)}\n`);
console.log(`continents: ${rows.length} rows`);
