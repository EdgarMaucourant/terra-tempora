// Events for every civilization, read from Wikidata in the browser: the
// battles, sieges, wars and treaties a realm took part in, the births and
// deaths of its rulers and founders, and the founding of its capitals. Each
// needs an English Wikipedia article, a date and (except wars) a place. Only
// the best-known events of each realm are kept, ranked by how many Wikipedia
// editions cover them. Answers are cached in localStorage.

import type { Civilization } from "./civilizations";
import type { EventKind, HistoryEvent } from "./events";

const SPARQL = "https://query.wikidata.org/sparql";
const CACHE = "history-globe:events:v1:";
// Civilizations asked for in one request.
const BATCH = 6;
// Events kept per civilization, and how many of them may be births and deaths.
const PER_CIV = 24;
const PER_CIV_PEOPLE = 8;

/** One event as cached: tied to the civilization's Wikidata item, not its id. */
interface RawEvent {
  qid: string;
  kind: EventKind;
  year: number;
  to?: number;
  title: string;
  place: string;
  lonLat: [number, number] | null;
  summary: string;
  wikipedia: string;
  links: number;
}

interface Binding {
  civ: { value: string };
  e: { value: string };
  kind: { value: string };
  eLabel?: { value: string };
  desc?: { value: string };
  date?: { value: string };
  end?: { value: string };
  coord?: { value: string };
  placeLabel?: { value: string };
  title: { value: string };
  links: { value: string };
}

function query(qids: string[]): string {
  return `SELECT ?civ ?e ?kind ?eLabel ?desc ?date ?end ?coord ?placeLabel ?title ?links WHERE {
  VALUES ?civ { ${qids.map((q) => `wd:${q}`).join(" ")} }
  {
    { ?e wdt:P710 ?civ } UNION { ?e wdt:P1891 ?civ }
    ?e wdt:P31 ?class. ?class wdt:P279* ?type.
    VALUES (?type ?kind) {
      (wd:Q178561 "battle") (wd:Q188055 "siege") (wd:Q198 "war") (wd:Q831663 "war") (wd:Q131569 "treaty")
    }
    OPTIONAL { ?e wdt:P585 ?d1 }
    OPTIONAL { ?e wdt:P580 ?d2 }
    OPTIONAL { ?e wdt:P582 ?end }
    BIND(COALESCE(?d1, ?d2) AS ?date)
    OPTIONAL { ?e wdt:P625 ?c1 }
    OPTIONAL { ?e wdt:P276 ?place. ?place wdt:P625 ?c2 }
    BIND(COALESCE(?c1, ?c2) AS ?coord)
  } UNION {
    ?civ wdt:P35|wdt:P6|wdt:P112 ?e. ?e wdt:P31 wd:Q5.
    { ?e wdt:P569 ?date; wdt:P19 ?place. BIND("birth" AS ?kind) } UNION
    { ?e wdt:P570 ?date; wdt:P20 ?place. BIND("death" AS ?kind) }
    ?place wdt:P625 ?coord.
  } UNION {
    ?civ wdt:P36 ?e. ?e wdt:P571 ?date; wdt:P625 ?coord. BIND("city" AS ?kind)
  }
  ?article schema:about ?e; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title.
  ?e wikibase:sitelinks ?links.
  OPTIONAL { ?e rdfs:label ?eLabel. FILTER(LANG(?eLabel) = "en") }
  OPTIONAL { ?e schema:description ?desc. FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?place rdfs:label ?placeLabel. FILTER(LANG(?placeLabel) = "en") }
}`;
}

const qidOf = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

/**
 * The year of a Wikidata date. Dates come in astronomical numbering, where
 * 0 is 1 BCE; the app counts BCE years as negatives with no year 0.
 */
export function yearOf(date: string): number | null {
  const m = /^(-?)(\d+)-/.exec(date);
  if (!m) return null;
  const y = Number(m[2]) * (m[1] ? -1 : 1);
  return y <= 0 ? y - 1 : y;
}

