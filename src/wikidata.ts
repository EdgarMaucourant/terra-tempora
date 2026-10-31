// Pictures, key figures and predecessor/successor links for each realm, read
// from Wikidata and Wikimedia Commons in the browser as cards come into view.
// Every picture on Commons is freely licensed; its author and licence are kept
// for the credit line. When the item has no picture, coat of arms or flag,
// the picture chosen from the realm's Wikipedia article is used instead (see
// scripts/fetch-pictures.mjs). Answers are cached in localStorage. When
// Wikimedia cannot be reached, cards fall back to the realm's outline.

import { t } from "./i18n";
import { store, stored } from "./storage";

export interface Picture {
  /** Commons file name, without "File:". */
  file: string;
  thumb: string;
  /** The file's page on Commons, which carries the full licence. */
  page: string;
  artist: string;
  license: string;
  /** A photo or painting fills the card; a coat of arms or flag is shown whole. */
  kind?: "photo" | "emblem";
}

/** Author and licence for a credit line, e.g. "Jane Doe, CC BY-SA 4.0". */
export function pictureCredit(picture: Picture): string {
  return [picture.artist || "Wikimedia Commons", picture.license].filter(Boolean).join(", ");
}

/** Tooltip for a credit line: the file, author and licence, and where the link goes. */
export function pictureTitle(picture: Picture): string {
  return t("picture.title", { file: picture.file, credit: [picture.artist, picture.license].filter(Boolean).join(", ") || "Wikimedia Commons" });
}

export interface RealmFacts {
  picture: Picture | null;
  /** One or two notable people: founders first, then heads of state, then other significant people. */
  figures: string[];
  /**
   * Wikidata items this realm replaced or followed. Links are read from both
   * ends, since Wikidata often records them on one side only: an item that
   * says it replaced this realm counts as after it, and the other way round.
   */
  before: string[];
  /** Wikidata items that replaced or followed this realm. */
  after: string[];
}

const SPARQL = "https://query.wikidata.org/sparql";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const CACHE = "terra-tempora:facts:v4:";
const BATCH = 30;
const THUMB_WIDTH = 480;

interface Binding {
  item: { value: string };
  kind: { value: string };
  v: { value: string };
  vLabel?: { value: string };
  links?: { value: string };
}

// Maps already show on every card as the realm's outline, so a picture of a
// place, monument or artefact is preferred to a map, then the coat of arms or flag.
export const MAP_LIKE = /\b(map|maps|locator|location|extent|territor|orthographic|borders?)\b|karte|carte|mapa/i;

function chooseFile(d: { images: string[]; arms: string[]; flags: string[] }): string | undefined {
  return d.images.find((f) => !MAP_LIKE.test(f.replace(/[_.-]/g, " "))) ?? d.arms[0] ?? d.flags[0];
}

