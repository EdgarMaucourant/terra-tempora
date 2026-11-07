// Looks over the whole map for likely mistakes and writes them to
// docs/audit/report.md, sorted by era and region, for the review described in
// docs/data-review.md. Nothing here changes the data: each flag is a lead for
// a person to check against a source.
//
//   npm run audit
//
// The checks that need Wikidata (what a realm's item is, its dates, its
// predecessors and successors) read scripts/wikidata-facts.json, made by
// `node scripts/fetch-wikidata-facts.mjs`; without that file they are skipped.
// The item each realm's Wikipedia article belongs to is in
// scripts/article-items.json, made by `node scripts/fetch-article-items.mjs`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { makeGrid } from "./grid.mjs";
import { loadShapes } from "./shapes.mjs";

const OUT = "docs/audit/report.md";
const FACTS = "scripts/wikidata-facts.json";
const ARTICLES = "scripts/article-items.json";
// A shape counts as the same land as another when its area is within this share…
const SAME_AREA = 0.1;
// …and its label point within this distance (km).
const SAME_PLACE_KM = 100;
// A name that moves farther than this onto another realm's land has jumped.
const JUMP_KM = 300;
// Years apart before a realm's dates and its Wikidata item's dates disagree.
const DATE_SLACK = 25;
const DATE_FAR = 100;
// A realm missing from the map for up to this many years, then back.
const MAX_GAP = 30;
// A predecessor or successor more than this many years away.
const LINK_GAP = 50;
// A realm's centre moving farther than this (km) from one shape to the next.
const MOVE_KM = 1500;

const ERAS = [
  [-Infinity, 499, "Before 500"],
  [500, 999, "500 to 999"],
  [1000, 1499, "1000 to 1499"],
  [1500, 1799, "1500 to 1799"],
  [1800, 1899, "1800 to 1899"],
  [1900, Infinity, "1900 to today"],
];
const REGIONS = { eu: "Europe", as: "Asia", af: "Africa", na: "North America", sa: "South America", oc: "Oceania" };
const KINDS = {
  relabel: "Another realm's land under this name",
  "shared-id": "Wikidata item shared with another realm",
  identity: "Wikidata item doesn't look like this realm",
  "not-a-state": "Not a state (party, army, people)",
  dates: "Years differ from Wikidata",
  lineage: "Predecessor or successor never near it",
  missing: "Missing from the map for some years",
  flicker: "Shape shrinks or grows for a year or two",
  move: "Centre jumps far away",
};
// Names of parties, armies, factions and peoples rather than states.
const NOT_A_STATE_NAME =
  /\b(party|nationalists?|rebels?|coalition|front|army|movement|mujahideen|insurgents?|junta|kuomintang|communists?|militia|warlords?|clique|hamas|taliban|islamic state|free french)\b|^(serbs|tibetans|huns)$/i;
// What a Wikidata item is an instance of, when it is not a state.
const NOT_A_STATE_TYPE =
  /^(human|political party|ethnic group|people|nation|armed organization|militant group|rebel group|paramilitary organization|military unit|guerrilla movement|political movement|war|civil war|battle|conflict|revolution|historical period|era|archaeological culture|family|noble family|royal house|clan|tribe|confederation of tribes|city|human settlement|region|geographic region)$/i;

