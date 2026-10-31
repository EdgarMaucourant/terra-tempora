// "Realms in <year>": the realms on the globe at the chosen year, as a list in
// the side panel. It is the globe's text alternative: a screen reader or a
// keyboard reaches every realm here, and a small realm is easier to pick from
// the list than on the globe. Picking one opens it as a click on the globe does.

import type { Polity } from "./data";
import { el } from "./dom";
import { t } from "./i18n";
import { formatYear } from "./years";

interface RealmListOptions {
  root: HTMLDetailsElement;
  /** The realms drawn at a year. */
  at(year: number): Polity[];
  /** The name shown for a realm, in the reader's language. */
  name(p: Polity): string;
  /** The realm's colour when it is coloured on the globe, else undefined. */
  color(p: Polity): string | undefined;
  onPick(p: Polity): void;
}

// While the year runs, the list is redrawn at most this often (ms).
const THROTTLE = 300;

export class RealmList {
  private year = NaN;
  private key = "";
  private timer = 0;
  private title: HTMLElement;
  private list: HTMLElement;

  constructor(private options: RealmListOptions) {
    const { root } = options;
    this.title = root.querySelector<HTMLElement>(".realms-now-title")!;
    this.list = root.querySelector<HTMLElement>(".realms-now-list")!;
    root.addEventListener("toggle", () => this.draw());
  }

  /** Asks for a redraw at this year; several calls close together make one. */
  update(year: number) {
    this.year = Math.round(year);
    if (this.timer) return;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      this.draw();
    }, THROTTLE);
  }

  /** Redraws at once, for example after the language changes. */
  refresh() {
    this.key = "";
    this.draw();
  }

  private draw() {
    if (Number.isNaN(this.year)) return;
    const { root, at, name, color, onPick } = this.options;
    const realms = at(this.year)
      .map((p) => ({ p, name: name(p), color: color(p) }))
      .sort((a, b) => Number(!a.color) - Number(!b.color) || a.name.localeCompare(b.name));
    this.title.textContent = t("realms.title", { year: formatYear(this.year), count: realms.length });
    if (!root.open) return;
    // Nothing to redo when the same realms are listed in the same colours.
    const key = `${this.year}|${realms.map((r) => `${r.name}:${r.color ?? ""}`).join("|")}`;
    if (key === this.key) return;
    this.key = key;
    if (!realms.length) {
      this.list.replaceChildren(el("li", "realms-now-none", t("hint.none")));
      return;
    }
    // A button keeps the focus across redraws when its realm is still listed.
    const focused = this.list.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.name : undefined;
    let refocus: HTMLElement | null = null;
    this.list.replaceChildren(
      ...realms.map(({ p, name, color }) => {
        const button = el("button", "realms-now-item");
        button.type = "button";
        button.dataset.name = p.name;
        const swatch = el("span", "realms-now-swatch");
        swatch.setAttribute("aria-hidden", "true");
        if (color) swatch.style.background = color;
        button.append(swatch, el("span", undefined, name));
        if (color) button.append(el("span", "visually-hidden", `, ${t("realms.highlighted")}`));
        button.addEventListener("click", () => onPick(p));
        if (p.name === focused) refocus = button;
        const li = el("li");
        li.append(button);
        return li;
      }),
    );
    (refocus as HTMLElement | null)?.focus({ preventScroll: true });
  }
}
