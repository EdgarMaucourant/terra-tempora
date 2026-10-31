// The guided tour: a few cards that point at the main parts of the page in
// turn (the globe, the timeline, the menu, the view buttons and the text
// panel), with Back and Next. Phones get their own texts, since the timeline,
// the view buttons and the panel work differently there.
//
// The "New here?" prompt offers it shortly after the site opens, on every
// device, unless the visitor asked not to see that prompt again. When the
// prompt or the tour closes, it shrinks into the "Open tour" button beside
// Sources (on phones, into the menu, which holds an "Open tour" line).

import { el } from "./dom";
import { t, type MessageKey } from "./i18n";
import { compactQuery } from "./layout";
import { store, stored } from "./storage";

const WELCOME_OFF_KEY = "terra-tempora:welcome-off";
/** How long the globe shows alone before the welcome prompt. */
const WELCOME_DELAY = 1500;
/** Room kept between the card, the highlighted part and the window's edges. */
const GAP = 12;
const EDGE = 16;
const narrow = compactQuery;

type StepId = "view" | "timeline" | "menu" | "views" | "panel";

interface Step {
  id: StepId;
  /** The parts to highlight, the first ones shown; none for the whole view. */
  targets(): HTMLElement[];
}

/** Shown and taking room on screen (not hidden, folded away or off screen). */
function visible(node: HTMLElement | null): node is HTMLElement {
  if (!node || !node.isConnected) return false;
  const box = node.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return false;
  if (box.right <= 0 || box.left >= window.innerWidth) return false;
  return getComputedStyle(node).visibility !== "hidden" && node.checkVisibility?.() !== false;
}

