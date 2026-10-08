import { civEraText, civEras, eraLabel, shapePath, type Civilization } from "./civilizations";
import { ERAS, type Era } from "./eras";
import { realmFacts, type RealmFacts } from "./wikidata";
import { formatRange } from "./years";

type Sort = "area" | "oldest" | "newest" | "name";

const SORTS: Record<Sort, (a: Civilization, b: Civilization) => number> = {
  area: (a, b) => b.area - a.area,
  oldest: (a, b) => a.from - b.from || b.area - a.area,
  newest: (a, b) => b.to - a.to || b.from - a.from,
  name: (a, b) => a.name.localeCompare(b.name),
};

const nf = new Intl.NumberFormat("en");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The landing page: a card per civilization with its era, dates, one or two
 * key figures and a picture, filtered by search and era.
 */
export class Landing {
  private cards = new Map<string, HTMLElement>();
  private observer: IntersectionObserver;
  private query = "";
  private era: Era | null = null;
  private sort: Sort = "area";

  constructor(
    private root: HTMLElement,
    private list: Civilization[],
    private onOpen: (c: Civilization) => void,
  ) {
    this.observer = new IntersectionObserver((entries) => this.reveal(entries), { root, rootMargin: "600px 0px" });

    const search = root.querySelector<HTMLInputElement>("#civ-search")!;
    search.placeholder = `Search ${nf.format(list.length)} civilizations`;
    search.addEventListener("input", () => {
      this.query = search.value.trim().toLowerCase();
      this.render();
    });

    const sort = root.querySelector<HTMLSelectElement>("#civ-sort")!;
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
        for (const b of eras.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === button));
        this.render();
      });
      return button;
    };
    eras.append(chip("All eras", null));
    for (const e of ERAS) if (list.some((c) => this.inEra(c, e))) eras.append(chip(eraLabel(e), e));

    this.render();
  }

  private inEra(c: Civilization, e: Era) {
    return c.from < e.to && c.to >= e.from;
  }

  private matches(c: Civilization) {
    if (this.era && !this.inEra(c, this.era)) return false;
    if (!this.query) return true;
    return c.names.some((n) => n.toLowerCase().includes(this.query));
  }

  private render() {
    const shown = this.list.filter((c) => this.matches(c)).sort(SORTS[this.sort]);
    const grid = this.root.querySelector<HTMLElement>("#civ-grid")!;
    grid.replaceChildren(...shown.map((c) => this.card(c)));
    const count = this.root.querySelector<HTMLElement>("#civ-count")!;
    count.textContent =
      shown.length === this.list.length
        ? `${nf.format(shown.length)} civilizations`
        : shown.length
          ? `${nf.format(shown.length)} of ${nf.format(this.list.length)} civilizations`
          : "No civilization matches. Try another name or era.";
  }

  private card(c: Civilization): HTMLElement {
    const known = this.cards.get(c.id);
    if (known) return known;

    const card = el("article", "civ-card");
    card.dataset.era = String(ERAS.indexOf(civEras(c)[0]));

    const media = el("div", "civ-media");
    media.innerHTML = `<svg class="civ-shape" viewBox="-6 -6 112 112" aria-hidden="true"><path d="${shapePath(c)}"/></svg>`;

    const body = el("div", "civ-body");
    const title = el("h3", "civ-name");
    const link = el("a", "civ-link", c.name);
    link.href = `#c=${c.id}`;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      this.onOpen(c);
    });
    title.append(link);
    const figures = el("p", "civ-figures loading");
    figures.setAttribute("aria-label", "Key figures");
    body.append(
      el("p", "civ-era", civEraText(c)),
      title,
      el("p", "civ-dates", formatRange(c.from, c.to)),
      figures,
    );

    card.append(media, body);
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
    credit.title = `Picture: ${picture.file}${picture.artist ? ` by ${picture.artist}` : ""}${picture.license ? `, ${picture.license}` : ""}. Opens on Wikimedia Commons.`;
    card.querySelector(".civ-body")!.append(credit);
  }
}
