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
const BATCH = 60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qidOf = (uri) => uri.slice(uri.lastIndexOf("/") + 1);

/** Wikidata dates are astronomical (0 is 1 BCE); the app has no year 0. */
function yearOf(date) {
  const m = /^(-?)(\d+)-/.exec(date ?? "");
  if (!m) return null;
  const y = Number(m[2]) * (m[1] ? -1 : 1);
  return y <= 0 ? y - 1 : y;
}

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
    if (response.ok) return (await response.json()).results.bindings;
    if (attempt >= 4) throw new Error(`Wikidata answered ${response.status}`);
    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    await sleep(Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
  }
}

const QUERY = (ids) => `SELECT ?item ?kind ?v ?vLabel ?label ?desc ?title WHERE {
  VALUES ?item { ${ids.map((id) => `wd:${id}`).join(" ")} }
  OPTIONAL { ?item rdfs:label ?label. FILTER(LANG(?label) = "en") }
  OPTIONAL { ?item schema:description ?desc. FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title. }
  OPTIONAL {
    { ?item wdt:P31 ?v. BIND("type" AS ?kind) } UNION
    { ?item wdt:P571|wdt:P580 ?v. BIND("from" AS ?kind) } UNION
    { ?item wdt:P576|wdt:P582 ?v. BIND("to" AS ?kind) } UNION
    { ?item wdt:P1365|wdt:P155 ?v. BIND("before" AS ?kind) } UNION
    { ?item wdt:P1366|wdt:P156 ?v. BIND("after" AS ?kind) } UNION
    { ?v wdt:P1366|wdt:P156 ?item. BIND("before" AS ?kind) } UNION
    { ?v wdt:P1365|wdt:P155 ?item. BIND("after" AS ?kind) }
  }
  OPTIONAL { ?v rdfs:label ?vLabel. FILTER(LANG(?vLabel) = "en") }
}`;

// Every civilization's item: one per realm and one per group of realms.
const civs = JSON.parse(readFileSync("public/data/civilizations.json", "utf8")).civilizations;
const ids = [...new Set(civs.map((c) => c.wikidata).filter((q) => typeof q === "string" && /^Q\d+$/.test(q)))];
ids.sort();

const facts = {};
for (let i = 0; i < ids.length; i += BATCH) {
  const batch = ids.slice(i, i + BATCH);
  const rows = await sparql(QUERY(batch));
  for (const id of batch) facts[id] = { label: null, description: null, wikipedia: null, types: {}, from: null, to: null, before: {}, after: {} };
  for (const b of rows) {
    const f = facts[qidOf(b.item.value)];
    if (!f) continue;
    if (b.label) f.label = b.label.value;
    if (b.desc) f.description = b.desc.value;
    if (b.title) f.wikipedia = b.title.value;
    if (!b.kind) continue;
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
