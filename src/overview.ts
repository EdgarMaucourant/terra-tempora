// The side panel's overview: what the view on screen is about, shown until a
// realm or an event is picked. For a civilization, the opening of its Wikipedia
// article with its photos and videos; for a country, the history of the nation
// or the land; for several civilizations, the list of them; for the history
// travel, what it is; on the home view, the ways in. Documentaries about the
// subject close it.

import { civEraText, type Civilization } from "./civilizations";
import type { Country, CountryView } from "./countries";
import { renderDocumentaries, type Documentaries } from "./documentaries";
import { localPage, pageUrl } from "./events";
import { t } from "./i18n";
import { articleMedia, renderGallery } from "./media";
import { realmFacts } from "./wikidata";
import { formatRange } from "./years";

export type Subject =
  | { kind: "civ"; civ: Civilization }
  | { kind: "several"; civs: Civilization[]; title: string; sub: string }
  | { kind: "country"; country: Country; view: CountryView; civs: Civilization[]; sub: string; articles: string[] }
  | { kind: "travel"; sub: string }
  | { kind: "home"; sub: string; actions: { label: string; text: string; run: () => void }[] };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class Overview {
  /** Bumped on every render, so late answers for an earlier subject are dropped. */
  private shown = 0;
  documentaries: Documentaries | null = null;

  constructor(
    private root: HTMLElement,
    /** Puts a civilization in the middle of the globe. */
    private focus: (c: Civilization) => void,
  ) {}

  render(subject: Subject) {
    const shown = ++this.shown;
    const current = () => shown === this.shown;
    const gallery = el("div", "gallery");
    gallery.hidden = true;
    const eyebrow = el("p", "eyebrow");
    const title = el("h2");
    const meta = el("p", "event-when");
    const lede = el("p", "event-summary");
    const text = el("p", "event-summary");
    text.hidden = true;
    const extra = el("div", "overview-extra");
    const links = el("p", "links");
    const docs = el("div", "docs");
    docs.hidden = true;
    this.root.replaceChildren(gallery, eyebrow, title, meta, lede, text, extra, links, docs);
    lede.hidden = true;

    /** The first of these articles Wikipedia has, with its photos and videos. */
    const article = async (titles: (string | null)[]) => {
      const english = titles.find((x): x is string => !!x);
      if (!english) return;
      const wikipedia = Object.assign(el("a", undefined, "Wikipedia"), {
        href: pageUrl({ wiki: "en", title: english.replace(/ /g, "_") }),
        target: "_blank",
        rel: "noopener",
      });
      links.prepend(wikipedia);
      void localPage(english).then((page) => (wikipedia.href = pageUrl(page)));
      text.textContent = t("overview.loading");
      text.classList.add("loading");
      text.hidden = false;
      for (const title of titles) {
        if (!title) continue;
        const found = await articleMedia(title);
        if (!current()) return;
        if (!found?.extract) continue;
        wikipedia.href = found.url;
        text.classList.remove("loading");
        text.textContent = found.extract;
        renderGallery(gallery, found.media);
        return;
      }
      text.classList.remove("loading");
      text.hidden = true;
    };

    const showDocs = (query: Parameters<Documentaries["about"]>[0]) => {
      renderDocumentaries(docs, this.documentaries?.about(query) ?? []);
    };

    switch (subject.kind) {
      case "civ": {
        const c = subject.civ;
        eyebrow.textContent = t("overview.civilization");
        title.textContent = c.name;
        meta.textContent = `${formatRange(c.from, c.to)} · ${civEraText(c)}`;
        void article([c.wikipedia]);
        if (c.wikidata) {
          links.append(
            Object.assign(el("a", undefined, "Wikidata"), {
              href: `https://www.wikidata.org/wiki/${encodeURIComponent(c.wikidata)}`,
              target: "_blank",
              rel: "noopener",
            }),
          );
          realmFacts(c.wikidata).then((facts) => {
            if (!current() || !facts?.figures.length) return;
            meta.textContent += ` · ${facts.figures.join(", ")}`;
          });
        }
        showDocs({ civs: [c.id] });
        break;
      }
      case "several": {
        eyebrow.textContent = t("overview.several");
        title.textContent = subject.title;
        meta.textContent = subject.sub;
        extra.append(this.civList(subject.civs));
        showDocs({ civs: subject.civs.map((c) => c.id) });
        break;
      }
      case "country": {
        const k = subject.country;
        eyebrow.textContent = subject.view === "territory" ? t("overview.territory") : t("overview.nation");
        title.textContent = k.name;
        meta.textContent = subject.sub;
        if (k.blurb && subject.view === "nationality") {
          lede.textContent = k.blurb;
          lede.hidden = false;
        }
        void article(subject.articles);
        extra.append(el("h3", "event-more", t("overview.civilizations", { count: subject.civs.length })), this.civList(subject.civs));
        showDocs({ countries: [k.id], civs: subject.civs.map((c) => c.id) });
        break;
      }
      case "travel": {
        eyebrow.textContent = t("overview.travel");
        title.textContent = t("travel.title");
        meta.textContent = subject.sub;
        lede.textContent = t("landing.travelText");
        lede.hidden = false;
        break;
      }
      case "home": {
        eyebrow.textContent = t("overview.home");
        title.textContent = t("home.title");
        meta.textContent = subject.sub;
        lede.textContent = t("landing.lede");
        lede.hidden = false;
        const items = el("ul", "overview-civs overview-actions");
        for (const action of subject.actions) {
          const item = el("li");
          const button = el("button", "overview-civ overview-action");
          button.type = "button";
          button.append(el("strong", undefined, action.label), el("span", undefined, action.text));
          button.addEventListener("click", action.run);
          item.append(button);
          items.append(item);
        }
        extra.append(el("h3", "event-more", t("home.explore")), items);
        break;
      }
    }
    links.hidden = !links.childElementCount;
  }

  /** The civilizations on screen, oldest first; picking one centres it. */
  private civList(list: Civilization[]): HTMLElement {
    const items = el("ul", "overview-civs");
    for (const c of [...list].sort((a, b) => a.from - b.from)) {
      const item = el("li");
      const button = el("button", "overview-civ");
      button.type = "button";
      button.append(el("strong", undefined, c.name), el("span", undefined, formatRange(c.from, c.to)));
      button.addEventListener("click", () => this.focus(c));
      item.append(button);
      items.append(item);
    }
    return items;
  }
}
