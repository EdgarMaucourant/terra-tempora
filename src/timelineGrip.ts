import type { Timeline } from "./timeline";

const STORAGE_KEY = "history-globe:timeline-track-height";
// The timeline can grow to this share of the window's height.
const MAX_SHARE = 0.6;
const KEY_STEP = 24;

function readStored(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

function store(height: number | null) {
  try {
    if (height === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(Math.round(height)));
  } catch {
    // Storage blocked; the height lasts until the page reloads.
  }
}

/**
 * Lets the timeline panel be resized by dragging the grip on its top edge
 * (or with the arrow keys when the grip has focus). Double-click resets it.
 * The chosen height is remembered in this browser.
 */
export function attachTimelineGrip(grip: HTMLElement, panel: HTMLElement, track: HTMLElement, timeline: Timeline) {
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

  let drag: { y: number; start: number } | null = null;
  grip.addEventListener("pointerdown", (e) => {
    grip.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, start: track.offsetHeight };
    grip.classList.add("dragging");
    e.preventDefault();
  });
  grip.addEventListener("pointermove", (e) => {
    // The panel sits at the bottom of the screen, so dragging up makes it taller.
    if (drag) apply(drag.start + (drag.y - e.clientY));
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    grip.classList.remove("dragging");
    store(height);
  };
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
  grip.addEventListener("dblclick", () => {
    apply(null);
    store(null);
  });
  grip.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowUp" ? KEY_STEP : e.key === "ArrowDown" ? -KEY_STEP : 0;
    if (!step) return;
    e.preventDefault();
    apply(track.offsetHeight + step);
    store(height);
  });
  window.addEventListener("resize", () => {
    if (height !== null) apply(height);
  });

  apply(readStored());
}
