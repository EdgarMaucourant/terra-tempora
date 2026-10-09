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
 * key figures and a picture, filtered by search and era. In multi mode,
 * cards are ticked instead of opened, and the ticked ones open together.
 */
export class Landing {
  private cards = new Map<string, HTMLElement>();
  private observer: IntersectionObserver;
  private query = "";
  private era: Era | null = null;
  private sort: Sort = "area";
  private multi = false;
  /** Ticked civilizations, in the order they were ticked. */
  private selected: Civilization[] = [];

  constructor(
    private root: HTMLElement,
    private list: Civilization[],
    private onOpen: (civs: Civilization[]) => void,
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

    this.render();
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
    toggle.textContent = on ? "Cancel selection" : "Select several";
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
      ? `${n} selected: ${this.selected.map((c) => c.name).join(", ")}`
      : "Tick the civilizations to show together on the globe.";
    const open = bar.querySelector<HTMLButtonElement>("#multi-open")!;
    open.disabled = n === 0;
    open.textContent = n > 1 ? `Show ${n} on the globe` : "Show on the globe";
    bar.querySelector<HTMLButtonElement>("#multi-clear")!.hidden = n === 0;
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

    // The picture goes on top; until it loads (or when there is none) the
    // space shows the era's colour and the realm's initial.
    const media = el("div", "civ-media");
    media.append(el("span", "civ-monogram", c.name.replace(/^(the|al|el)\s+/i, "").charAt(0)));
    media.firstElementChild!.setAttribute("aria-hidden", "true");

    const body = el("div", "civ-body");
    // The realm's outline at its largest sits small in the corner, behind the text.
    body.innerHTML = `<svg class="civ-shape" viewBox="-6 -6 112 112" aria-hidden="true"><path d="${shapePath(c)}"/></svg>`;
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
    figures.setAttribute("aria-label", "Key figures");
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
    credit.title = `Picture: ${picture.file}${picture.artist ? ` by ${picture.artist}` : ""}${picture.license ? `, ${picture.license}` : ""}. Opens on Wikimedia Commons.`;
    card.querySelector(".civ-body")!.append(credit);
  }
}