const qidOf = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A saved answer, or undefined when there is none (or it is damaged); then it is fetched again. */
function readJson<T>(key: string): T | undefined {
  try {
    const raw = stored(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function query(ids: string[]): string {
  const people = (prop: string, kind: string) =>
    `{ ?item wdt:${prop} ?v. ?v wdt:P31 wd:Q5. BIND("${kind}" AS ?kind) }`;
  return `SELECT ?item ?kind ?v ?vLabel ?links WHERE {
  VALUES ?item { ${ids.map((id) => `wd:${id}`).join(" ")} }
  { ?item wdt:P18 ?v. BIND("image" AS ?kind) } UNION
  { ?item wdt:P41 ?v. BIND("flag" AS ?kind) } UNION
  { ?item wdt:P94 ?v. BIND("arms" AS ?kind) } UNION
  ${people("P112", "founder")} UNION
  ${people("P35", "head")} UNION
  ${people("P6", "head")} UNION
  ${people("P3342", "notable")} UNION
  { ?item wdt:P1365|wdt:P155 ?v. BIND("before" AS ?kind) } UNION
  { ?item wdt:P1366|wdt:P156 ?v. BIND("after" AS ?kind) } UNION
  { ?v wdt:P1366|wdt:P156 ?item. BIND("before" AS ?kind) } UNION
  { ?v wdt:P1365|wdt:P155 ?item. BIND("after" AS ?kind) }
  OPTIONAL { ?v wikibase:sitelinks ?links }
  OPTIONAL { ?v rdfs:label ?vLabel. FILTER(LANG(?vLabel) = "en") }
}`;
}

async function fetchPictures(files: string[]): Promise<Map<string, Picture>> {
  const pictures = new Map<string, Picture>();
  for (let i = 0; i < files.length; i += 50) {
    const titles = files.slice(i, i + 50).map((f) => `File:${f}`);
    const params = new URLSearchParams({
      action: "query",
      titles: titles.join("|"),
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiextmetadatafilter: "Artist|LicenseShortName",
      iiurlwidth: String(THUMB_WIDTH),
      format: "json",
      formatversion: "2",
      origin: "*",
    });
    const response = await fetch(`${COMMONS}?${params}`);
    if (!response.ok) throw new Error(`Commons answered ${response.status}`);
    const json = await response.json();
    // Commons normalizes titles (underscores to spaces and so on).
    const normalized = new Map<string, string>(
      (json.query?.normalized ?? []).map((n: { from: string; to: string }) => [n.to, n.from]),
    );
    for (const page of json.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl) continue;
      const title: string = normalized.get(page.title) ?? page.title;
      const meta = info.extmetadata ?? {};
      pictures.set(title.replace(/^File:/, ""), {
        file: page.title.replace(/^File:/, ""),
        thumb: info.thumburl,
        page: info.descriptionurl,
        artist: meta.Artist ? stripHtml(meta.Artist.value) : "",
        license: meta.LicenseShortName?.value ?? "",
      });
    }
  }
  return pictures;
}

/** Facts for these items; `fallbacks` holds the Commons file to show for an item Wikidata has no picture for. */
async function fetchFacts(ids: string[], fallbacks: Map<string, string>): Promise<Map<string, RealmFacts>> {
  const response = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query(ids))}`, {
    headers: { Accept: "application/sparql-results+json" },
  });
  if (!response.ok) throw new Error(`Wikidata answered ${response.status}`);
  const bindings: Binding[] = (await response.json()).results.bindings;

  interface Draft {
    images: string[];
    arms: string[];
    flags: string[];
    founders: Map<string, number>;
    heads: Map<string, number>;
    notables: Map<string, number>;
    before: Set<string>;
    after: Set<string>;
  }
  const drafts = new Map<string, Draft>();
  for (const id of ids) {
    drafts.set(id, { images: [], arms: [], flags: [], founders: new Map(), heads: new Map(), notables: new Map(), before: new Set(), after: new Set() });
  }
  for (const b of bindings) {
    const d = drafts.get(qidOf(b.item.value));
    if (!d) continue;
    const value = b.v.value;
    const links = Number(b.links?.value ?? 0);
    switch (b.kind.value) {
      case "image":
      case "arms":
      case "flag": {
        const file = decodeURIComponent(value.slice(value.lastIndexOf("/") + 1));
        (b.kind.value === "image" ? d.images : b.kind.value === "arms" ? d.arms : d.flags).push(file);
        break;
      }
      case "founder":
      case "head":
      case "notable": {
        const kind = b.kind.value;
        const into = kind === "founder" ? d.founders : kind === "head" ? d.heads : d.notables;
        // Unlabelled people come back as their item URI; leave them out.
        if (b.vLabel && !/^Q\d+$/.test(b.vLabel.value)) into.set(b.vLabel.value, links);
        break;
      }
      case "before":
        d.before.add(qidOf(value));
        break;
      case "after":
        d.after.add(qidOf(value));
        break;
    }
  }

  const fileOf = (id: string, d: Draft) => chooseFile(d) ?? fallbacks.get(id);
  const wanted = [...drafts].map(([id, d]) => fileOf(id, d)).filter((f): f is string => !!f);
  const pictures = wanted.length ? await fetchPictures(wanted) : new Map<string, Picture>();

  const byFame = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const facts = new Map<string, RealmFacts>();
  for (const [id, d] of drafts) {
    const file = fileOf(id, d);
    const figures = [...new Set([...byFame(d.founders), ...byFame(d.heads), ...byFame(d.notables)])].slice(0, 2);
    const picture = (file && pictures.get(file.replace(/_/g, " "))) || (file && pictures.get(file)) || null;
    facts.set(id, {
      // Wikipedia's pictures are photos or paintings unless drawn (SVG), like a flag.
      picture: picture && { ...picture, kind: d.images.includes(file!) || (!chooseFile(d) && !/\.svg$/i.test(file!)) ? "photo" : "emblem" },
      figures,
      before: [...d.before],
      after: [...d.after],
    });
  }
  return facts;
}

const pending = new Map<string, { promise: Promise<RealmFacts | null>; resolve: (f: RealmFacts | null) => void; fallback?: string }>();
let queue: string[] = [];
let timer = 0;
let running = false;
// Set once Wikimedia proves unreachable, so the rest of the cards stop waiting.
let unreachable = false;

async function drain() {
  if (running) return;
  running = true;
  while (queue.length) {
    const ids = queue.splice(0, BATCH);
    try {
      const fallbacks = new Map<string, string>();
      for (const id of ids) {
        const fallback = pending.get(id)?.fallback;
        if (fallback) fallbacks.set(id, fallback);
      }
      const facts = await fetchFacts(ids, fallbacks);
      for (const id of ids) {
        const f = facts.get(id) ?? null;
        if (f) store(CACHE + id, JSON.stringify(f));
        pending.get(id)?.resolve(f);
      }
    } catch (error) {
      console.warn("Wikimedia could not be reached; cards show outlines instead.", error);
      unreachable = true;
      for (const id of [...ids, ...queue]) pending.get(id)?.resolve(null);
      queue = [];
    }
  }
  running = false;
}

/**
 * Facts about a Wikidata item, or null when Wikimedia cannot be reached.
 * `fallback` is a Commons file to show when the item has no picture of its own.
 */
export function realmFacts(qid: string, fallback?: string): Promise<RealmFacts | null> {
  const cached = readJson<RealmFacts>(CACHE + qid);
  if (cached) return Promise.resolve(cached);
  const known = pending.get(qid);
  if (known) return known.promise;
  if (unreachable) return Promise.resolve(null);
  let resolve!: (f: RealmFacts | null) => void;
  const promise = new Promise<RealmFacts | null>((r) => (resolve = r));
  pending.set(qid, { promise, resolve, fallback });
  queue.push(qid);
  clearTimeout(timer);
  // Cards scrolled into view together share one request.
  timer = window.setTimeout(drain, 120);
  return promise;
}

const FLAGS = "terra-tempora:flags:v1";

/**
 * Today's flag of each Wikidata item, as a small Commons picture, keyed by
 * item. One request covers every nation; the answer is cached. Empty when
 * Wikimedia cannot be reached.
 */
export async function nationFlags(qids: string[]): Promise<Map<string, string>> {
  const cached = readJson<Record<string, string>>(FLAGS);
  if (cached) return new Map(Object.entries(cached));
  // wdt:P41 keeps only the best-ranked flag, which is the one flown today.
  const sparql = `SELECT ?item ?flag WHERE { VALUES ?item { ${qids.map((id) => `wd:${id}`).join(" ")} } ?item wdt:P41 ?flag. }`;
  const flags = new Map<string, string>();
  try {
    const response = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(sparql)}`, {
      headers: { Accept: "application/sparql-results+json" },
    });
    if (!response.ok) throw new Error(`Wikidata answered ${response.status}`);
    const bindings: { item: { value: string }; flag: { value: string } }[] = (await response.json()).results.bindings;
    for (const b of bindings) {
      const qid = qidOf(b.item.value);
      if (flags.has(qid)) continue;
      // The value is a Special:FilePath URL; asking for a width gets a thumbnail.
      flags.set(qid, `${b.flag.value.replace(/^http:/, "https:")}?width=120`);
    }
  } catch (error) {
    console.warn("Wikidata could not be reached; nations show outlines instead.", error);
    return flags;
  }
  store(FLAGS, JSON.stringify(Object.fromEntries(flags)));
  return flags;
}
