import { civEraText, civEras, shapePath, type Civilization, type Outlines } from "./civilizations";
import { ERAS, eraLabel, type Era } from "./eras";
import { countryCivIds, type Country, type CountryView } from "./countries";
import { formatNumber, lang, t } from "./i18n";
import { pictureTitle, realmFacts, type RealmFacts } from "./wikidata";
import { formatRange, formatYear } from "./years";

type Sort = "area" | "oldest" | "newest" | "name";

const SORTS: Record<Sort, (a: Civilization, b: Civilization) => number> = {
  area: (a, b) => b.area - a.area,
  oldest: (a, b) => a.from - b.from || b.area - a.area,
  newest: (a, b) => b.to - a.to || b.from - a.from,
  name: (a, b) => a.name.localeCompare(b.name, lang),
};

type CountrySort = "name" | "area" | "oldest" | "most";

// Cards each section shows before the "Show all" card, which makes a tenth.
const SHOWN = 9;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The landing page: a card per civilization with its era, dates, one or two
 * key figures and a picture, filtered by search and era. In multi mode,
 * cards are ticked instead of opened, and the ticked ones open together.
 */
export class Landing {
  private cards = new Map<string, HTMLElement>();
  private observer: IntersectionObserver;
  private query = "";
  private era: Era | null = null;
  private sort: Sort = "oldest";
  /** Whether the civilizations section shows every match. */
  private all = false;
  private multi = false;
  /** Ticked civilizations, in the order they were ticked. */
  private selected: Civilization[] = [];
  private outlines: Outlines | null = null;

  constructor(
    private root: HTMLElement,
    private list: Civilization[],
    private onOpen: (civs: Civilization[]) => void,
    countries: Country[] = [],
    onCountry?: (country: Country, view: CountryView) => void,
    /** Downloads the cards' outlines; asked for only once the page is shown. */
    private loadOutlines: () => Promise<Outlines> = async () => ({}),
  ) {
    this.observer = new IntersectionObserver((entries) => this.reveal(entries), { root, rootMargin: "600px 0px" });

    const search = root.querySelector<HTMLInputElement>("#civ-search")!;
    search.placeholder = t("landing.searchCivs", { count: list.length });
    search.addEventListener("input", () => {
      this.query = search.value.trim().toLocaleLowerCase(lang);
      this.all = false;
      this.render();
    });

    const sort = root.querySelector<HTMLSelectElement>("#civ-sort")!;
    sort.value = this.sort;
    sort.addEventListener("change", () => {
      this.sort = sort.value as Sort;
      this.render();
    });

    const eras = root.querySelector<HTMLElement>("#era-filter")!;
    const chip = (label: string, era: Era | null) => {
      const button = el("button", "chip", label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(era === this.era));
      button.addEventListener("click", () => {
        this.era = era;
        this.all = false;
        for (const b of eras.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === button));
        this.render();
      });
      return button;
    };
    eras.append(chip(t("landing.allEras"), null));
    for (const e of ERAS) if (list.some((c) => this.inEra(c, e))) eras.append(chip(eraLabel(e), e));

    const toggle = root.querySelector<HTMLButtonElement>("#multi-toggle")!;
    toggle.addEventListener("click", () => this.setMulti(!this.multi));
    root.querySelector("#multi-clear")!.addEventListener("click", () => {
      for (const c of this.selected) this.mark(c, false);
      this.selected = [];
      this.updateBar();
    });
    root.querySelector("#multi-cancel")!.addEventListener("click", () => this.setMulti(false));
    root.querySelector("#multi-open")!.addEventListener("click", () => {
      if (!this.selected.length) return;
      const picked = [...this.selected];
      this.setMulti(false);
      this.onOpen(picked);
    });

    for (const view of ["territory", "nationality"] as const) this.setupCountries(view, countries, onCountry);

