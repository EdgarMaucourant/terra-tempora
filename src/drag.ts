import { compactQuery } from "./layout";

/** Controls inside a handle that keep their own clicks instead of starting a drag. */
const CONTROLS = "button, a, input, select, textarea, label, [role=button], [contenteditable]";
/** How far the pointer moves before a press on the handle counts as a drag. */
const THRESHOLD = 4;
/** Room kept between the pop-up and the window's edge. */
const MARGIN = 8;

/**
 * Lets the user move a pop-up by dragging `handle` (its header), on computers
 * only: the compact layout (phones, tablets) keeps its fixed pop-ups. The
 * pop-up stays inside the window. Once it has moved, `overlay` (the dimmed
 * backdrop, if any) gets the `moved` class so the map behind shows through.
 * The pop-up goes back to its place when `overlay` (or the pop-up itself) is
 * hidden, on a double-click on the handle, and when the layout turns compact.
 */
export function makeDraggable(panel: HTMLElement, handle: HTMLElement, overlay: HTMLElement = panel) {
  let x = 0;
  let y = 0;

  const place = (nx: number, ny: number) => {
    // Clamp against where the pop-up would sit with no offset.
    const r = panel.getBoundingClientRect();
    const left = r.left - x;
    const top = r.top - y;
    const minX = Math.min(0, MARGIN - left);
    const maxX = Math.max(0, innerWidth - MARGIN - (left + r.width));
    const minY = Math.min(0, MARGIN - top);
    const maxY = Math.max(0, innerHeight - MARGIN - (top + r.height));
    x = Math.round(Math.min(maxX, Math.max(minX, nx)));
    y = Math.round(Math.min(maxY, Math.max(minY, ny)));
    panel.style.translate = x || y ? `${x}px ${y}px` : "";
    overlay.classList.toggle("moved", !!(x || y));
  };

  const reset = () => {
    x = y = 0;
    panel.style.translate = "";
    overlay.classList.remove("moved");
  };

  const sync = () => {
    handle.classList.toggle("drag-handle", !compactQuery.matches);
    if (compactQuery.matches) reset();
  };
  sync();
  compactQuery.addEventListener("change", sync);

  handle.addEventListener("pointerdown", (e) => {
    if (compactQuery.matches || e.button !== 0 || !e.isPrimary) return;
    if ((e.target as Element).closest(CONTROLS)) return;
    const startX = e.clientX - x;
    const startY = e.clientY - y;
    let dragging = false;

    const move = (m: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(m.clientX - e.clientX, m.clientY - e.clientY) < THRESHOLD) return;
        dragging = true;
        handle.classList.add("dragging");
      }
      m.preventDefault();
      place(m.clientX - startX, m.clientY - startY);
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      handle.classList.remove("dragging");
      if (!dragging) return;
      // A drag that ends over the backdrop must not count as a click on it,
      // which would close the pop-up.
      const swallow = (c: MouseEvent) => {
        c.stopPropagation();
        c.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    // Follow the pointer even when it leaves the header.
    handle.setPointerCapture(e.pointerId);
    // No text selection while dragging the header.
    e.preventDefault();
  });

  handle.addEventListener("dblclick", (e) => {
    if (!compactQuery.matches && !(e.target as Element).closest(CONTROLS)) reset();
  });

  // Keep a moved pop-up inside a smaller window.
  addEventListener("resize", () => {
    if (x || y) place(x, y);
  });

  // Back to its place each time it is closed, so it opens where it always does.
  const watch = new MutationObserver(() => {
    if (overlay.hidden || panel.hidden) reset();
  });
  for (const el of new Set([overlay, panel])) watch.observe(el, { attributes: true, attributeFilter: ["hidden"] });
}