/** [longitude, latitude] of a WKT "Point(lon lat)", Earth only. */
function pointOf(wkt: string | undefined): [number, number] | null {
  if (!wkt || wkt.startsWith("<")) return null;
  const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(wkt);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

// When an item matches several kinds, the most specific wins.
const RANK: Record<string, number> = { siege: 5, battle: 4, treaty: 3, war: 2, birth: 1, death: 1, city: 1 };

function titleOf(kind: EventKind, label: string): string {
  if (kind === "birth") return `Birth of ${label}`;
  if (kind === "death") return `Death of ${label}`;
  if (kind === "city") return `Founding of ${label}`;
  return label;
}

function parse(bindings: Binding[]): Map<string, RawEvent[]> {
  // One event per civilization, item and kind (a ruler has a birth and a death).
  const found = new Map<string, RawEvent>();
  for (const b of bindings) {
    const year = b.date && yearOf(b.date.value);
    if (year == null) continue;
    const civ = qidOf(b.civ.value);
    const item = qidOf(b.e.value);
    const kind = b.kind.value as EventKind;
    const people = kind === "birth" || kind === "death";
    const key = `${civ} ${item} ${people ? kind : "event"}`;
    const known = found.get(key);
    if (known && RANK[known.kind] >= RANK[kind]) continue;
    const label = b.eLabel?.value ?? b.title.value;
    const end = b.end && yearOf(b.end.value);
    const summary = b.desc?.value ?? "";
    found.set(key, {
      qid: civ,
      kind,
      year,
      to: end != null && end > year ? end : undefined,
      title: titleOf(kind, label),
      place: b.placeLabel?.value ?? "",
      lonLat: pointOf(b.coord?.value) ?? known?.lonLat ?? null,
      summary: summary && summary[0].toUpperCase() + summary.slice(1) + (/[.!?]$/.test(summary) ? "" : "."),
      wikipedia: b.title.value.replace(/ /g, "_"),
      links: Number(b.links.value),
    });
  }
  const byCiv = new Map<string, RawEvent[]>();
  for (const e of found.values()) {
    const list = byCiv.get(e.qid) ?? [];
    list.push(e);
    byCiv.set(e.qid, list);
  }
  return byCiv;
}

/** The realm's best-known events, within its own years. */
function pick(c: Civilization, raw: RawEvent[]): RawEvent[] {
  const inSpan = raw.filter((e) => {
    if (e.kind === "birth") return e.year >= c.from - 90 && e.year <= c.to;
    if (e.kind === "death" || e.kind === "city") return e.year >= c.from && e.year <= c.to + 1;
    return e.year >= c.from - 1 && e.year <= c.to + 1;
  });
  // Wars range over whole regions; one without a place stands at the realm's heart.
  const placed = inSpan.filter((e) => e.lonLat || (e.kind === "war" && c.center));
  placed.sort((a, b) => b.links - a.links);
  const kept: RawEvent[] = [];
  let people = 0;
  for (const e of placed) {
    if (kept.length >= PER_CIV) break;
    const person = e.kind === "birth" || e.kind === "death";
    if (person && people >= PER_CIV_PEOPLE) continue;
    if (person) people++;
    kept.push(e);
  }
  return kept;
}

function readCache(qid: string): RawEvent[] | undefined {
  try {
    const raw = localStorage.getItem(CACHE + qid);
    return raw ? (JSON.parse(raw) as RawEvent[]) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(qid: string, events: RawEvent[]) {
  try {
    localStorage.setItem(CACHE + qid, JSON.stringify(events));
  } catch {
    // Storage full or blocked; the events are fetched again next visit.
  }
}

const pending = new Map<string, Promise<RawEvent[] | null>>();
// Set once Wikidata proves unreachable, so later views stop asking.
let unreachable = false;

async function fetchBatch(civs: Civilization[]): Promise<Map<string, RawEvent[]>> {
  const qids = civs.map((c) => c.wikidata!);
  const response = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query(qids))}`, {
    headers: { Accept: "application/sparql-results+json" },
  });
  if (!response.ok) throw new Error(`Wikidata answered ${response.status}`);
  const byCiv = parse((await response.json()).results.bindings);
  const result = new Map<string, RawEvent[]>();
  for (const c of civs) {
    const events = pick(c, byCiv.get(c.wikidata!) ?? []);
    writeCache(c.wikidata!, events);
    result.set(c.wikidata!, events);
  }
  return result;
}

function rawEvents(civs: Civilization[]): Promise<RawEvent[] | null>[] {
  const missing = civs.filter((c) => !readCache(c.wikidata!) && !pending.has(c.wikidata!));
  if (!unreachable) {
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const request = fetchBatch(batch).catch((error: unknown) => {
        console.warn("Wikidata could not be reached; only the hand-written events show.", error);
        unreachable = true;
        return null;
      });
      for (const c of batch) {
        const promise = request.then((r) => r?.get(c.wikidata!) ?? null);
        pending.set(c.wikidata!, promise);
        // A failed request may be tried again on a later view.
        promise.then((r) => r ?? pending.delete(c.wikidata!));
      }
    }
  }
  return civs.map((c) => {
    const cached = readCache(c.wikidata!);
    if (cached) return Promise.resolve(cached);
    return pending.get(c.wikidata!) ?? Promise.resolve(null);
  });
}

/**
 * Events of the given civilizations from Wikidata. An event shared by several
 * of them (a battle between two realms) comes once, tied to all of them.
 */
export async function wikidataEvents(civs: Civilization[]): Promise<HistoryEvent[]> {
  const asked = civs.filter((c) => c.wikidata);
  const answers = await Promise.all(rawEvents(asked));
  const events = new Map<string, HistoryEvent>();
  asked.forEach((c, i) => {
    for (const r of answers[i] ?? []) {
      const id = `wd:${r.wikipedia}:${r.kind}`;
      const known = events.get(id);
      if (known) {
        if (!known.civs.includes(c.id)) known.civs.push(c.id);
        continue;
      }
      const atHeart = !r.lonLat;
      events.set(id, {
        id,
        kind: r.kind,
        year: r.year,
        to: r.to,
        title: r.title,
        place: atHeart ? c.name : r.place || c.name,
        lonLat: r.lonLat ?? c.center!,
        approx: atHeart ? `Fought across ${c.name}; shown at its heart` : undefined,
        civs: [c.id],
        summary: r.summary,
        wikipedia: r.wikipedia,
        search: r.title,
        fromWikidata: true,
      });
    }
  });
  return [...events.values()];
}
