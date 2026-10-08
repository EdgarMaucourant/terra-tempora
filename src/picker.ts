import { civEraText, type Civilization } from "./civilizations";
import { formatRange } from "./years";

const nf = new Intl.NumberFormat("en");

/**
 * A dialog listing every civilization, to tick one or more and add them to
 * the globe. Civilizations already on the globe are shown ticked and locked.
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
    private onAdd: (civs: Civilization[]) => void,
  ) {
    this.search = root.querySelector<HTMLInputElement>("#picker-search")!;
    this.count = root.querySelector<HTMLElement>("#picker-count")!;
    this.addButton = root.querySelector<HTMLButtonElement>("#picker-add")!;
    this.search.placeholder = `Search ${nf.format(list.length)} civilizations`;
    this.search.addEventListener("input", () => this.filter());
    this.addButton.addEventListener("click", () => {
      const added = this.list.filter((c) => this.picked.has(c));
      this.close();
      this.onAdd(added);
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
    this.picked.clear();
    for (const c of this.list) {
      const r = this.rows.get(c.id)!;
      const there = onGlobe.has(c);
      r.box.checked = there;
      r.box.disabled = there;
      r.row.classList.toggle("on-globe", there);
    }
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
      this.rows.set(c.id, { row, box, text: c.names.join(" ").toLowerCase() });
      return row;
    });
    listEl.replaceChildren(...rows);
  }

  private filter() {
    const query = this.search.value.trim().toLowerCase();
    for (const { row, text } of this.rows.values()) row.hidden = !!query && !text.includes(query);
  }

  private update() {
    const n = this.picked.size;
    this.count.textContent = n
      ? `${n} selected`
      : `${this.shown.size} on the globe. Tick the civilizations to add.`;
    this.addButton.disabled = n === 0;
    this.addButton.textContent = n > 1 ? `Add ${n} civilizations` : "Add to the globe";
  }
}
