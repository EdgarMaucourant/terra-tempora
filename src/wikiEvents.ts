// Events for every civilization without hand-written ones: battles, sieges,
// wars and treaties, rulers' births and deaths, and capitals founded, read
// from Wikidata by scripts/fetch-events.mjs and saved in public/data/wd-events/
// in 16 files, so only the files of the civilizations on show are loaded.

import type { Civilization } from "./civilizations";
import type { EventKind, HistoryEvent } from "./events";
import { t, textFor } from "./i18n";

// Kept in step with scripts/fetch-events.mjs.
const SHARDS = 16;

interface SavedEvent {
  kind: EventKind;
  year: number;
  to?: number;
  title: string;
  place?: string;
  lonLat: [number, number] | null;
  summary?: string;
  wikipedia: string;
}

function shardOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h % SHARDS;
}

const shards = new Map<number, Promise<Record<string, SavedEvent[]>>>();

function loadShard(base: string, n: number): Promise<Record<string, SavedEvent[]>> {
  let pending = shards.get(n);
  if (!pending) {
    pending = fetch(new URL(`wd-events/${n}.json`, base))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    shards.set(n, pending);
  }
  return pending;
}

/**
 * The saved events of the given civilizations, in the reader's language where
 * translated (public/data/i18n/<lang>/wd-events/<n>.json, by event id). An
 * event shared by several of them (a battle between two realms) comes once,
 * tied to all of them.
 */
export async function wikidataEvents(base: string, civs: Civilization[]): Promise<HistoryEvent[]> {
  const shardsOf = civs.map((c) => shardOf(c.id));
  const [files, texts] = await Promise.all([
    Promise.all(shardsOf.map((n) => loadShard(base, n))),
    Promise.all(shardsOf.map((n) => textFor(base, `wd-events/${n}.json`))),
  ]);
  const events = new Map<string, HistoryEvent>();
  civs.forEach((c, i) => {
    for (const r of files[i][c.id] ?? []) {
      const id = `wd:${r.wikipedia}:${r.kind}`;
      const known = events.get(id);
      if (known) {
        if (!known.civs.includes(c.id)) known.civs.push(c.id);
        continue;
      }
      // A war saved without a place stands at the realm's heart.
      const atHeart = !r.lonLat;
      if (atHeart && !c.center) continue;
      const text = texts[i][id] ?? {};
      events.set(id, {
        id,
        kind: r.kind,
        year: r.year,
        to: r.to,
        title: text.title ?? r.title,
        place: atHeart ? c.name : text.place ?? (r.place || c.name),
        lonLat: r.lonLat ?? c.center!,
        approx: atHeart ? t("event.foughtAcross", { name: c.name }) : undefined,
        civs: [c.id],
        summary: text.summary ?? r.summary ?? "",
        wikipedia: r.wikipedia,
        // Reference sites are searched in English, the language of their articles.
        search: r.title,
        // A translated summary is the story; otherwise Wikipedia's opening tells it.
        fromWikidata: !text.summary,
      });
    }
  });
  return [...events.values()];
}
