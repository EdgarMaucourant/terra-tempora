import { store, stored } from "./storage";
import type { Timeline } from "./timeline";

const STORAGE_KEY = "terra-tempora:timeline-track-height";
// The timeline can grow to this share of the window's height.
const MAX_SHARE = 0.6;
const KEY_STEP = 24;

function readStored(): number | null {
  const value = Number(stored(STORAGE_KEY));
  return value > 0 ? value : null;
}

function storeHeight(height: number | null) {
  store(STORAGE_KEY, height === null ? null : String(Math.round(height)));
}

/** A drag shorter than this is a tap. */
const TAP_SLOP = 5;

/**
 * Lets the timeline panel be resized by dragging the grip on its top edge
 * (or with the arrow keys when the grip has focus). Double-click resets it.
 * The chosen height is remembered in this browser.
 *
 * Another handle (the fold tab on phones) can resize it too, while
 * `canDrag` allows; a real drag on it marks it `data-dragged` until the
 * click that follows, so its own tap action can tell the two apart.
 */
export function attachTimelineGrip(
  grip: HTMLElement,
  panel: HTMLElement,
  track: HTMLElement,
  timeline: Timeline,
  handle?: { el: HTMLElement; canDrag: () => boolean },
) {
  let height: number | null = null;

  // The track's natural height, without any height set on it.
  const naturalHeight = () => {
    const saved = track.style.height;
    track.style.height = "";
    track.classList.remove("sized");
    const natural = track.offsetHeight;
    if (height !== null) {
      track.style.height = saved;
      track.classList.add("sized");
    }
    return natural;
  };

  const maxHeight = (natural: number) => {
    const chrome = panel.offsetHeight - track.offsetHeight;
    return Math.max(natural, window.innerHeight * MAX_SHARE - chrome);
  };

  const apply = (next: number | null) => {
    const natural = naturalHeight();
    height = next === null ? null : Math.min(maxHeight(natural), Math.max(natural, next));
    // Back at its natural height, the track goes back to sizing itself.
    if (height !== null && height <= natural + 1) height = null;
    timeline.setHeight(height);
    grip.setAttribute("aria-valuenow", String(Math.round(height ?? natural)));
  };

  let drag: { el: HTMLElement; y: number; start: number; moved: boolean } | null = null;
  const draggable = (el: HTMLElement, canDrag = () => true) => {
    el.addEventListener("pointerdown", (e) => {
      if (!canDrag()) return;
      el.setPointerCapture(e.pointerId);
      // The grip resizes from the first pixel; the handle waits to tell a drag from a tap.
      drag = { el, y: e.clientY, start: track.offsetHeight, moved: el === grip };
      el.classList.add("dragging");
      if (el === grip) e.preventDefault();
    });
    el.addEventListener("pointermove", (e) => {
      if (drag?.el !== el) return;
      if (Math.abs(drag.y - e.clientY) > TAP_SLOP) drag.moved = true;
      // The panel sits at the bottom of the screen, so dragging up makes it taller.
      if (drag.moved) apply(drag.start + (drag.y - e.clientY));
    });
    const end = () => {
      if (drag?.el !== el) return;
      if (drag.moved) {
        el.dataset.dragged = "";
        setTimeout(() => delete el.dataset.dragged);
        storeHeight(height);
      }
      drag = null;
      el.classList.remove("dragging");
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  };
  draggable(grip);
  if (handle) draggable(handle.el, handle.canDrag);
  grip.addEventListener("dblclick", () => {
    apply(null);
    storeHeight(null);
  });
  grip.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowUp" ? KEY_STEP : e.key === "ArrowDown" ? -KEY_STEP : 0;
    if (!step) return;
    e.preventDefault();
    apply(track.offsetHeight + step);
    storeHeight(height);
  });
  window.addEventListener("resize", () => {
    if (height !== null) apply(height);
  });

  apply(readStored());
}
