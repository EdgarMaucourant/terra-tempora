// The text panel on the right of the globe. It shows the view's overview (the
// civilization, country or travel on screen) until a realm, an event or the
// sources are picked; "Overview" goes back. It can be resized by dragging its
// left edge and closed; the globe takes the room it leaves. On phones it is a
// popup over the globe instead, closed at start, opened by the Details tab.

import { compactQuery } from "./layout";
import { store, stored } from "./storage";

const WIDTH_KEY = "terra-tempora:panel-width";
const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 280;
const KEY_STEP = 24;
const narrow = compactQuery;

function readWidth(): number {
  const value = Number(stored(WIDTH_KEY));
  return value > 0 ? value : DEFAULT_WIDTH;
}

function storeWidth(width: number | null) {
  store(WIDTH_KEY, width === null ? null : String(Math.round(width)));
}

interface SidePanelParts {
  panel: HTMLElement;
  /** The button that brings a closed panel back. */
  opener: HTMLElement;
  grip: HTMLElement;
  /** Dims the globe behind the popup on phones; a tap on it closes the popup. */
  backdrop: HTMLElement;
  close: HTMLElement;
  back: HTMLElement;
  body: HTMLElement;
  overview: HTMLElement;
  /** Realm, event and sources: while one shows, the overview steps aside. */
  details: HTMLElement[];
  /** Called by "Overview": closes whatever detail is open. */
  onBack(): void;
}

export class SidePanel {
  private width = readWidth();
  private open = !narrow.matches;

  constructor(private parts: SidePanelParts) {
    const { panel, opener, grip, backdrop, close, back, details } = parts;
    close.addEventListener("click", () => this.setOpen(false));
    backdrop.addEventListener("click", () => this.setOpen(false));
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && narrow.matches) this.setOpen(false);
    });
    opener.addEventListener("click", () => this.setOpen(true));
    back.addEventListener("click", () => parts.onBack());
    // Picking a realm or an event opens the panel on it.
    const observer = new MutationObserver(() => this.sync());
    for (const d of details) observer.observe(d, { attributes: true, attributeFilter: ["hidden"] });

    let drag: { x: number; start: number } | null = null;
    grip.addEventListener("pointerdown", (e) => {
      grip.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, start: this.width };
      grip.classList.add("dragging");
      e.preventDefault();
    });
    // The panel sits on the right, so dragging its edge left makes it wider.
    grip.addEventListener("pointermove", (e) => drag && this.setWidth(drag.start + (drag.x - e.clientX)));
    const end = () => {
      if (!drag) return;
      drag = null;
      grip.classList.remove("dragging");
      storeWidth(this.width);
    };
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    grip.addEventListener("dblclick", () => {
      this.setWidth(DEFAULT_WIDTH);
      storeWidth(null);
    });
    grip.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowLeft" ? KEY_STEP : e.key === "ArrowRight" ? -KEY_STEP : 0;
      if (!step) return;
      e.preventDefault();
      this.setWidth(this.width + step);
      storeWidth(this.width);
    });
    window.addEventListener("resize", () => this.setWidth(this.width));
    narrow.addEventListener("change", () => this.layout());
    this.setWidth(this.width);
    this.sync();
  }

  /** Back to the top of the panel's text, for something newly shown. */
  toTop() {
    this.parts.body.scrollTop = 0;
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(on: boolean, focus = true) {
    this.open = on;
    this.layout();
    if (!focus) return;
    if (on) this.parts.close.focus({ preventScroll: true });
    else this.parts.opener.focus({ preventScroll: true });
  }

  private maxWidth(): number {
    return Math.max(MIN_WIDTH, Math.min(760, window.innerWidth * 0.6));
  }

  private setWidth(width: number) {
    this.width = Math.round(Math.min(this.maxWidth(), Math.max(MIN_WIDTH, width)));
    this.parts.grip.setAttribute("aria-valuenow", String(this.width));
    this.layout();
  }

  /** Sizes the panel and tells the page how much room it takes on the right. */
  private layout() {
    const { panel, opener, backdrop } = this.parts;
    panel.hidden = !this.open;
    opener.hidden = this.open;
    backdrop.hidden = !this.open || !narrow.matches;
    const root = document.documentElement.style;
    root.setProperty("--panel-width", `${this.width}px`);
    // On phones the panel is a popup over the globe and leaves its width alone.
    root.setProperty("--panel-space", this.open && !narrow.matches ? `${this.width}px` : "0px");
  }

  /** Shows the overview, or the detail that is open; a detail opening opens the panel. */
  private sync() {
    const { details, overview, back, body } = this.parts;
    const detail = details.some((d) => !d.hidden);
    const changed = overview.hidden !== detail;
    overview.hidden = detail;
    back.hidden = !detail;
    if (detail && !this.open) this.setOpen(true, false);
    if (changed) body.scrollTop = 0;
  }
}
