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
const BATCH = 150;

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
  for (let i = 0; i < titles.length; i += BATCH) {
    const values = titles
      .slice(i, i + BATCH)
      .map((t) => `${JSON.stringify(t)}@en`)
      .join(" ");
    const item = `VALUES ?title { ${values} }
  ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title.`;
    for (const b of await sparql(`SELECT ?title ?label ?desc WHERE {
  ${item}
  OPTIONAL { ?item rdfs:label ?label. FILTER(LANG(?label) = "${lang}") }
  OPTIONAL { ?item schema:description ?desc. FILTER(LANG(?desc) = "${lang}") }
}`)) {
      if (b.label) label.set(b.title.value, b.label.value);
      if (b.desc) description.set(b.title.value, b.desc.value);
    }
    // Birthplace, place of death, or where it happened.
    for (const b of await sparql(`SELECT ?title ?en ?local WHERE {
  ${item}
  VALUES ?where { wdt:P19 wdt:P20 wdt:P276 }
  ?item ?where ?place.
  ?place rdfs:label ?en, ?local.
  FILTER(LANG(?en) = "en" && LANG(?local) = "${lang}")
}`)) {
      if (!places.has(b.title.value)) places.set(b.title.value, new Map());
      places.get(b.title.value).set(b.en.value, b.local.value);
    }
    console.log(`${lang}: ${Math.min(i + BATCH, titles.length)}/${titles.length}`);
  }

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
