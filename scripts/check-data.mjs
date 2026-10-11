// Checks the data files and the interface translations before they are
// published: ids are unique and point at things that exist, years and places
// are numbers in range, every event has a known kind, and translations match
// the English they translate. Run by `npm run check` and on every pull request.
// Prints each problem and exits with an error if there is any.
import { existsSync, readdirSync, readFileSync } from "node:fs";

const DATA = "public/data";
const errors = [];
const warnings = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);

function read(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(path, `cannot be read as JSON (${error.message})`);
    return null;
  }
}

const isYear = (y) => Number.isInteger(y) && y >= -12000 && y <= new Date().getFullYear();
const isText = (s) => typeof s === "string" && s.trim() !== "";
const isLonLat = (p) =>
  Array.isArray(p) && p.length === 2 && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90 && p.every(Number.isFinite);

// The event kinds, as listed in src/events.ts.
const kindSource = readFileSync("src/events.ts", "utf8").match(/export type EventKind =([^;]+);/)[1];
const KINDS = new Set([...kindSource.matchAll(/"(\w+)"/g)].map((m) => m[1]));

/** Ids appear once each; returns them as a set. */
function uniqueIds(where, items) {
  const ids = new Set();
  for (const item of items) {
    if (!isText(item.id)) fail(where, `an item has no id (${JSON.stringify(item).slice(0, 60)}…)`);
    else if (ids.has(item.id)) fail(where, `id "${item.id}" is used twice`);
    ids.add(item.id);
  }
  return ids;
}

function checkYears(where, item) {
  if (!isYear(item.year)) fail(where, `"${item.id}" has no valid year`);
  if (item.to !== undefined && (!isYear(item.to) || item.to < item.year)) fail(where, `"${item.id}" ends before it starts`);
}

// Border windows
const index = read(`${DATA}/index.json`);
for (const w of index?.windows ?? []) {
  if (!existsSync(`${DATA}/${w.file}`)) fail("index.json", `window file ${w.file} is missing`);
  if (w.from > w.to) fail("index.json", `window ${w.file} ends before it starts`);
}

// Civilizations and their outlines
const civs = read(`${DATA}/civilizations.json`)?.civilizations ?? [];
const civIds = uniqueIds("civilizations.json", civs);
for (const c of civs) {
  if (!/^[a-z0-9-]+$/.test(c.id)) fail("civilizations.json", `id "${c.id}" is not lowercase letters, digits and dashes`);
  if (!isText(c.name)) fail("civilizations.json", `"${c.id}" has no name`);
  if (!Number.isInteger(c.from) || !Number.isInteger(c.to) || c.from > c.to) fail("civilizations.json", `"${c.id}" has bad years`);
  if (c.center !== null && !isLonLat(c.center)) fail("civilizations.json", `"${c.id}" has a bad centre`);
}
const outlines = read(`${DATA}/civilization-shapes.json`) ?? {};
for (const id of civIds) if (!outlines[id]) fail("civilization-shapes.json", `no outline for "${id}"`);
for (const id of Object.keys(outlines)) if (!civIds.has(id)) fail("civilization-shapes.json", `outline for unknown "${id}"`);

// Hand-written events and the history travel's turning points
function checkEvents(file, fields, needCivs) {
  const events = read(`${DATA}/${file}`)?.events ?? [];
  const ids = uniqueIds(file, events);
  for (const e of events) {
    checkYears(file, e);
    if (!KINDS.has(e.kind)) fail(file, `"${e.id}" has unknown kind "${e.kind}"`);
    if (!isLonLat(e.lonLat)) fail(file, `"${e.id}" has no valid place [longitude, latitude]`);
    for (const f of fields) if (!isText(e[f])) fail(file, `"${e.id}" has no ${f}`);
    if (needCivs && !e.civs?.length) fail(file, `"${e.id}" belongs to no civilization`);
    for (const id of e.civs ?? []) if (!civIds.has(id)) fail(file, `"${e.id}" names unknown civilization "${id}"`);
  }
  return ids;
}
const eventIds = checkEvents("events.json", ["title", "place", "summary", "wikipedia", "search"], true);
const travelIds = checkEvents("travel.json", ["title", "place", "region", "short", "summary", "legacy", "wikipedia", "search"], false);

