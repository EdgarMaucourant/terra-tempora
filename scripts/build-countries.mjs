// Builds the countries shown at the top of the landing page, each with the
// civilizations that led to it, from the border files and civilizations.json
// (run `npm run civs` first). Output: public/data/countries.json
//
// A country is a realm still standing in the last year of the data. Its
// lineage is every civilization that ruled a real share of the country's
// present land, or whose land lay mostly inside it, found by laying all the
// borders over a grid of quarter-degree cells. Some lineages are hand-picked
// instead (CURATED), to take in realms that shaped a country from elsewhere.
import { readFileSync, writeFileSync } from "node:fs";

const CELL = 0.25;
const COLS = 360 / CELL;
const ROWS = 180 / CELL;
// A civilization joins a country's lineage when it covered this share of the
// country's land at some point…
const MIN_SHARE_OF_COUNTRY = 0.1;
// …or when this share of its own land lay inside the country (and it was not tiny next to it).
const MIN_SHARE_OF_CIV = 0.6;
const MIN_CIV_TO_COUNTRY = 0.01;
const MAX_LINEAGE = 60;

// Realms standing in the last year that are not countries.
const NOT_COUNTRIES = new Set([
  "british-overseas-territories",
  "commonwealth-of-nations",
  "gaza-hamas",
  "mujahideen",
  "netherlands-antilles",
  "russian-occupied-territories",
  "turkish-republic-of-northern-cyprus",
  "estado-novo",
]);

// Everyday names, where stripping "Republic of" and the like is not enough.
const NAMES = {
  "french-fifth-republic": "France",
  "federated-republic-of-germany": "Germany",
  "kingdom-of-great-britain": "United Kingdom",
  "russian-federation": "Russia",
  "people-s-republic-of-china": "China",
  "republic-of-china": "Taiwan",
  "republic-of-korea": "South Korea",
  "democratic-people-s-republic-of-korea": "North Korea",
  "united-states-of-america": "United States",
  "communist-cuba": "Cuba",
  "communist-laos": "Laos",
  "mali-federation": "Mali",
  "arab-republic-of-egypt": "Egypt",
  "argentine-republic": "Argentina",
  "commonwealth-of-australia": "Australia",
  "commonwealth-of-dominica": "Dominica",
  "commonwealth-of-the-bahamas": "The Bahamas",
  "former-yugoslav-republic-of-macedonia": "North Macedonia",
  "third-hellenic-republic": "Greece",
  "second-republic-of-austria": "Austria",
  "swiss-confederation": "Switzerland",
  "union-of-myanmar": "Myanmar",
  "oriental-republic-of-uruguay": "Uruguay",
  "republic-of-turkey": "Turkey",
  "republic-of-the-congo": "Republic of the Congo",
  "democratic-republic-of-the-congo": "Democratic Republic of the Congo",
  "republic-of-the-niger": "Niger",
  "republic-of-the-philippines": "Philippines",
  "republic-of-the-gambia": "The Gambia",
  "socialist-republic-of-vietnam": "Vietnam",
  "people-s-democratic-republic-of-algeria": "Algeria",
  "people-s-republic-of-angola": "Angola",
  "people-s-republic-of-bangladesh": "Bangladesh",
  "islamic-republic-of-iran": "Iran",
  "islamic-republic-of-pakistan": "Pakistan",
  "federal-republic-of-nigeria": "Nigeria",
  "federal-republic-of-somalia": "Somalia",
  "republic-of-brazil": "Brazil",
  "saint-kitts": "Saint Kitts and Nevis",
  "saint-vincent": "Saint Vincent and the Grenadines",
  "eire": "Ireland",
  "east-timor": "Timor-Leste",
  "state-of-israel": "Israel",
  "state-of-libya": "Libya",
  "state-of-qatar": "Qatar",
  "state-of-eritrea": "Eritrea",
  "sultanate-of-brunei": "Brunei",
  "sultanate-of-oman": "Oman",
  "principality-of-andorra": "Andorra",
  "principality-of-monaco": "Monaco",
};

function everydayName(civ) {
  if (NAMES[civ.id]) return NAMES[civ.id];
  return civ.name.replace(/^(Republic|Kingdom|State|Federal Republic) of (the )?/, "");
}

// Hand-picked lineages, oldest first. France takes in Rome from its beginnings
// in Italy and the Franks from beyond the Rhine.
const CURATED = {
  "french-fifth-republic": {
    blurb: "From Rome and the Franks to the Fifth Republic, with the duchies, kingdoms and counties France absorbed.",
    startYear: 470,
    focus: "kingdom-of-france",
    lineage: [
      "roman-kingdom",
      "roman-republic",
      "roman-empire",
      "gallic-empire",
      "western-roman-empire",
      "salian-franks",
      "ripuarian-franks",
      "burgundians",
      "burgundian-kingdom",
      "visigothic-kingdom",
      "kingdom-of-the-franks",
      "aquitaine",
      "breton-kingdoms",
      "merovingian-empire",
      "carolingian-empire",
      "kingdom-of-neustria",
      "kingdom-of-brittany",
      "west-franks",
      "duchy-of-normandy",
      "kingdom-of-arles",
      "duchy-of-brittany",
      "kingdom-of-france",
      "duchy-of-aquitaine",
      "county-of-toulouse",
      "county-of-champagne",
      "county-of-anjou",
      "duchy-of-burgundy",
      "kingdom-of-navarre",
      "county-of-savoy",
      "house-of-bourbon",
      "duchy-of-lorraine",
      "corsican-republic",
      "french-first-republic",
      "french-directory",
      "french-consulate",
      "first-french-empire",
      "bourbon-kingdom-of-france",
      "french-second-republic",
      "second-french-empire",
      "french-third-republic",
      "vichy-france",
      "free-french",
      "french-fourth-republic",
      "french-fifth-republic",
    ],
  },
};

