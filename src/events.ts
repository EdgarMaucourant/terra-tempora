// Key events (battles, sieges, treaties, births and deaths) pinned to the
// globe, hand-written in public/data/events.json. Each one is tied to the
// civilizations it belongs to and shows while one of them is highlighted.
// Pictures come from the event's Wikipedia article in the browser, and only
// when the file is on Wikimedia Commons, so it is freely licensed.

import { fetchPictures, type Picture } from "./wikidata";

export type EventKind =
  | "battle"
  | "siege"
  | "war"
  | "crown"
  | "birth"
  | "death"
  | "city"
  | "treaty"
  | "journey"
  | "plague";

export interface HistoryEvent {
  id: string;
  kind: EventKind;
  year: number;
  /** Last year, for events that ran over several. */
  to?: number;
  title: string;
  place: string;
  lonLat: [number, number];
  /** True, or a note, when the place is only known roughly. */
  approx?: boolean | string;
  /** Civilizations the event belongs to. */
  civs: string[];
  summary: string;
  /** English Wikipedia article, as in its URL. */
  wikipedia: string;
  /** What to search for on reference sites without a known article. */
  search: string;
  /** Direct links to articles on other reference sites. */
  links?: { label: string; url: string }[];
  /** Read from Wikidata rather than written by hand; its story comes from Wikipedia. */
  fromWikidata?: boolean;
}

interface KindStyle {
  label: string;
  color: string;
  /** Icon drawn in white on a 24×24 grid. */
  path: string;
}

export const KINDS: Record<EventKind, KindStyle> = {
  battle: {
    label: "Battle",
    color: "#c8483c",
    path: "M5 5l12 12M14 20l6-6M17 17l3 3M19 5L7 17M4 14l6 6M7 17l-3 3",
  },
  siege: {
    label: "Siege",
    color: "#d0742c",
    path: "M6 20V9h2V6h2v3h4V6h2v3h2v11zM10 20v-4h4v4",
  },
  war: {
    label: "War",
    color: "#a8433f",
    path: "M6 21V4M6 4h11l-2.5 3.5L17 11H6",
  },
  crown: {
    label: "Rulers",
    color: "#c9a13b",
    path: "M4 17L3 7l5 4 4-6 4 6 5-4-1 10zM4 20h16",
  },
  birth: {
    label: "Birth",
    color: "#5d9c6c",
    path: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5l-5.3 2.9 1.2-6-4.5-4.1 6-.7z",
  },
  death: {
    label: "Death",
    color: "#6f7681",
    path: "M7 20v-9a5 5 0 0 1 10 0v9zM12 9v6M10 11h4M4 20h16",
  },
  city: {
    label: "Capital",
    color: "#3f9a96",
    path: "M4 20V10l4-3 4 3v10M12 20V6l4-3 4 3v14M3 20h18M8 14v2M16 10v2M16 15v2",
  },
  treaty: {
    label: "Treaty",
    color: "#4f8fc0",
    path: "M8 4h10v12a4 4 0 0 1-4 4H7a3 3 0 0 1-3-3v-1h10v1a3 3 0 0 0 3 3M8 4a2 2 0 0 0-2 2v10M11 8h4M11 11h4",
  },
  journey: {
    label: "Travellers",
    color: "#6d7fd0",
    path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z",
  },
  plague: {
    label: "Plague",
    color: "#8c5aa8",
    path: "M12 3a7 7 0 0 0-7 7c0 2.6 1.3 4.3 3 5.3V19h8v-3.7c1.7-1 3-2.7 3-5.3a7 7 0 0 0-7-7zM9.5 10.5h.01M14.5 10.5h.01M11 19v-2M13 19v-2",
  },
};

/** The kind's icon as a round badge, as SVG markup. */
export function badgeSvg(kind: EventKind, size = 32): string {
  const k = KINDS[kind];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">` +
    `<circle cx="16" cy="16" r="14.5" fill="${k.color}" stroke="#fbf6ec" stroke-width="1.6"/>` +
    `<g transform="translate(6.4 6.4) scale(0.8)" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="${k.path}"/></g>` +
    `</svg>`
  );
}

/** The badge as an image URL, for the globe and the map. */
export function badgeUrl(kind: EventKind): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(badgeSvg(kind, 64))}`;
}

// Years an event stays on the globe after it ends, fading.
const LINGER = 8;

/**
 * How strongly an event shows in a (fractional) year: 1 while it happens,
 * fading over the following years, 0 before it and once it has faded.
 */
export function eventOpacity(e: HistoryEvent, year: number): number {
  const end = (e.to ?? e.year) + 1;
  if (year < e.year || year >= end + LINGER) return 0;
  if (year < end) return 1;
  return 1 - (0.65 * (year - end)) / LINGER;
}

export function eventYears(e: HistoryEvent): [number, number] {
  return [e.year, e.to ?? e.year];
}

export async function loadEvents(base: string): Promise<HistoryEvent[]> {
  const response = await fetch(new URL("events.json", base));
  if (!response.ok) throw new Error(`Could not load the events (${response.status})`);
  return ((await response.json()) as { events: HistoryEvent[] }).events;
}

/** Further reading: the Wikipedia article, the event's own links, then searches on reference sites. */
export function eventLinks(e: HistoryEvent): { label: string; url: string; note?: string }[] {
  const links: { label: string; url: string; note?: string }[] = [
    { label: "Wikipedia", url: `https://en.wikipedia.org/wiki/${encodeURIComponent(e.wikipedia)}` },
    ...(e.links ?? []),
  ];
  const query = encodeURIComponent(e.search);
  if (!links.some((l) => l.label === "Britannica")) {
    links.push({ label: "Britannica", url: `https://www.britannica.com/search?query=${query}`, note: "search" });
  }
  links.push({
    label: "World History Encyclopedia",
    url: `https://www.worldhistory.org/search/?q=${query}`,
    note: "search",
  });
  return links;
}

interface Article {
  picture: Picture | null;
  /** The article's opening paragraph. */
  extract: string;
}

const articles = new Map<string, Promise<Article | null>>();

/**
 * The event's Wikipedia article: its opening paragraph, and its lead picture
 * when that is a Commons file (and so freely licensed), with its author and licence.
 */
export function eventArticle(e: HistoryEvent): Promise<Article | null> {
  let pending = articles.get(e.wikipedia);
  if (!pending) {
    pending = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(e.wikipedia)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (summary: { extract?: string; originalimage?: { source: string } } | null) => {
        if (!summary) return null;
        const source = summary.originalimage?.source;
        let picture: Picture | null = null;
        // Files kept on Wikipedia itself may be non-free; only Commons files are used.
        if (source && source.includes("/wikipedia/commons/")) {
          const file = decodeURIComponent(source.split("/").pop()!);
          picture = (await fetchPictures([file]).catch(() => new Map<string, Picture>())).get(file) ?? null;
        }
        return { picture, extract: summary.extract ?? "" };
      })
      .catch(() => null);
    articles.set(e.wikipedia, pending);
  }
  return pending;
}
