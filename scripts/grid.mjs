// A grid of equal-angle cells over the globe, row 0 at the north pole, for
// laying borders over one another (build-countries.mjs, build-civilizations.mjs).

/** Rings in the border files are delta-encoded in 0.01° steps; this gives [lon, lat] points. */
export function decodeRing(encoded) {
  const out = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < encoded.length; i += 2) {
    x += encoded[i];
    y += encoded[i + 1];
    out.push([x / 100, y / 100]);
  }
  return out;
}

/** A grid of `size`-degree cells: its size, each row's cell area (relative) and a ring filler. */
export function makeGrid(size) {
  const COLS = Math.round(360 / size);
  const ROWS = Math.round(180 / size);
  const weight = new Float64Array(ROWS);
  for (let r = 0; r < ROWS; r++) weight[r] = Math.cos(((90 - (r + 0.5) * size) * Math.PI) / 180);

  /** Adds the cells whose centres fall inside a ring to `cells` (scanline fill). */
  function fillRing(ring, cells) {
    let minY = 90;
    let maxY = -90;
    for (const [, y] of ring) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const r0 = Math.max(0, Math.floor((90 - maxY) / size));
    const r1 = Math.min(ROWS - 1, Math.floor((90 - minY) / size));
    let any = false;
    for (let r = r0; r <= r1; r++) {
      const lat = 90 - (r + 0.5) * size;
      const xs = [];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > lat !== yj > lat) xs.push(xi + ((lat - yi) / (yj - yi)) * (xj - xi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.ceil((xs[k] + 180) / size - 0.5);
        const c1 = Math.floor((xs[k + 1] + 180) / size - 0.5);
        for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) {
          cells.add(r * COLS + c);
          any = true;
        }
      }
    }
    // A ring smaller than a cell still claims the cell it sits in.
    if (!any && ring.length) {
      const [x, y] = ring[0];
      const r = Math.min(ROWS - 1, Math.max(0, Math.floor((90 - y) / size)));
      const c = Math.min(COLS - 1, Math.max(0, Math.floor((x + 180) / size)));
      cells.add(r * COLS + c);
    }
  }

  return { size, COLS, ROWS, weight, fillRing };
}

/**
 * The continents (scripts/continents.json, made by make-continents.mjs) and a
 * function that tells which ones a set of cells of that grid lies on, largest
 * share first. A continent counts when it holds at least `share` of the land,
 * or at least `km2` of it.
 */
export function loadContinents(readFileSync) {
  const { cell, codes, rows } = JSON.parse(readFileSync("scripts/continents.json", "utf8"));
  const grid = makeGrid(cell);
  const of = new Uint8Array(grid.COLS * grid.ROWS);
  rows.forEach((row, r) => {
    let c = r * grid.COLS;
    for (const run of row.split(" ")) {
      const [, name, n] = run.match(/^([a-z]*)(\d+)$/);
      of.fill(name ? codes.indexOf(name) + 1 : 0, c, c + Number(n));
      c += Number(n);
    }
  });
  const km2PerCell = (cell * 111.32) ** 2;
  function nearest(cell) {
    if (cell === undefined) return 0;
    const r0 = Math.floor(cell / grid.COLS);
    const c0 = cell % grid.COLS;
    for (let d = 1; d < grid.ROWS; d++) {
      for (let dr = -d; dr <= d; dr++) {
        const r = r0 + dr;
        if (r < 0 || r >= grid.ROWS) continue;
        for (let dc = -d; dc <= d; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
          const v = of[r * grid.COLS + ((c0 + dc + grid.COLS) % grid.COLS)];
          if (v) return v;
        }
      }
    }
    return 0;
  }
  function continentsOf(cells, { share, km2 }) {
    const sums = new Float64Array(codes.length + 1);
    for (const c of cells) sums[of[c]] += grid.weight[Math.floor(c / grid.COLS)];
    const land = sums.slice(1).reduce((a, b) => a + b, 0);
    // Land far out at sea (the Seychelles) takes the nearest continent.
    if (!land) {
      const near = nearest(cells.values().next().value);
      return near ? [codes[near - 1]] : [];
    }
    return codes
      .map((code, i) => ({ code, area: sums[i + 1] }))
      .filter(({ area }) => area > 0 && (area >= land * share || area * km2PerCell >= km2))
      .sort((a, b) => b.area - a.area)
      .map(({ code }) => code);
  }
  return { grid, continentsOf };
}
