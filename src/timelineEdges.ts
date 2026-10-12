// The timeline spans the window, a margin in from each side. Dragging its left
// or right edge (or the arrow keys on a focused edge) narrows or widens it from
// that side; double-click an edge to reset it. The margins are remembered.

const STORAGE_KEY = "terra-tempora:timeline-margins";
// The smallest margin, so the timeline never touches the window's edge.
const MARGIN = 16;
const MIN_WIDTH = 480;
const KEY_STEP = 24;

type Side = "left" | "right";

function readStored(): Record<Side, number> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Record<Side, number>> | null;
    return { left: Number(value?.left) || MARGIN, right: Number(value?.right) || MARGIN };
  } catch {
    return { left: MARGIN, right: MARGIN };
  }
}

function store(margins: Record<Side, number>) {
  try {
    if (margins.left === MARGIN && margins.right === MARGIN) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(margins));
  } catch {
    // Storage blocked; the margins last until the page reloads.
  }
}

export function attachTimelineEdges(left: HTMLElement, right: HTMLElement) {
  const margins = readStored();
  const root = document.documentElement.style;

  const apply = () => {
    // Each side keeps its margin; together they leave the timeline its least width.
    const room = Math.max(0, window.innerWidth - MIN_WIDTH - 2 * MARGIN);
    for (const side of ["left", "right"] as const) margins[side] = Math.max(MARGIN, Math.round(margins[side]));
    const extra = margins.left + margins.right - 2 * MARGIN;
    if (extra > room) {
      const scale = room / extra;
      margins.left = MARGIN + Math.round((margins.left - MARGIN) * scale);
      margins.right = MARGIN + Math.round((margins.right - MARGIN) * scale);
    }
    root.setProperty("--timeline-left", `${margins.left}px`);
    root.setProperty("--timeline-right", `${margins.right}px`);
    left.setAttribute("aria-valuenow", String(margins.left));
    right.setAttribute("aria-valuenow", String(margins.right));
  };

  for (const [edge, side] of [
    [left, "left"],
    [right, "right"],
  ] as const) {
    // Moving the left edge right, or the right edge left, makes that margin wider.
    const sign = side === "left" ? 1 : -1;
    let drag: { x: number; start: number } | null = null;
    edge.addEventListener("pointerdown", (e) => {
      edge.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, start: margins[side] };
      edge.classList.add("dragging");
      e.preventDefault();
      e.stopPropagation();
    });
    edge.addEventListener("pointermove", (e) => {
      if (!drag) return;
      margins[side] = drag.start + sign * (e.clientX - drag.x);
      apply();
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      edge.classList.remove("dragging");
      store(margins);
    };
    edge.addEventListener("pointerup", end);
    edge.addEventListener("pointercancel", end);
    edge.addEventListener("dblclick", () => {
      margins[side] = MARGIN;
      apply();
      store(margins);
    });
    edge.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? KEY_STEP : e.key === "ArrowLeft" ? -KEY_STEP : 0;
      if (!step) return;
      e.preventDefault();
      margins[side] += sign * step;
      apply();
      store(margins);
    });
  }
  window.addEventListener("resize", apply);
  apply();
}
