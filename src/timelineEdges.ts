// The timeline spans the window, a margin in from each side. Dragging its left
// or right edge (or the arrow keys on a focused edge) narrows or widens it from
// that side; double-click an edge to reset it. The margins are remembered.

import { store, stored } from "./storage";

const STORAGE_KEY = "terra-tempora:timeline-margins";
// The smallest margin, so the timeline never touches the window's edge.
const MARGIN = 16;
const MIN_WIDTH = 480;
const KEY_STEP = 24;

type Side = "left" | "right";

function readStored(): Record<Side, number> {
  let value: Partial<Record<Side, number>> | null = null;
  try {
    value = JSON.parse(stored(STORAGE_KEY) ?? "null");
  } catch {
    // A damaged value: the default margins stand.
  }
  return { left: Number(value?.left) || MARGIN, right: Number(value?.right) || MARGIN };
}

function storeMargins(margins: Record<Side, number>) {
  store(STORAGE_KEY, margins.left === MARGIN && margins.right === MARGIN ? null : JSON.stringify(margins));
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
      storeMargins(margins);
    };
    edge.addEventListener("pointerup", end);
    edge.addEventListener("pointercancel", end);
    edge.addEventListener("dblclick", () => {
      margins[side] = MARGIN;
      apply();
      storeMargins(margins);
    });
    edge.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? KEY_STEP : e.key === "ArrowLeft" ? -KEY_STEP : 0;
      if (!step) return;
      e.preventDefault();
      margins[side] += sign * step;
      apply();
      storeMargins(margins);
    });
  }
  window.addEventListener("resize", apply);
  apply();
}
