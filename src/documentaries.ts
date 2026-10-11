// Documentaries to watch next, on Netflix, National Geographic, Discovery
// Channel and History Channel: hand-picked in public/data/documentaries.json,
// each tied to the civilizations, events, turning points or countries it is
// about, and linked to its page on the platform.

import { t } from "./i18n";

export type Platform = "Netflix" | "National Geographic" | "Discovery Channel" | "History Channel";

export interface Documentary {
  id: string;
  platform: Platform;
  title: string;
  year?: number;
  url: string;
  civs?: string[];
  events?: string[];
  countries?: string[];
}

export interface DocumentaryQuery {
  civs?: string[];
  events?: string[];
  countries?: string[];
}

export class Documentaries {
  constructor(readonly list: Documentary[]) {}

  static async load(base: string): Promise<Documentaries> {
    const response = await fetch(new URL("documentaries.json", base));
    if (!response.ok) throw new Error(`Could not load the documentaries (${response.status})`);
    return new Documentaries(((await response.json()) as { documentaries: Documentary[] }).documentaries);
  }

  /** The documentaries about any of these, the most specific first: events, then countries, then civilizations. */
  about(query: DocumentaryQuery, limit = 4): Documentary[] {
    const hit = (ids: string[] | undefined, wanted: string[] | undefined) => !!ids && !!wanted && ids.some((id) => wanted.includes(id));
    const found = [
      ...this.list.filter((d) => hit(d.events, query.events)),
      ...this.list.filter((d) => hit(d.countries, query.countries)),
      ...this.list.filter((d) => hit(d.civs, query.civs)),
    ];
    return [...new Set(found)].slice(0, limit);
  }
}

/** "See more on Netflix: Roman Empire" links, under a heading; hidden when there are none. */
export function renderDocumentaries(container: HTMLElement, list: Documentary[]) {
  container.replaceChildren();
  container.hidden = !list.length;
  if (!list.length) return;
  const heading = Object.assign(document.createElement("h3"), { className: "event-more", textContent: t("docs.title") });
  const items = document.createElement("ul");
  items.className = "docs-list";
  for (const d of list) {
    const item = document.createElement("li");
    const a = Object.assign(document.createElement("a"), { href: d.url, target: "_blank", rel: "noopener" });
    a.append(
      Object.assign(document.createElement("span"), { className: "docs-platform", textContent: t("docs.seeMore", { platform: d.platform }) }),
      " ",
      Object.assign(document.createElement("cite"), { textContent: d.year ? `${d.title} (${d.year})` : d.title }),
    );
    item.append(a);
    items.append(item);
  }
  container.append(heading, items);
}