const index = JSON.parse(readFileSync("public/data/index.json", "utf8"));
const { civilizations } = JSON.parse(readFileSync("public/data/civilizations.json", "utf8"));
const civOfRealm = new Map();
for (const c of civilizations) for (const n of c.names) civOfRealm.set(n, c);
const byId = new Map(civilizations.map((c) => [c.id, c]));

function decodeRing(encoded) {
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

const weight = new Float64Array(ROWS);
for (let r = 0; r < ROWS; r++) weight[r] = Math.cos(((90 - (r + 0.5) * CELL) * Math.PI) / 180);

/** Adds the cells whose centres fall inside a ring to `cells` (scanline fill). */
function fillRing(ring, cells) {
  let minY = 90;
  let maxY = -90;
  for (const [, y] of ring) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const r0 = Math.max(0, Math.floor((90 - maxY) / CELL));
  const r1 = Math.min(ROWS - 1, Math.floor((90 - minY) / CELL));
  let any = false;
  for (let r = r0; r <= r1; r++) {
    const lat = 90 - (r + 0.5) * CELL;
    const xs = [];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat) xs.push(xi + ((lat - yi) / (yj - yi)) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.ceil((xs[k] + 180) / CELL - 0.5);
      const c1 = Math.floor((xs[k + 1] + 180) / CELL - 0.5);
      for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) {
        cells.add(r * COLS + c);
        any = true;
      }
    }
  }
  // A ring smaller than a cell still claims the cell it sits in.
  if (!any && ring.length) {
    const [x, y] = ring[0];
    const r = Math.min(ROWS - 1, Math.max(0, Math.floor((90 - y) / CELL)));
    const c = Math.min(COLS - 1, Math.max(0, Math.floor((x + 180) / CELL)));
    cells.add(r * COLS + c);
  }
}

const area = (cells) => {
  let sum = 0;
  for (const cell of cells) sum += weight[Math.floor(cell / COLS)];
  return sum;
};

// Every cell each civilization ever held, and each country's cells today.
const held = new Map();
const today = new Map();
const lastYear = index.to;
for (const w of index.windows) {
  for (const shape of JSON.parse(readFileSync(`public/data/${w.file}`, "utf8"))) {
    const civ = civOfRealm.get(shape.name);
    if (!civ) continue;
    let cells = held.get(civ.id);
    if (!cells) held.set(civ.id, (cells = new Set()));
    const rings = shape.rings.map(decodeRing);
    for (const ring of rings) fillRing(ring, cells);
    // Today's land: the realm's own name, not its "(overseas)" parts.
    if (shape.to >= lastYear && !shape.name.startsWith("(")) {
      let now = today.get(civ.id);
      if (!now) today.set(civ.id, (now = new Set()));
      for (const ring of rings) fillRing(ring, now);
    }
  }
}

const heldArea = new Map([...held].map(([id, cells]) => [id, area(cells)]));

/** The year when the most of these civilizations stood at once (the latest such year). */
function busiestYear(list) {
  const from = Math.min(...list.map((c) => c.from));
  let best = from;
  let most = 0;
  for (let y = from; y <= lastYear; y++) {
    let n = 0;
    for (const c of list) if (c.from <= y && c.to >= y) n++;
    if (n >= most) {
      most = n;
      best = y;
    }
  }
  return best;
}

const countries = [];
for (const [id, land] of today) {
  if (NOT_COUNTRIES.has(id)) continue;
  const civ = byId.get(id);
  const landArea = area(land);
  if (!landArea) continue;
  const curated = CURATED[id];
  let lineage;
  if (curated) lineage = curated.lineage.filter((l) => byId.has(l));
  else {
    const scored = [];
    for (const [other, cells] of held) {
      if (other === id || NOT_COUNTRIES.has(other)) continue;
      let shared = 0;
      for (const cell of cells) if (land.has(cell)) shared += weight[Math.floor(cell / COLS)];
      if (!shared) continue;
      const ofCountry = shared / landArea;
      const ofCiv = shared / heldArea.get(other);
      if (ofCountry >= MIN_SHARE_OF_COUNTRY || (ofCiv >= MIN_SHARE_OF_CIV && heldArea.get(other) >= landArea * MIN_CIV_TO_COUNTRY)) {
        scored.push({ id: other, score: ofCountry + ofCiv * 0.5 });
      }
    }
    // The present-day state itself always belongs.
    lineage = [id, ...scored.sort((a, b) => b.score - a.score).slice(0, MAX_LINEAGE - 1).map((s) => s.id)];
  }
  const list = lineage.map((l) => byId.get(l)).sort((a, b) => a.from - b.from || a.to - b.to);
  if (list.length < 2) continue;
  countries.push({
    id: everydayName(civ)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    name: everydayName(civ),
    civ: id,
    blurb: curated?.blurb ?? null,
    startYear: curated?.startYear ?? busiestYear(list),
    focus: curated?.focus ?? id,
    area: Math.round(landArea * (CELL * 111.32) ** 2),
    lineage: curated ? lineage : list.map((c) => c.id),
  });
}
countries.sort((a, b) => b.area - a.area);

writeFileSync("public/data/countries.json", JSON.stringify({ countries }));
console.log(`${countries.length} countries`);
for (const c of countries.slice(0, 12)) console.log(`${c.name}: ${c.lineage.length}`);
