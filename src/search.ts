import { searched } from "./analytics";
import { CONTINENTS, type Civilization, type Continent } from "./civilizations";
import { continentFinder } from "./continentAt";
import { countryCivIds, type Country, type CountryView } from "./countries";
import { el } from "./dom";
import { badgeSvg, kindLabel, type HistoryEvent } from "./events";
import { formatNumber, lang, t } from "./i18n";
import { formatRange, formatYear } from "./years";

type Kind = "civs" | "countries" | "nations" | "events";
const KINDS: Kind[] = ["civs", "countries", "nations", "events"];
const VIEW: Record<"countries" | "nations", CountryView> = { countries: "territory", nations: "nationality" };
const KIND_LABEL = {
  civs: "landing.civilizations",
  countries: "landing.countries",
  nations: "landing.nations",
  events: "search.events",
} as const;
// Rows shown per type when all types are listed, and per page for one type.
const PREVIEW = 6;
const PAGE = 60;

interface Hit {
  kind: Kind;
  id: string;
  name: string;
  meta: string;
  href: string;
  /** Civilization whose outline the row shows. */
  shape?: string;
  /** Or the event's badge, as SVG markup. */
  badge?: string;
  open: () => void;
}

/** An event the search can find: a realm's event, or a turning point of the history travel. */
export interface FoundEvent {
  event: HistoryEvent;
  /** A turning point of the history travel, opened there. */
  travel: boolean;
}

interface Indexed extends FoundEvent {
  names: string[];
  continents: Continent[];
}

/** Lower case, without accents, so "egypte" finds "Égypte". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase(lang);

/**
 * One search over the civilizations, today's countries and nations, and the
 * events (realms' battles, treaties and so on, and the history travel's
 * turning points), filtered by type, continent and years: "every
 * civilization of South America between 1 and 1000 CE". A civilization
 * matches the years when it stood at some point between them; a country or
 * nation when one of its civilizations did, on the country's continent; an
 * event when it happened then, and on the continent where it took place.
 */
export class Search {
  private kind: Kind | null = null;
  private continent: Continent | null = null;
  private limit = PAGE;
  private input: HTMLInputElement;
  private names = new Map<Civilization, string[]>();
  /** The events, once downloaded: they are asked for when the search is first used. */
  private events: Indexed[] = [];
  private eventsAsked = false;

  constructor(
    private root: HTMLElement,
    private list: Civilization[],
    private countries: Country[],
    private onOpen: (civ: Civilization) => void,
    private onCountry: (country: Country, view: CountryView) => void,
    private outline: (className: string, id: string) => SVGSVGElement,
    private drawOutlines: () => void,
    /** Every event that can be found, with the history travel's turning points. */
    private loadEvents: () => Promise<FoundEvent[]>,
    private onEvent: (found: FoundEvent) => void,
  ) {
    this.input = root.querySelector<HTMLInputElement>("#all-search")!;
    for (const c of list) this.names.set(c, [c.name, ...c.names].map(fold));
    this.input.addEventListener("input", () => this.update(true));
    // The search pop-up focuses its box as it opens: the events download then.
    this.input.addEventListener("focus", () => this.fetchEvents());

    const continents = root.querySelector<HTMLElement>("#search-continents")!;
    const chip = (label: string, continent: Continent | null) => {
      const button = el("button", "chip", label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(continent === this.continent));
      button.addEventListener("click", () => {
        this.continent = continent;
        for (const b of continents.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === button));
        this.update();
      });
      return button;
    };
    continents.append(chip(t("search.allContinents"), null), ...CONTINENTS.map((c) => chip(t(`search.continents.${c}`), c)));

