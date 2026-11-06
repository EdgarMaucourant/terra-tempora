// The continent of a point on the globe, read from the half-degree grid that
// the data scripts use (scripts/continents.json, made by make-continents.mjs).
// The grid is only downloaded when the search needs it.

import type { Continent } from "./civilizations";

let grid: Promise<(lon: number, lat: number) => Continent | null> | undefined;

/** A function that gives the continent of a [lon, lat] point, or null out at sea. */
export function continentFinder(): Promise<(lon: number, lat: number) => Continent | null> {
  grid ??= import("../scripts/continents.json").then(({ default: json }) => {
    const { cell, codes, rows } = json as { cell: number; codes: Continent[]; rows: string[] };
    const cols = Math.round(360 / cell);
    const of = new Uint8Array(cols * rows.length);
    rows.forEach((row, r) => {
      let c = r * cols;
      for (const run of row.split(" ")) {
        const [, name, n] = /^([a-z]*)(\d+)$/.exec(run)!;
        if (name) of.fill(codes.indexOf(name as Continent) + 1, c, c + Number(n));
        c += Number(n);
      }
    });
    return (lon: number, lat: number) => {
      const r = Math.min(rows.length - 1, Math.max(0, Math.floor((90 - lat) / cell)));
      const c = Math.min(cols - 1, Math.max(0, Math.floor((lon + 180) / cell)));
      const code = of[r * cols + c];
      return code ? codes[code - 1] : null;
    };
  });
  return grid;
}