const { index, shapes } = loadShapes();
const civs = JSON.parse(readFileSync("public/data/civilizations.json", "utf8")).civilizations;
const facts = existsSync(FACTS) ? JSON.parse(readFileSync(FACTS, "utf8")).items : null;
const articles = existsSync(ARTICLES) ? JSON.parse(readFileSync(ARTICLES, "utf8")).articles : null;
/** A realm's article as a page title, as article-items.json keys it. */
const articleTitle = (article) =>
  (/^https?:\/\//.test(article) ? decodeURIComponent(article.replace(/^.*\/wiki\//, "")) : article).replace(/_/g, " ").trim();
/** An article as a page title, so "Kanem-Bornu Empire" and "Kanem–Bornu Empire" or a link to it match. */
const titleOf = (article) =>
  decodeURIComponent(article.replace(/^https?:\/\/en\.wikipedia\.org\/wiki\//, ""))
    .replace(/_/g, " ")
    .replace(/[‐-―]/g, "-")
    .trim()
    .toLowerCase();

const civOfName = new Map();
for (const c of civs) for (const n of c.names ?? [c.name]) civOfName.set(n, c);
const civsOfQid = new Map();
for (const c of civs) if (c.wikidata) civsOfQid.set(c.wikidata, [...(civsOfQid.get(c.wikidata) ?? []), c]);

const byName = new Map();
for (const s of shapes) byName.set(s.name, [...(byName.get(s.name) ?? []), s]);

function km([x1, y1], [x2, y2]) {
  const r = Math.PI / 180;
  const a = Math.sin(((y2 - y1) * r) / 2) ** 2 + Math.cos(y1 * r) * Math.cos(y2 * r) * Math.sin(((x2 - x1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
const yearText = (y) => (y < 0 ? `${-y} BCE` : String(y));
const span = (a, b) => (a === b ? yearText(a) : `${yearText(a)} to ${yearText(b)}`);

const flags = [];
function flag(kind, severity, year, name, text) {
  const civ = civOfName.get(name);
  flags.push({ kind, severity, year, name, region: civ?.continents?.[0] ?? "", text });
}

// Relabel: a realm's last outline is drawn the next year, about the same, under
// another name. Usually a change of regime (Weimar Republic to Nazi Germany);
// a mistake when the new name belongs elsewhere (Don Cossacks to Astrakhan Khanate).
const lastShape = new Map([...byName].map(([n, list]) => [n, list[list.length - 1]]));
const startingIn = new Map();
for (const s of shapes) startingIn.set(s.from, [...(startingIn.get(s.from) ?? []), s]);
for (const a of lastShape.values()) {
  for (const b of startingIn.get(a.to + 1) ?? []) {
    if (b.name === a.name || Math.abs(b.area / a.area - 1) > SAME_AREA || km(a.label, b.label) > SAME_PLACE_KM) continue;
    const before = byName.get(b.name).filter((s) => s.to < b.from);
    const civA = civOfName.get(a.name);
    const civB = civOfName.get(b.name);
    const linked =
      civA?.wikidata &&
      civB?.wikidata &&
      (civA.wikidata === civB.wikidata ||
        (facts && (facts[civB.wikidata]?.before?.[civA.wikidata] !== undefined || facts[civA.wikidata]?.after?.[civB.wikidata] !== undefined)));
    if (before.length) {
      const prev = before[before.length - 1];
      const far = km(prev.label, b.label);
      if (far > JUMP_KM) {
        flag("relabel", "high", b.from, b.name, `${a.name}'s outline is named ${b.name} from ${yearText(b.from)}; ${b.name} was last drawn ${Math.round(far)} km away (${span(prev.from, prev.to)})`);
      } else if (!linked) {
        flag("relabel", "low", b.from, b.name, `${a.name}'s outline is named ${b.name} from ${yearText(b.from)}; ${b.name} was drawn nearby before (${span(before[0].from, prev.to)})`);
      }
    } else if (!linked) {
      flag("relabel", facts ? "medium" : "low", b.from, b.name, `${a.name} becomes ${b.name} in ${yearText(b.from)} with the same outline${facts ? "; Wikidata doesn't link them" : ""}`);
    }
  }
}

// One Wikidata item for realms with different names.
for (const [qid, list] of civsOfQid) {
  if (list.length < 2) continue;
  const label = facts?.[qid]?.label;
  const first = Math.min(...list.map((c) => c.from));
  flag("shared-id", "medium", first, list[0].name, `${qid}${label ? ` (${label})` : ""} is the item of ${list.map((c) => `${c.name} (${span(c.from, c.to)})`).join(", ")}`);
}

// Names of factions and peoples.
for (const c of civs) {
  if (NOT_A_STATE_NAME.test(c.name)) flag("not-a-state", "medium", c.from, c.name, `${c.name} (${span(c.from, c.to)}) reads like a party, army or people`);
}

// Missing for some years, then back: often a state Cliopatria folds into a neighbour.
for (const [name, list] of byName) {
  for (let i = 1; i < list.length; i++) {
    const gap = list[i].from - list[i - 1].to - 1;
    if (gap > 0 && gap <= MAX_GAP) {
      flag("missing", "medium", list[i - 1].to + 1, name, `${name} is not drawn ${span(list[i - 1].to + 1, list[i].from - 1)} (${gap} year${gap > 1 ? "s" : ""}), then comes back`);
    }
  }
}

// A shape that shrinks or grows by half or more for a year or two, then comes back.
for (const [name, list] of byName) {
  for (let i = 1; i + 1 < list.length; i++) {
    const [a, b, c] = [list[i - 1], list[i], list[i + 1]];
    if (b.from !== a.to + 1 || c.from !== b.to + 1 || b.to - b.from > 1) continue;
    const change = b.area / a.area;
    if ((change < 0.5 || change > 2) && Math.abs(c.area / a.area - 1) < 0.2) {
      flag("flicker", "low", b.from, name, `${name} is ${Math.round(change * 100)}% of its size in ${span(b.from, b.to)}, then back`);
    }
  }
}

// The centre moving far from one shape to the next.
for (const [name, list] of byName) {
  for (let i = 1; i < list.length; i++) {
    const d = km(list[i - 1].label, list[i].label);
    if (d > MOVE_KM) flag("move", "low", list[i].from, name, `${name}'s centre moves ${Math.round(d)} km in ${yearText(list[i].from)}`);
  }
}

if (facts) {
  // Land each civilization ever held, on a 1° grid, for the lineage check.
  const { fillRing } = makeGrid(1);
  const cellsOf = new Map();
  const land = (c) => {
    if (!cellsOf.has(c.id)) {
      const names = new Set(c.names ?? [c.name]);
      const cells = new Set();
      for (const s of shapes) if (names.has(s.name) || s.groups?.some((g) => names.has(g))) for (const r of s.rings) fillRing(r, cells);
      cellsOf.set(c.id, cells);
    }
    return cellsOf.get(c.id);
  };
  const norm = (t) =>
    new Set(
      t
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !/^(the|and|kingdom|empire|dynasty|republic|state|states|sultanate|khanate|principality|duchy|county|emirate|caliphate|great|first|second|third|period|people|federal|democratic|socialist|united)$/.test(w)),
    );

  for (const c of civs) {
    const f = c.wikidata && facts[c.wikidata];
    if (!f) continue;

    // The item's label and article against the realm's name and article, and
    // the item Wikipedia gives the realm's article.
    const mine = norm(`${c.name} ${c.wikipedia ?? ""}`);
    const theirs = norm(`${f.label ?? ""} ${f.wikipedia ?? ""}`);
    const article = c.wikipedia && articles?.[articleTitle(c.wikipedia)];
    const articleItem = article && !article.section && !article.disambiguation ? article.item : null;
    if (articleItem && articleItem !== c.wikidata) {
      flag("identity", "high", c.from, c.name, `${c.name}'s article "${c.wikipedia}" is item ${articleItem}, but it links to ${c.wikidata} "${f.label}"`);
    } else if (articleItem) {
      // The article's own item.
    } else if (mine.size && theirs.size && ![...mine].some((w) => theirs.has(w))) {
      flag("identity", "high", c.from, c.name, `${c.name} links to ${c.wikidata} "${f.label}"${f.description ? ` (${f.description})` : ""}`);
    } else if (f.wikipedia && c.wikipedia && titleOf(f.wikipedia) !== titleOf(c.wikipedia)) {
      flag("identity", "low", c.from, c.name, `${c.name}'s article is "${c.wikipedia}" but its item ${c.wikidata} has "${f.wikipedia}"`);
    }
    const odd = Object.values(f.types).filter((t) => t && NOT_A_STATE_TYPE.test(t));
    if (odd.length && !Object.values(f.types).some((t) => /state|country|empire|kingdom|polity|dynasty|monarchy|colony|protectorate/i.test(t ?? ""))) {
      flag("not-a-state", "medium", c.from, c.name, `${c.name}'s item ${c.wikidata} is a ${odd.join(", ")}`);
    }

    // Dates.
    for (const [mineYear, theirYear, what] of [
      [c.from, f.from, "starts"],
      [c.to >= index.to ? null : c.to, f.to, "ends"],
    ]) {
      if (mineYear === null || theirYear === null) continue;
      const d = Math.abs(mineYear - theirYear);
      if (d > DATE_SLACK) {
        flag("dates", d > DATE_FAR ? "high" : "medium", mineYear, c.name, `${c.name} ${what} in ${yearText(mineYear)} on the map, ${yearText(theirYear)} on Wikidata`);
      }
    }

    // Predecessors and successors: they should have shared land and come close in time.
    for (const [dir, links] of [
      ["after", f.after],
      ["before", f.before],
    ]) {
      for (const qid of Object.keys(links)) {
        for (const o of civsOfQid.get(qid) ?? []) {
          if (o === c || o.wikidata === c.wikidata) continue;
          // Each pair once: from the earlier realm's side.
          if (dir === "before" && facts[o.wikidata]?.after?.[c.wikidata] !== undefined) continue;
          const [first, second] = dir === "after" ? [c, o] : [o, c];
          const gap = second.from - first.to;
          const shared = [...land(first)].some((cell) => land(second).has(cell));
          if (!shared) {
            flag("lineage", "high", second.from, second.name, `${first.name} is followed by ${second.name} on Wikidata, but they never held the same land`);
          } else if (gap > LINK_GAP || second.to < first.from) {
            flag("lineage", "medium", second.from, second.name, `${first.name} (${span(first.from, first.to)}) is followed by ${second.name} (${span(second.from, second.to)}) on Wikidata`);
          }
        }
      }
    }
  }
}

// The report.
const eraOf = (y) => ERAS.find(([a, b]) => y >= a && y <= b)[2];
const RANK = { high: 0, medium: 1, low: 2 };
flags.sort((a, b) => a.year - b.year || RANK[a.severity] - RANK[b.severity] || a.name.localeCompare(b.name));
const lines = [
  "# Data audit",
  "",
  "Leads for the review in [data-review.md](../data-review.md), made by `npm run audit` (scripts/audit.mjs). Each is a place to look, not a proven mistake: most relabels, for instance, are real changes of regime.",
  "",
  facts
    ? "Wikidata checks: on (scripts/wikidata-facts.json)."
    : "Wikidata checks: off. Run `node scripts/fetch-wikidata-facts.mjs` where Wikidata can be reached to turn them on.",
  articles
    ? "Articles' own items: on (scripts/article-items.json)."
    : "Articles' own items: off. Run `node scripts/fetch-article-items.mjs` to turn them on.",
  "",
  `| Kind | ${ERAS.map((e) => e[2]).join(" | ")} | All |`,
  `| --- | ${ERAS.map(() => "---:").join(" | ")} | ---: |`,
];
for (const [kind, label] of Object.entries(KINDS)) {
  const mine = flags.filter((f) => f.kind === kind);
  if (!mine.length) continue;
  lines.push(`| ${label} | ${ERAS.map((e) => mine.filter((f) => eraOf(f.year) === e[2]).length || "").join(" | ")} | ${mine.length} |`);
}
lines.push(`| **All** | ${ERAS.map((e) => flags.filter((f) => eraOf(f.year) === e[2]).length || "").join(" | ")} | ${flags.length} |`, "");
for (const [, , era] of ERAS) {
  const inEra = flags.filter((f) => eraOf(f.year) === era);
  if (!inEra.length) continue;
  lines.push(`## ${era}`, "");
  for (const [code, region] of [...Object.entries(REGIONS), ["", "Elsewhere"]]) {
    const here = inEra.filter((f) => f.region === code);
    if (!here.length) continue;
    lines.push(`### ${region}`, "");
    for (const f of here) lines.push(`- **${f.severity}** · ${KINDS[f.kind]}: ${f.text}`);
    lines.push("");
  }
}
mkdirSync("docs/audit", { recursive: true });
writeFileSync(OUT, lines.join("\n"));
const count = (s) => flags.filter((f) => f.severity === s).length;
console.log(`${flags.length} flags (${count("high")} high, ${count("medium")} medium, ${count("low")} low), written to ${OUT}`);