function $(selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(selector);
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Shows the "Open tour" button, with a copy of `card` (the prompt or the
 * tour's card, still on screen) shrinking into it, or into the menu button
 * on phones, where the tour waits in the menu.
 */
function dock(card: HTMLElement) {
  const button = $("#tour-button")!;
  const appearing = button.hidden;
  button.hidden = false;
  const target = narrow.matches ? $("#explore-toggle") : button;
  if (!visible(target) || !visible(card) || reducedMotion.matches || !card.animate) return;
  const from = card.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const ghost = card.cloneNode(true) as HTMLElement;
  for (const node of [ghost, ...ghost.querySelectorAll("[id]")]) node.removeAttribute("id");
  ghost.setAttribute("aria-hidden", "true");
  ghost.inert = true;
  ghost.classList.add("tour-ghost");
  Object.assign(ghost.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
  });
  document.body.append(ghost);
  // The words fade first, then the box flies into the button and takes its shape.
  for (const child of ghost.children) child.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
  const flight = ghost.animate(
    [
      { transform: "none", opacity: 1 },
      {
        transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`,
        opacity: 0.5,
      },
    ],
    { duration: 520, easing: "cubic-bezier(0.55, 0, 0.2, 1)" },
  );
  // A newly shown button waits for the card to land; the menu button stays.
  if (target === button && appearing) target.style.opacity = "0";
  const land = () => {
    ghost.remove();
    target.style.opacity = "";
    target.animate([{ transform: "scale(1.12)" }, { transform: "none" }], { duration: 220, easing: "ease-out" });
  };
  flight.finished.then(land, land);
}

const STEPS: Step[] = [
  { id: "view", targets: () => [] },
  {
    id: "timeline",
    // On phones the fold tab sits just above the timeline: both are lit.
    targets: () => [$("footer.timeline"), $("#timeline-fold")].filter(visible),
  },
  { id: "menu", targets: () => [$("#explore-toggle")].filter(visible) },
  {
    id: "views",
    targets: () => [narrow.matches ? $("#view-tab") : $(".view-mode")].filter(visible),
  },
  {
    id: "panel",
    targets: () => {
      const panel = $("#panel");
      return [visible(panel) && !narrow.matches ? panel : $("#panel-open")].filter(visible);
    },
  },
];

/** The text of a step: its phone version on phones, when it has one. */
function stepText(id: StepId, part: "title" | "text"): string {
  if (part === "text" && narrow.matches) return t(`tour.${id}.phone` as MessageKey);
  return t(`tour.${id}.${part}` as MessageKey);
}

interface TourHooks {
  /** Puts the page in a state the tour can point at (menus and popups closed). */
  prepare(): void;
}

export class Tour {
  private layer = el("div", "tour");
  private spot = el("div", "tour-spot");
  private card = el("section", "tour-card");
  private count = el("p", "tour-count");
  private title = el("h2", "tour-title");
  private text = el("p", "tour-text");
  private back = el("button", "ghost tour-back");
  private next = el("button", "primary tour-next");
  private close = el("button", "icon-button tour-close", "×");
  private steps: Step[] = [];
  private index = 0;
  private returnFocus: HTMLElement | null = null;

  constructor(private hooks: TourHooks) {
    const { layer, spot, card, count, title, text, back, next, close } = this;
    layer.hidden = true;
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "tour-title");
    card.setAttribute("aria-describedby", "tour-text");
    card.tabIndex = -1;
    title.id = "tour-title";
    text.id = "tour-text";
    text.setAttribute("aria-live", "polite");
    for (const b of [back, next, close]) b.type = "button";
    const actions = el("div", "tour-actions");
    actions.append(back, next);
    card.append(close, count, title, text, actions);
    layer.append(spot, card);
    document.getElementById("app")!.append(layer);

    back.addEventListener("click", () => this.show(this.index - 1));
    next.addEventListener("click", () => (this.index + 1 < this.steps.length ? this.show(this.index + 1) : this.end()));
    close.addEventListener("click", () => this.end());
    layer.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.end();
      else if (e.key === "ArrowRight" && !(e.target instanceof HTMLButtonElement)) next.click();
      else if (e.key === "ArrowLeft" && !(e.target instanceof HTMLButtonElement) && this.index > 0) back.click();
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
    // Keyboard focus stays in the card while the tour is on.
    layer.addEventListener("focusout", (e) => {
      if (!layer.hidden && !layer.contains(e.relatedTarget as Node | null)) card.focus({ preventScroll: true });
    });
    window.addEventListener("resize", () => this.place());
  }

  get running(): boolean {
    return !this.layer.hidden;
  }

  start() {
    this.hooks.prepare();
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Parts this view doesn't show (say, the view buttons during the history travel) are left out.
    this.steps = STEPS.filter((s) => s.id === "view" || s.targets().length > 0);
    this.layer.hidden = false;
    document.documentElement.classList.add("touring");
    this.show(0);
  }

  end() {
    if (!this.running) return;
    dock(this.card);
    this.layer.hidden = true;
    document.documentElement.classList.remove("touring");
    this.returnFocus?.focus({ preventScroll: true });
  }

  private show(index: number) {
    this.index = Math.max(0, Math.min(this.steps.length - 1, index));
    const step = this.steps[this.index];
    this.count.textContent = t("tour.count", { step: this.index + 1, total: this.steps.length });
    this.title.textContent = stepText(step.id, "title");
    this.text.textContent = stepText(step.id, "text");
    this.back.textContent = t("tour.back");
    this.back.hidden = this.index === 0;
    const last = this.index === this.steps.length - 1;
    this.next.textContent = t(last ? "tour.done" : "tour.next");
    this.close.setAttribute("aria-label", t("tour.close"));
    this.close.title = t("tour.close");
    this.place();
    this.card.focus({ preventScroll: true });
  }

  /** Lights the step's parts and sets its card beside them, inside the window. */
  private place() {
    if (!this.running) return;
    const { spot, card, layer } = this;
    const targets = this.steps[this.index].targets();
    const width = window.innerWidth;
    const height = window.innerHeight;
    layer.classList.toggle("whole", targets.length === 0);
    card.style.left = card.style.top = "";

    if (targets.length === 0) {
      spot.hidden = true;
      card.style.left = `${Math.round((width - card.offsetWidth) / 2)}px`;
      card.style.top = `${Math.round((height - card.offsetHeight) / 2)}px`;
      return;
    }

    const boxes = targets.map((n) => n.getBoundingClientRect());
    const pad = 6;
    const box = {
      left: Math.max(2, Math.min(...boxes.map((b) => b.left)) - pad),
      top: Math.max(2, Math.min(...boxes.map((b) => b.top)) - pad),
      right: Math.min(width - 2, Math.max(...boxes.map((b) => b.right)) + pad),
      bottom: Math.min(height - 2, Math.max(...boxes.map((b) => b.bottom)) + pad),
    };
    spot.hidden = false;
    Object.assign(spot.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.right - box.left}px`,
      height: `${box.bottom - box.top}px`,
    });

    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const clampX = (x: number) => Math.max(EDGE, Math.min(width - w - EDGE, x));
    const clampY = (y: number) => Math.max(EDGE, Math.min(height - h - EDGE, y));
    const midX = (box.left + box.right) / 2 - w / 2;
    const midY = (box.top + box.bottom) / 2 - h / 2;
    // Below, above, right, then left of the parts: the first side with room.
    const sides: [boolean, number, number][] = [
      [height - box.bottom - GAP - EDGE >= h, clampX(midX), box.bottom + GAP],
      [box.top - GAP - EDGE >= h, clampX(midX), box.top - GAP - h],
      [width - box.right - GAP - EDGE >= w, box.right + GAP, clampY(midY)],
      [box.left - GAP - EDGE >= w, box.left - GAP - w, clampY(midY)],
    ];
    // No side has room (a short screen): the roomier of above and below,
    // overlapping the parts as little as possible.
    const fallback: [boolean, number, number] =
      box.top > height - box.bottom ? [true, clampX(midX), clampY(box.top - GAP - h)] : [true, clampX(midX), clampY(box.bottom + GAP)];
    const [, x, y] = sides.find(([fits]) => fits) ?? fallback;
    card.style.left = `${Math.round(x)}px`;
    card.style.top = `${Math.round(y)}px`;
  }
}

/**
 * Shortly after the site opens, asks newcomers whether they want the tour,
 * unless they asked not to see the prompt again. `busy` says when the page is
 * showing something else that the prompt would cover.
 */
export function setupWelcome(welcome: HTMLElement, tour: Tour, busy: () => boolean) {
  const off = welcome.querySelector<HTMLInputElement>("input[type=checkbox]")!;
  off.addEventListener("change", () => store(WELCOME_OFF_KEY, off.checked ? "1" : null));
  // Turned down: the prompt shrinks into the "Open tour" button.
  const refuse = () => {
    if (welcome.hidden) return;
    dock(welcome);
    welcome.hidden = true;
  };
  welcome.querySelector("[data-guide]")!.addEventListener("click", () => {
    welcome.hidden = true;
    tour.start();
  });
  for (const b of welcome.querySelectorAll("[data-close]")) b.addEventListener("click", refuse);
  welcome.addEventListener("keydown", (e) => {
    if (e.key === "Escape") refuse();
  });
  const button = $("#tour-button")!;
  if (stored(WELCOME_OFF_KEY)) {
    button.hidden = false;
    return;
  }
  setTimeout(() => {
    if (!busy() && !tour.running) welcome.hidden = false;
    else button.hidden = false;
  }, WELCOME_DELAY);
}