    for (const id of ["search-from", "search-to", "search-from-era", "search-to-era"]) {
      root.querySelector(`#${id}`)!.addEventListener(id.endsWith("era") ? "change" : "input", () => this.update());
    }
    root.querySelector("#search-clear")!.addEventListener("click", () => this.clear());
    this.update();
  }

  private fetchEvents() {
    if (this.eventsAsked) return;
    this.eventsAsked = true;
    const civs = new Map(this.list.map((c) => [c.id, c]));
    Promise.all([this.loadEvents(), continentFinder()])
      .then(([found, continentAt]) => {
        this.events = found.map((f) => {
          const e = f.event;
          // Out at sea, an event takes its realms' continents.
          const here = continentAt(e.lonLat[0], e.lonLat[1]);
          const continents = here ? [here] : [...new Set(e.civs.flatMap((id) => civs.get(id)?.continents ?? []))];
          return { ...f, names: [e.title, e.place].map(fold), continents };
        });
        this.update();
      })
      .catch((error: unknown) => console.error(error));
  }

  /** The search box, to focus when the pop-up opens. */
  get field() {
    return this.input;
  }

  private clear() {
    this.kind = null;
    this.continent = null;
    for (const id of ["search-from", "search-to"]) this.root.querySelector<HTMLInputElement>(`#${id}`)!.value = "";
    for (const b of this.root.querySelectorAll("#search-continents button")) b.setAttribute("aria-pressed", String(b === b.parentElement!.firstElementChild));
    this.update();
  }

  /** The years asked for, [from, to], negative before the common era; either may be open. */
  private years(): [number, number] {
    const read = (id: string) => {
      const n = Math.abs(Math.round(Number(this.root.querySelector<HTMLInputElement>(`#${id}`)!.value)));
      if (!n) return null;
      return this.root.querySelector<HTMLSelectElement>(`#${id}-era`)!.value === "bce" ? -n : n;
    };
    const from = read("search-from") ?? -Infinity;
    const to = read("search-to") ?? Infinity;
    return from <= to ? [from, to] : [to, from];
  }

  /**
   * Whether a civilization of the country stood within the years, on the
   * country's continent: the Kingdom of France crossed Guyana, but not in 990.
   */
  private stoodThere(c: Civilization | undefined, country: Country, stood: (c: Civilization) => boolean) {
    return !!c && stood(c) && c.continents.some((x) => country.continents.includes(x));
  }

  private continentNames(list: Continent[]) {
    return list.map((c) => t(`search.continents.${c}`)).join(", ");
  }

  private hits(query: string): Record<Kind, Hit[]> {
    const [from, to] = this.years();
    const anyYear = from === -Infinity && to === Infinity;
    const stood = (c: Civilization) => c.from <= to && c.to >= from;
    const onContinent = (list: Continent[]) => !this.continent || list.includes(this.continent);
    // Names that start with the words come first.
    const rank = (names: string[]) => (!query ? 0 : names.some((n) => n.startsWith(query)) ? 0 : names.some((n) => n.includes(query)) ? 1 : -1);

    const civs = this.list
      .map((c) => ({ c, r: rank(this.names.get(c)!) }))
      .filter(({ c, r }) => r >= 0 && onContinent(c.continents) && stood(c))
      .sort((a, b) => a.r - b.r || a.c.from - b.c.from || b.c.area - a.c.area)
      .map(({ c }) => ({
        kind: "civs" as const,
        id: c.id,
        name: c.name,
        meta: `${formatRange(c.from, c.to)} · ${this.continentNames(c.continents)}`,
        href: `#c=${c.id}`,
        shape: c.id,
        open: () => this.onOpen(c),
      }));

    const byId = new Map(this.list.map((c) => [c.id, c]));
    const places = (kind: "countries" | "nations") => {
      const view = VIEW[kind];
      return this.countries
        .map((k) => ({ k, r: rank([fold(k.name)]) }))
        .filter(
          ({ k, r }) =>
            r >= 0 &&
            onContinent(k.continents) &&
            (anyYear || countryCivIds(k, view).some((id) => this.stoodThere(byId.get(id), k, stood))),
        )
        .sort((a, b) => a.r - b.r || a.k.name.localeCompare(b.k.name, lang))
        .map(({ k }) => ({
          kind,
          id: k.id,
          name: k.name,
          meta: t(kind === "countries" ? "search.countryMeta" : "search.nationMeta", { continents: this.continentNames(k.continents) }),
          href: `#${kind === "countries" ? "t" : "k"}=${k.id}`,
          shape: k.civ,
          open: () => this.onCountry(k, view),
        }));
    };
    const events = this.events
      .map((f) => ({ f, r: rank(f.names) }))
      .filter(({ f, r }) => r >= 0 && onContinent(f.continents) && f.event.year <= to && (f.event.to ?? f.event.year) >= from)
      .sort((a, b) => a.r - b.r || a.f.event.year - b.f.event.year)
      .map(({ f }) => {
        const e = f.event;
        const when = e.to && e.to !== e.year ? formatRange(e.year, e.to) : formatYear(e.year);
        const meta = [kindLabel(e.kind), when, e.place];
        if (f.travel) meta.push(t("travel.title"));
        return {
          kind: "events" as const,
          id: e.id,
          name: e.title,
          meta: meta.filter(Boolean).join(" · "),
          href: f.travel ? `#travel&y=${e.year}` : `#c=${e.civs[0]}&y=${e.year}`,
          badge: badgeSvg(e.kind, 38),
          open: () => this.onEvent(f),
        };
      });
    return { civs, countries: places("countries"), nations: places("nations"), events };
  }

  private update(typed = false) {
    const query = fold(this.input.value.trim());
    const found = this.hits(query);
    const total = KINDS.reduce((n, k) => n + found[k].length, 0);
    if (typed) {
      this.limit = PAGE;
      searched("search", query, total);
    }
    const [from, to] = this.years();
    const years = from !== -Infinity || to !== Infinity;
    this.root.querySelector<HTMLElement>("#search-years-hint")!.hidden = !years || this.kind === "civs" || this.kind === "events";
    this.root.querySelector<HTMLElement>("#search-clear")!.hidden = !years && !this.continent && !this.kind;

    // Type chips, each with how many it holds.
    const types = this.root.querySelector<HTMLElement>("#search-types")!;
    const typeChip = (kind: Kind | null, label: string, n: number) => {
      const button = el("button", "chip", `${label} · ${formatNumber(n)}`);
      button.type = "button";
      button.setAttribute("aria-pressed", String(kind === this.kind));
      button.addEventListener("click", () => this.pick(kind));
      return button;
    };
    types.replaceChildren(
      typeChip(null, t("search.allTypes"), total),
      ...KINDS.map((k) => typeChip(k, t(KIND_LABEL[k]), found[k].length)),
    );

    const shown = this.kind ? found[this.kind].length : total;
    this.root.querySelector("#search-count")!.textContent = shown ? t("search.count", { count: shown }) : t("search.none");

    const results = this.root.querySelector<HTMLElement>("#search-results")!;
    const parts: HTMLElement[] = [];
    if (this.kind) {
      const list = found[this.kind];
      parts.push(this.rows(list.slice(0, this.limit)));
      if (list.length > this.limit) {
        parts.push(this.more(t("search.showMore"), () => {
          this.limit += PAGE;
          this.update();
        }));
      }
    } else {
      for (const kind of KINDS) {
        const list = found[kind];
        if (!list.length) continue;
        const group = el("section", "search-group");
        group.append(el("h3", "search-group-title", `${t(KIND_LABEL[kind])} · ${formatNumber(list.length)}`), this.rows(list.slice(0, PREVIEW)));
        if (list.length > PREVIEW) group.append(this.more(t("search.showAll", { count: formatNumber(list.length) }), () => this.pick(kind)));
        parts.push(group);
      }
    }
    results.replaceChildren(...parts);
    this.drawOutlines();
  }

  private pick(kind: Kind | null) {
    this.kind = kind;
    this.limit = PAGE;
    this.update();
    this.root.closest(".landing-scroll")?.scrollTo({ top: 0 });
  }

  private rows(hits: Hit[]): HTMLElement {
    const list = el("ul", "search-list");
    for (const hit of hits) {
      const item = el("li");
      const link = el("a", "search-row");
      link.href = hit.href;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        hit.open();
      });
      const text = el("span", "search-text");
      text.append(el("strong", "search-name", hit.name), el("span", "search-meta", hit.meta));
      if (hit.badge) {
        const badge = el("span", "search-shape search-badge");
        badge.innerHTML = hit.badge;
        link.append(badge, text);
      } else link.append(this.outline("search-shape", hit.shape!), text);
      item.append(link);
      list.append(item);
    }
    return list;
  }

  private more(label: string, run: () => void): HTMLButtonElement {
    const button = el("button", "ghost search-more", label);
    button.type = "button";
    button.addEventListener("click", run);
    return button;
  }
}
