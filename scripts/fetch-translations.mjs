// Reads the Wikidata events' titles, places and descriptions in other
// languages and saves them as translations: public/data/i18n/<lang>/wd-events/,
// one file per shard of public/data/wd-events/, by event id (see
// src/wikiEvents.ts). Run after scripts/fetch-events.mjs.
//
//   node scripts/fetch-translations.mjs [lang …]     (default: every language but English)
//
// An event's item is found from its English Wikipedia article. A title,
// place or description Wikidata lacks in a language is left out, so the app
// shows the English one.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const SPARQL = "https://query.wikidata.org/sparql";
const AGENT = "terra-tempora/0.1 (https://github.com/EdgarMaucourant/terra-tempora)";
const EVENTS = "public/data/wd-events";
const OUT = "public/data/i18n";
const BATCH = 60;
// Queries run at once; Wikidata allows five per client.
const PARALLEL = 3;

// Titles of the events named after a person or a city, as in fetch-events.mjs.
const TITLES = {
  fr: {
    birth: (name) => `Naissance ${de(name)}`,
    death: (name) => `Mort ${de(name)}`,
    city: (name) => `Fondation ${de(name)}`,
  },
};

/** French "de", elided or contracted: d’Alexandre, du Havre, des Baux, de Paris. */
function de(name) {
  if (/^Le /.test(name)) return `du ${name.slice(3)}`;
  if (/^Les /.test(name)) return `des ${name.slice(4)}`;
  if (/^[AEIOUYÀÂÄÉÈÊËÎÏÔÖÛÜ]/i.test(name)) return `d’${name}`;
  return `de ${name}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Timeout extends Error {}

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
      // A query stopped after 60 s can still answer 200, with an error in place of the end of the JSON.
      const body = await response.text();
      try {
        return JSON.parse(body).results.bindings;
      } catch {
        throw new Timeout("Wikidata stopped the query");
      }
    }
    if ([500, 502, 504].includes(response.status)) throw new Timeout(`Wikidata answered ${response.status}`);
    if (attempt >= 4) throw new Error(`Wikidata answered ${response.status}`);
    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    await sleep(Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
  }
}

/** Runs a query over a list of articles; a list that times out is split in two. */
async function perArticles(articles, make) {
  try {
    return await sparql(make(articles));
  } catch (error) {
    if (!(error instanceof Timeout)) throw error;
    if (articles.length === 1) {
      console.warn(`  skipped ${articles[0]}: ${error.message}`);
      return [];
    }
    const half = Math.ceil(articles.length / 2);
    return [...(await perArticles(articles.slice(0, half), make)), ...(await perArticles(articles.slice(half), make))];
  }
}

function sentence(text) {
  return text && text[0].toUpperCase() + text.slice(1) + (/[.!?]$/.test(text) ? "" : ".");
}

const locales = readdirSync("src/locales").map((f) => f.replace(/\.json$/, "")).filter((l) => l !== "en");
const asked = process.argv.slice(2);
const langs = asked.length ? asked : locales;

const shardFiles = readdirSync(EVENTS).filter((f) => /^\d+\.json$/.test(f));
const shards = shardFiles.map((f) => ({ file: f, data: JSON.parse(readFileSync(`${EVENTS}/${f}`, "utf8")) }));
const titles = [...new Set(shards.flatMap((s) => Object.values(s.data).flat().map((e) => e.wikipedia.replace(/_/g, " "))))];
console.log(`${titles.length} articles in ${shards.length} files.`);

for (const lang of langs) {
  const label = new Map();
  const description = new Map();
  // English place name → name in this language, by article.
  const places = new Map();
  const item = (articles) => `VALUES ?title { ${articles.map((t) => `${JSON.stringify(t)}@en`).join(" ")} }
  ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title.`;
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < titles.length) {
      const batch = titles.slice(next, next + BATCH);
      next += BATCH;
      const names = await perArticles(
        batch,
        (articles) => `SELECT ?title ?label ?desc WHERE {
  ${item(articles)}
  OPTIONAL { ?item rdfs:label ?label. FILTER(LANG(?label) = "${lang}") }
  OPTIONAL { ?item schema:description ?desc. FILTER(LANG(?desc) = "${lang}") }
}`,
      );
      for (const b of names) {
        if (b.label) label.set(b.title.value, b.label.value);
        if (b.desc) description.set(b.title.value, b.desc.value);
      }
      // Birthplace, place of death, or where it happened.
      const where = await perArticles(
        batch,
        (articles) => `SELECT ?title ?en ?local WHERE {
  ${item(articles)}
  ?item wdt:P19|wdt:P20|wdt:P276 ?place.
  ?place rdfs:label ?en. FILTER(LANG(?en) = "en")
  ?place rdfs:label ?local. FILTER(LANG(?local) = "${lang}")
}`,
      );
      for (const b of where) {
        if (!places.has(b.title.value)) places.set(b.title.value, new Map());
        places.get(b.title.value).set(b.en.value, b.local.value);
      }
      done += batch.length;
      console.log(`${lang}: ${done}/${titles.length}`);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  mkdirSync(`${OUT}/${lang}/wd-events`, { recursive: true });
  let count = 0;
  for (const { file, data } of shards) {
    const out = {};
    for (const events of Object.values(data)) {
      for (const e of events) {
        const article = e.wikipedia.replace(/_/g, " ");
        const name = label.get(article);
        const template = TITLES[lang]?.[e.kind];
        const text = {};
        if (name) text.title = template ? template(name) : name[0].toUpperCase() + name.slice(1);
        const place = e.place && places.get(article)?.get(e.place);
        if (place) text.place = place;
        const desc = description.get(article);
        if (desc) text.summary = sentence(desc);
        // Named after a person or city but Wikidata lacks the name: English throughout.
        if (template && !name) continue;
        if (Object.keys(text).length) out[`wd:${e.wikipedia}:${e.kind}`] = text;
      }
    }
    count += Object.keys(out).length;
    const path = `${OUT}/${lang}/wd-events/${file}`;
    if (Object.keys(out).length || existsSync(path)) writeFileSync(path, JSON.stringify(out));
  }
  console.log(`${lang}: saved text for ${count} events in ${OUT}/${lang}/wd-events/.`);
}