    this.render();
  }

  /** The page is on screen: the cards' outlines are worth downloading now. */
  show() {
    if (this.outlines) return;
    this.loadOutlines().then((outlines) => {
      this.outlines = outlines;
      this.drawOutlines();
    });
  }

  /** Draws the outline of every card that has none yet, once they have arrived. */
  private drawOutlines() {
    if (!this.outlines) return;
    for (const path of this.root.querySelectorAll<SVGPathElement>("path[data-outline]")) {
      const rings = this.outlines[path.dataset.outline!];
      if (rings) path.setAttribute("d", shapePath(rings));
      path.removeAttribute("data-outline");
    }
  }

  /** An outline in the card's corner, drawn once the outlines are in. */
  private outline(className: string, id: string): string {
    return `<svg class="${className}" viewBox="-6 -6 112 112" aria-hidden="true"><path data-outline="${id}"/></svg>`;
  }

  /** A countries or nations section: the first few, then a card to show the rest. */
  private setupCountries(view: CountryView, countries: Country[], onCountry?: (country: Country, view: CountryView) => void) {
    const section = this.root.querySelector<HTMLElement>(`.countries[data-kind="${view}"]`)!;
    section.hidden = !countries.length;
    if (!countries.length) return;
    const grid = section.querySelector<HTMLElement>(".country-grid")!;
    const search = section.querySelector<HTMLInputElement>("input")!;
    const sort = section.querySelector<HTMLSelectElement>("select")!;

    const byId = new Map(this.list.map((c) => [c.id, c]));
    const cards = countries.map((country) => {
      const civs = countryCivIds(country, view)
        .map((id) => byId.get(id))
        .filter((c): c is Civilization => !!c);
      const from = civs.length ? Math.min(...civs.map((c) => c.from)) : 0;
      return { country, civs: civs.length, from, card: this.countryCard(country, view, civs, from, byId, onCountry) };
    });
    type Entry = (typeof cards)[number];
    const sorts: Record<CountrySort, (a: Entry, b: Entry) => number> = {
      name: (a, b) => a.country.name.localeCompare(b.country.name, lang),
      area: (a, b) => b.country.area - a.country.area,
      oldest: (a, b) => a.from - b.from || a.country.name.localeCompare(b.country.name, lang),
      most: (a, b) => b.civs - a.civs || a.country.name.localeCompare(b.country.name, lang),
    };
    let all = false;
    const show = () => {
      const query = search.value.trim().toLocaleLowerCase(lang);
      const matches = cards
        .filter(({ country }) => !query || country.name.toLocaleLowerCase(lang).includes(query))
        .sort(sorts[sort.value as CountrySort] ?? sorts.name);
      const toggle = () => {
        all = !all;
        show();
      };
      const showAll = view === "territory" ? t("landing.showAllCountries") : t("landing.showAllNations");
      grid.replaceChildren(...this.limited(matches.map((c) => c.card), matches.length, all, showAll, "country-card", toggle));
      if (query && !matches.length) {
        grid.replaceChildren(el("p", "country-meta", view === "territory" ? t("landing.noCountries") : t("landing.noNations")));
      }
      this.drawOutlines();
    };
    search.addEventListener("input", () => {
      all = false;
      show();
    });
    sort.addEventListener("change", show);
    show();
  }

  /**
   * The first few cards and a last card that shows the rest (`showAll`),
   * or every card and a last card that folds them back. `total` counts every
   * match; `cards` may hold only the ones shown.
   */
  private limited(cards: HTMLElement[], total: number, all: boolean, showAll: string, kind: string, toggle: () => void): HTMLElement[] {
    if (total <= SHOWN + 1) return cards.slice(0, total);
    const more = el("button", `${kind} more-card`);
    more.type = "button";
    more.setAttribute("aria-expanded", String(all));
    more.append(
      el("span", "more-title", all ? t("landing.showFewer") : showAll),
      el("span", "more-count", all ? t("landing.backToFirst", { count: SHOWN }) : t("landing.inAll", { count: total })),
    );
    more.addEventListener("click", () => {
      const section = more.parentElement;
      toggle();
      // Folding back would leave the reader far below the section.
      if (all) section?.scrollIntoView({ block: "nearest" });
    });
    return [...(all ? cards : cards.slice(0, SHOWN)), more];
  }

  private countryCard(
    country: Country,
    view: CountryView,
    civs: Civilization[],
    from: number,
    byId: Map<string, Civilization>,
    onCountry?: (country: Country, view: CountryView) => void,
  ): HTMLElement {
    const card = el("article", "country-card");
    const today = byId.get(country.civ);
    const shape = el("div");
    if (today) {
      shape.innerHTML = this.outline("country-shape", today.id);
    }
    const body = el("div");
    const title = el("h3");
    const link = el("a", "country-link", country.name);
    link.href = `#${view === "territory" ? "t" : "k"}=${country.id}`;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      onCountry?.(country, view);
    });
    title.append(link);
    body.append(title, el("p", "country-meta", t("landing.countryMeta", { count: civs.length, year: formatYear(from) })));
    if (country.blurb && view === "nationality") card.title = country.blurb;
    card.append(shape, body);
    return card;
  }

  /** Turns multi mode on or off; turning it off clears the ticks. */
  setMulti(on: boolean) {
    this.multi = on;
    if (!on) {
      for (const c of this.selected) this.mark(c, false);
      this.selected = [];
    }
    this.root.classList.toggle("multi", on);
    const toggle = this.root.querySelector<HTMLButtonElement>("#multi-toggle")!;
    toggle.setAttribute("aria-pressed", String(on));
    toggle.textContent = on ? t("landing.cancelSelection") : t("landing.selectSeveral");
    this.updateBar();
  }

  private toggleCard(c: Civilization) {
    const at = this.selected.indexOf(c);
    if (at >= 0) this.selected.splice(at, 1);
    else this.selected.push(c);
    this.mark(c, at < 0);
    this.updateBar();
  }

  private mark(c: Civilization, on: boolean) {
    const card = this.cards.get(c.id);
    if (!card) return;
    card.classList.toggle("selected", on);
    card.querySelector(".civ-link")!.setAttribute("aria-pressed", String(on));
  }

  private updateBar() {
    const bar = this.root.querySelector<HTMLElement>("#multi-bar")!;
    bar.hidden = !this.multi;
    const n = this.selected.length;
    bar.querySelector("#multi-count")!.textContent = n
      ? t("landing.selected", { count: n, names: this.selected.map((c) => c.name).join(", ") })
      : t("landing.tickHint");
    const open = bar.querySelector<HTMLButtonElement>("#multi-open")!;
    open.disabled = n === 0;
    open.textContent = n > 1 ? t("landing.showSelected", { count: n }) : t("landing.showOnGlobe");
    bar.querySelector<HTMLButtonElement>("#multi-clear")!.hidden = n === 0;
  }

  private inEra(c: Civilization, e: Era) {
    return c.from < e.to && c.to >= e.from;
  }

  private matches(c: Civilization) {
    if (this.era && !this.inEra(c, this.era)) return false;
    if (!this.query) return true;
    // The shown name and the English realm names both match.
    return [c.name, ...c.names].some((n) => n.toLocaleLowerCase(lang).includes(this.query));
  }

  private render() {
    const shown = this.list.filter((c) => this.matches(c)).sort(SORTS[this.sort]);
    const grid = this.root.querySelector<HTMLElement>("#civ-grid")!;
    // Cards are built only when shown: every picture is a download.
    const cards = (this.all || shown.length <= SHOWN + 1 ? shown : shown.slice(0, SHOWN)).map((c) => this.card(c));
    grid.replaceChildren(
      ...this.limited(cards, shown.length, this.all, t("landing.showAllCivs"), "civ-card", () => {
        this.all = !this.all;
        this.render();
      }),
    );
    this.drawOutlines();
    const count = this.root.querySelector<HTMLElement>("#civ-count")!;
    count.textContent =
      shown.length === this.list.length
        ? t("landing.civCount", { count: shown.length })
        : shown.length
          ? t("landing.civCountOf", { count: shown.length, total: formatNumber(this.list.length) })
          : t("landing.noCivs");
  }

  private card(c: Civilization): HTMLElement {
    const known = this.cards.get(c.id);
    if (known) return known;

    const card = el("article", "civ-card");
    card.dataset.era = String(ERAS.indexOf(civEras(c)[0]));

    // The picture goes on top; until it loads (or when there is none) the
    // space shows the era's colour and the realm's initial.
    const media = el("div", "civ-media");
    media.append(el("span", "civ-monogram", c.name.replace(/^(the|al|el)\s+/i, "").charAt(0)));
    media.firstElementChild!.setAttribute("aria-hidden", "true");

    const body = el("div", "civ-body");
    // The realm's outline at its largest sits small in the corner, behind the text.
    body.innerHTML = this.outline("civ-shape", c.id);
    const title = el("h3", "civ-name");
    const link = el("a", "civ-link", c.name);
    link.href = `#c=${c.id}`;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (this.multi) this.toggleCard(c);
      else this.onOpen([c]);
    });
    title.append(link);
    const figures = el("p", "civ-figures loading");
    figures.setAttribute("aria-label", t("landing.keyFigures"));
    body.append(
      el("p", "civ-era", civEraText(c)),
      title,
      el("p", "civ-dates", formatRange(c.from, c.to)),
      figures,
    );

    const check = el("span", "civ-check");
    check.setAttribute("aria-hidden", "true");
    card.append(media, body, check);
    card.dataset.wikidata = c.wikidata ?? "";
    this.cards.set(c.id, card);
    this.observer.observe(card);
    return card;
  }

  private reveal(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const card = entry.target as HTMLElement;
      this.observer.unobserve(card);
      const qid = card.dataset.wikidata;
      if (!qid) {
        this.fill(card, null);
        continue;
      }
      realmFacts(qid).then((facts) => this.fill(card, facts));
    }
  }

  private fill(card: HTMLElement, facts: RealmFacts | null) {
    const figures = card.querySelector<HTMLElement>(".civ-figures")!;
    figures.classList.remove("loading");
    figures.textContent = facts?.figures.join(" · ") ?? "";
    figures.hidden = !figures.textContent;

    const picture = facts?.picture;
    if (!picture) return;
    const media = card.querySelector<HTMLElement>(".civ-media")!;
    const img = el("img");
    img.alt = "";
    img.decoding = "async";
    img.className = picture.kind === "emblem" ? "emblem" : "photo";
    img.addEventListener("load", () => media.classList.add("has-picture"));
    img.addEventListener("error", () => img.remove());
    img.src = picture.thumb;
    media.append(img);

    const credit = el("a", "civ-credit");
    credit.href = picture.page;
    credit.target = "_blank";
    credit.rel = "noopener";
    const who = picture.artist ? (picture.artist.length > 48 ? `${picture.artist.slice(0, 46)}…` : picture.artist) : "Wikimedia Commons";
    credit.textContent = [who, picture.license].filter(Boolean).join(", ");
    credit.title = pictureTitle(picture);
    card.querySelector(".civ-body")!.append(credit);
  }
}
