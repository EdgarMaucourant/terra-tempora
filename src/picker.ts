import { civEraText, type Civilization } from "./civilizations";
import { lang, t } from "./i18n";
import { formatRange } from "./years";

/**
 * A dialog listing every civilization, to choose which ones the globe shows.
 * Those already shown start ticked and come first; untick one to remove it.
 */
export class Picker {
  private rows = new Map<string, { row: HTMLElement; box: HTMLInputElement; text: string }>();
  private picked = new Set<Civilization>();
  private shown = new Set<Civilization>();
  private search: HTMLInputElement;
  private count: HTMLElement;
  private addButton: HTMLButtonElement;
  private returnFocus: HTMLElement | null = null;

  constructor(
    private root: HTMLElement,
    private list: Civilization[],
    private onApply: (civs: Civilization[]) => void,
  ) {
    this.search = root.querySelector<HTMLInputElement>("#picker-search")!;
    this.count = root.querySelector<HTMLElement>("#picker-count")!;
    this.addButton = root.querySelector<HTMLButtonElement>("#picker-add")!;
    this.search.placeholder = t("landing.searchCivs", { count: list.length });
    this.search.addEventListener("input", () => this.filter());
    this.addButton.addEventListener("click", () => {
      // Civilizations already shown keep their order; new ones follow.
      const kept = [...this.shown].filter((c) => this.picked.has(c));
      const added = this.list.filter((c) => this.picked.has(c) && !this.shown.has(c));
      this.close();
      this.onApply([...kept, ...added]);
    });
    for (const button of root.querySelectorAll("[data-close]")) button.addEventListener("click", () => this.close());
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.close();
      }
    });
    root.addEventListener("click", (e) => {
      if (e.target === root) this.close();
    });
  }

  /** Opens the list; `onGlobe` are the civilizations already shown. */
  open(onGlobe: Set<Civilization>) {
    this.returnFocus = document.activeElement as HTMLElement | null;
    if (!this.rows.size) this.build();
    this.shown = onGlobe;
    this.picked = new Set(onGlobe);
    for (const c of this.list) {
      const r = this.rows.get(c.id)!;
      const there = onGlobe.has(c);
      r.box.checked = there;
      r.row.classList.toggle("on-globe", there);
    }
    // The civilizations on the globe head the list.
    const listEl = this.root.querySelector<HTMLElement>("#picker-list")!;
    listEl.replaceChildren(
      ...[...this.list.filter((c) => onGlobe.has(c)), ...this.list.filter((c) => !onGlobe.has(c))].map((c) => this.rows.get(c.id)!.row),
    );
    this.search.value = "";
    this.filter();
    this.update();
    this.root.hidden = false;
    this.search.focus();
  }

  close() {
    this.root.hidden = true;
    this.returnFocus?.focus();
  }

  private build() {
    const listEl = this.root.querySelector<HTMLElement>("#picker-list")!;
    const rows = this.list.map((c) => {
      const row = document.createElement("label");
      row.className = "picker-row";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.addEventListener("change", () => {
        if (box.checked) this.picked.add(c);
        else this.picked.delete(c);
        this.update();
      });
      const name = document.createElement("span");
      name.className = "picker-name";
      name.textContent = c.name;
      const meta = document.createElement("span");
      meta.className = "picker-meta";
      meta.textContent = `${formatRange(c.from, c.to)} · ${civEraText(c)}`;
      row.append(box, name, meta);
      this.rows.set(c.id, { row, box, text: [c.name, ...c.names].join(" ").toLocaleLowerCase(lang) });
      return row;
    });
    listEl.replaceChildren(...rows);
  }

  private filter() {
    const query = this.search.value.trim().toLocaleLowerCase(lang);
    for (const { row, text } of this.rows.values()) row.hidden = !!query && !text.includes(query);
  }

  private update() {
    const added = [...this.picked].filter((c) => !this.shown.has(c)).length;
    const removed = [...this.shown].filter((c) => !this.picked.has(c)).length;
    const parts = [added && t("picker.toAdd", { count: added }), removed && t("picker.toRemove", { count: removed })].filter(Boolean);
    this.count.textContent = this.picked.size
      ? parts.length
        ? parts.join(", ")
        : t("picker.onGlobe", { count: this.shown.size })
      : t("picker.keepOne");
    this.addButton.disabled = this.picked.size === 0 || (!added && !removed);
  }
}