// Countries
const countries = read(`${DATA}/countries.json`)?.countries ?? [];
const countryIds = uniqueIds("countries.json", countries);
for (const k of countries) {
  for (const id of [k.civ, k.focus, ...k.lineage, ...k.territory]) {
    if (!civIds.has(id)) fail("countries.json", `"${k.id}" names unknown civilization "${id}"`);
  }
}

// Documentaries, each on a known platform and about things that exist
const PLATFORMS = new Set([...readFileSync("src/documentaries.ts", "utf8").match(/export type Platform =([^;]+);/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
// US TV Parental Guidelines or MPA film ratings; France's signalétique (or the ages Netflix and Disney+ show in France).
const RATINGS = { us: /^(TV-(Y|Y7|G|PG|14|MA)|G|PG|PG-13|R|NC-17|NR)$/, fr: /^(TP|-10|-12|-16|-18|\d{1,2}\+)$/ };
const documentaries = read(`${DATA}/documentaries.json`)?.documentaries ?? [];
uniqueIds("documentaries.json", documentaries);
for (const d of documentaries) {
  const where = "documentaries.json";
  if (!PLATFORMS.has(d.platform)) fail(where, `"${d.id}" is on unknown platform "${d.platform}"`);
  if (!isText(d.title)) fail(where, `"${d.id}" has no title`);
  if (!/^https:\/\//.test(d.url ?? "")) fail(where, `"${d.id}" needs an https link`);
  if (d.year !== undefined && !isYear(d.year)) fail(where, `"${d.id}" has a bad year`);
  for (const id of d.civs ?? []) if (!civIds.has(id)) fail(where, `"${d.id}" names unknown civilization "${id}"`);
  for (const id of d.events ?? []) if (!eventIds.has(id) && !travelIds.has(id)) fail(where, `"${d.id}" names unknown event "${id}"`);
  for (const id of d.countries ?? []) if (!countryIds.has(id)) fail(where, `"${d.id}" names unknown country "${id}"`);
  for (const [region, rating] of Object.entries(d.ratings ?? {})) {
    if (!RATINGS[region]) fail(where, `"${d.id}" has a rating for unknown country "${region}"`);
    else if (!RATINGS[region].test(rating)) fail(where, `"${d.id}" has an unknown ${region} rating "${rating}"`);
  }
  if (!d.civs?.length && !d.events?.length && !d.countries?.length) fail(where, `"${d.id}" is not tied to anything`);
}

// Events saved from Wikidata, in shards by civilization id (as in src/wikiEvents.ts)
const SHARDS = 16;
function shardOf(id) {
  let h = 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h % SHARDS;
}
const wdIds = new Map();
for (let n = 0; n < SHARDS; n++) {
  const file = `wd-events/${n}.json`;
  if (!existsSync(`${DATA}/${file}`)) continue;
  const ids = new Set();
  wdIds.set(file, ids);
  for (const [civ, events] of Object.entries(read(`${DATA}/${file}`) ?? {})) {
    if (!civIds.has(civ)) fail(file, `unknown civilization "${civ}"`);
    else if (shardOf(civ) !== n) fail(file, `"${civ}" belongs in wd-events/${shardOf(civ)}.json`);
    for (const e of events) {
      const id = `wd:${e.wikipedia}:${e.kind}`;
      ids.add(id);
      checkYears(file, { ...e, id });
      if (!KINDS.has(e.kind)) fail(file, `"${id}" has unknown kind "${e.kind}"`);
      if (e.lonLat !== null && !isLonLat(e.lonLat)) fail(file, `"${id}" has a bad place`);
      if (!isText(e.title)) fail(file, `"${id}" has no title`);
    }
  }
}

// Translated data: public/data/i18n/<lang>/<file>, text by item id
const TRANSLATABLE = {
  "events.json": { ids: eventIds, fields: ["title", "place", "summary", "approx"] },
  "travel.json": { ids: travelIds, fields: ["title", "place", "region", "short", "summary", "legacy", "approx"] },
  "countries.json": { ids: countryIds, fields: ["name", "blurb"] },
  "civilizations.json": { ids: civIds, fields: ["name"] },
};
for (const [file, ids] of wdIds) TRANSLATABLE[file] = { ids, fields: ["title", "place", "summary"] };

const localeCodes = readdirSync("src/locales").map((f) => f.replace(/\.json$/, ""));
if (existsSync(`${DATA}/i18n`)) {
  for (const lang of readdirSync(`${DATA}/i18n`)) {
    if (!localeCodes.includes(lang)) fail(`i18n/${lang}`, `no interface translation src/locales/${lang}.json for this language`);
    const files = readdirSync(`${DATA}/i18n/${lang}`, { recursive: true }).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const where = `i18n/${lang}/${file}`;
      const rule = TRANSLATABLE[file.replaceAll("\\", "/")];
      if (!rule) {
        fail(where, `is not a translatable data file (${Object.keys(TRANSLATABLE).slice(0, 3).join(", ")}, …)`);
        continue;
      }
      for (const [id, text] of Object.entries(read(`${DATA}/${where}`) ?? {})) {
        if (!rule.ids.has(id)) fail(where, `translates unknown item "${id}"`);
        for (const [field, value] of Object.entries(text)) {
          if (!rule.fields.includes(field)) fail(where, `"${id}" translates "${field}", which is not text (${rule.fields.join(", ")})`);
          else if (!isText(value)) fail(where, `"${id}" has an empty ${field}`);
        }
      }
    }
  }
}

// Civilization names must stay unique in every language: the app tells realms apart by name.
for (const lang of existsSync(`${DATA}/i18n`) ? readdirSync(`${DATA}/i18n`) : []) {
  const file = `${DATA}/i18n/${lang}/civilizations.json`;
  if (!existsSync(file)) continue;
  const names = read(file) ?? {};
  const seen = new Map();
  for (const c of civs) {
    const name = names[c.id]?.name ?? c.name;
    if (seen.has(name)) fail(`i18n/${lang}/civilizations.json`, `"${c.id}" and "${seen.get(name)}" are both named "${name}"`);
    seen.set(name, c.id);
  }
}

// Interface translations: src/locales/<lang>.json against English
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const forms = (m) => (typeof m === "string" ? [m] : Object.values(m));
const en = read("src/locales/en.json") ?? {};
const languages = readFileSync("src/i18n.ts", "utf8");
for (const code of localeCodes) {
  const where = `src/locales/${code}.json`;
  if (!languages.includes(`code: "${code}"`)) fail(where, `"${code}" is not listed in LANGUAGES in src/i18n.ts`);
  if (code === "en") continue;
  const messages = read(where) ?? {};
  for (const key of Object.keys(messages)) if (!(key in en)) fail(where, `"${key}" is not an English message`);
  for (const [key, english] of Object.entries(en)) {
    const message = messages[key];
    if (message === undefined) {
      warn(where, `"${key}" is not translated yet; English shows instead`);
      continue;
    }
    if ((typeof message === "string") !== (typeof english === "string")) {
      fail(where, `"${key}" must be ${typeof english === "string" ? "text" : "plural forms like the English"}`);
      continue;
    }
    if (typeof message === "object" && !message.other) fail(where, `"${key}" needs an "other" plural form`);
    // A translation may leave a placeholder out, but not use one the English lacks.
    const known = new Set(forms(english).flatMap(placeholders));
    for (const form of forms(message)) {
      if (!isText(form)) fail(where, `"${key}" is empty`);
      for (const name of placeholders(form)) {
        if (!known.has(name)) fail(where, `"${key}" uses {${name}}, which the English does not have`);
      }
    }
  }
}

for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`error    ${e}`);
console.log(`${errors.length} errors, ${warnings.length} warnings`);
if (errors.length) process.exit(1);
