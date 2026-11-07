// Reads from Wikidata what the audit (audit.mjs) needs to know about each
// realm's item, and saves it in scripts/wikidata-facts.json, so the audit runs
// anywhere, even where Wikidata can't be reached: the item's English label,
// description and Wikipedia article, what it is an instance of, its start and
// end years, and the items it replaces or follows and is replaced or followed by.
//
//   node scripts/fetch-wikidata-facts.mjs
//
// Run it again after `npm run data` when realms or their links changed.
// Wikidata is CC0, so the file can be shared with the rest of the data.
import { readFileSync, writeFileSync } from "node:fs";

const SPARQL = "https://query.wikidata.org/sparql";
const AGENT = "terra-tempora/0.1 (https://github.com/EdgarMaucourant/terra-tempora)";
const OUT = "scripts/wikidata-facts.json";
const BATCH = 40;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qidOf = (uri) => uri.slice(uri.lastIndexOf("/") + 1);

/** Wikidata dates are astronomical (0 is 1 BCE); the app has no year 0. */
function yearOf(date) {
  const m = /^(-?)(\d+)-/.exec(date ?? "");
  if (!m) return null;
  const y = Number(m[2]) * (m[1] ? -1 : 1);
  return y <= 0 ? y - 1 : y;
}

/** Runs a query; null when Wikidata ran out of time or cut its answer short. */
async function sparql(text) {
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetch(SPARQL, {
        method: "POST",
        headers: {
          Accept: "application/sparql-results+json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": AGENT,
        },
        body: new URLSearchParams({ query: text }),
        signal: AbortSignal.timeout(75_000),
      });
    } catch (error) {
      if (attempt >= 3) throw error;
      await sleep(5000);
      continue;
    }
    if (response.ok) {
      // A query that runs out of time can still answer 200, with the error
      // written in the middle of the JSON.
      try {
        return JSON.parse(await response.text()).results.bindings;
      } catch {
        return null;
      }
    }
    if (response.status === 500 || response.status === 504) return null;
    if (attempt >= 4) throw new Error(`Wikidata answered ${response.status}`);
    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    await sleep(Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
  }
}

/** Runs a query over some items, halving the list while Wikidata can't cope. */
async function query(make, ids) {
  const rows = await sparql(make(ids));
  if (rows) return rows;
  if (ids.length === 1) {
    console.warn(`\nWikidata could not answer for ${ids[0]}; skipped.`);
    return [];
  }
  await sleep(2000);
  const half = Math.ceil(ids.length / 2);
  return [...(await query(make, ids.slice(0, half))), ...(await query(make, ids.slice(half)))];
}

const values = (ids) => `VALUES ?item { ${ids.map((id) => `wd:${id}`).join(" ")} }`;

const ABOUT = (ids) => `SELECT ?item ?label ?desc ?title WHERE {
  ${values(ids)}
  OPTIONAL { ?item rdfs:label ?label. FILTER(LANG(?label) = "en") }
  OPTIONAL { ?item schema:description ?desc. FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title. }
}`;

// What the item says itself: its types, its dates, what it replaces or follows.
const OWN = (ids) => `SELECT ?item ?kind ?v ?vLabel WHERE {
  ${values(ids)}
  { ?item wdt:P31 ?v. BIND("type" AS ?kind) } UNION
  { ?item wdt:P571|wdt:P580 ?v. BIND("from" AS ?kind) } UNION
  { ?item wdt:P576|wdt:P582 ?v. BIND("to" AS ?kind) } UNION
  { ?item wdt:P1365|wdt:P155 ?v. BIND("before" AS ?kind) } UNION
  { ?item wdt:P1366|wdt:P156 ?v. BIND("after" AS ?kind) }
  OPTIONAL { ?v rdfs:label ?vLabel. FILTER(LANG(?vLabel) = "en") }
}`;

// What other items say of it. "Follows" and "followed by" also chain series
// (elections, seasons, editions...) that can point at a country, so only items
// with a start or an end date of their own, as realms have, are kept.
const OTHERS = (ids) => `SELECT ?item ?kind ?v ?vLabel WHERE {
  ${values(ids)}
  { ?v wdt:P1366|wdt:P156 ?item. BIND("before" AS ?kind) } UNION
  { ?v wdt:P1365|wdt:P155 ?item. BIND("after" AS ?kind) }
  FILTER EXISTS { ?v wdt:P571|wdt:P576 [] }
  OPTIONAL { ?v rdfs:label ?vLabel. FILTER(LANG(?vLabel) = "en") }
}`;

// Every civilization's item: one per realm and one per group of realms.
const civs = JSON.parse(readFileSync("public/data/civilizations.json", "utf8")).civilizations;
const ids = [...new Set(civs.map((c) => c.wikidata).filter((q) => typeof q === "string" && /^Q\d+$/.test(q)))];
ids.sort();

const facts = {};
for (let i = 0; i < ids.length; i += BATCH) {
  const batch = ids.slice(i, i + BATCH);
  for (const id of batch) facts[id] = { label: null, description: null, wikipedia: null, types: {}, from: null, to: null, before: {}, after: {} };
  for (const b of await query(ABOUT, batch)) {
    const f = facts[qidOf(b.item.value)];
    if (!f) continue;
    if (b.label) f.label = b.label.value;
    if (b.desc) f.description = b.desc.value;
    if (b.title) f.wikipedia = b.title.value;
  }
  for (const b of [...(await query(OWN, batch)), ...(await query(OTHERS, batch))]) {
    const f = facts[qidOf(b.item.value)];
    if (!f) continue;
    const kind = b.kind.value;
    const value = b.v.value;
    if (kind === "from" || kind === "to") {
      const y = yearOf(value);
      if (y === null) continue;
      // Several dates: the earliest start and the latest end.
      if (kind === "from") f.from = f.from === null ? y : Math.min(f.from, y);
      else f.to = f.to === null ? y : Math.max(f.to, y);
    } else if (value.startsWith("http://www.wikidata.org/entity/Q")) {
      f[kind === "type" ? "types" : kind][qidOf(value)] = b.vLabel?.value ?? null;
    }
  }
  process.stdout.write(`\r${Math.min(i + BATCH, ids.length)} of ${ids.length} items`);
  await sleep(1000);
}
console.log();
writeFileSync(OUT, `${JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), items: facts }, null, 1)}\n`);
console.log(`Saved ${OUT}`);
