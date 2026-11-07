// Says which realms the map draws at a place, year by year: a quick way to
// check a report or write a truth point (scripts/truth-points.json).
//
//   node scripts/who.mjs <lon>,<lat> <year> [<to year>]
//
// With two years, prints each run of years with the same answer.
import { loadShapes, realmsAt } from "./shapes.mjs";

const [where, from, to] = process.argv.slice(2);
const point = (where ?? "").split(",").map(Number);
if (point.length !== 2 || point.some(Number.isNaN) || !Number.isInteger(Number(from))) {
  console.error("Usage: node scripts/who.mjs <lon>,<lat> <year> [<to year>]");
  process.exit(1);
}
const { shapes } = loadShapes();
const first = Number(from);
const last = to === undefined ? first : Number(to);
let run = null;
const print = () => run && console.log(`${run.from === run.to ? run.from : `${run.from} to ${run.to}`}: ${run.names || "(blank)"}`);
for (let year = first; year <= last; year++) {
  if (year === 0) continue;
  const names = realmsAt(shapes, point, year).join(", ");
  if (run && run.names === names) run.to = year;
  else {
    print();
    run = { from: year, to: year, names };
  }
}
print();
