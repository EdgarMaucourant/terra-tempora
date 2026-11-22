// On phones and tablets a tap on a country or territory only chooses it: a
// "More details" button then shows under the spot tapped, and follows it as
// the globe turns or the map pans. Tapping the button opens the text panel.
// Computers keep opening the panel at once.

import { compactQuery } from "./layout";

interface DetailsHereParts {
  button: HTMLButtonElement;
  /** Window coordinates of a [longitude, latitude], or null when it is out of sight (the far side of the globe). */
  toScreen(lonLat: [number, number]): { x: number; y: number } | null;
  onOpen(): void;
}

/** Room left between the land tapped and the button. */
const GAP = 18;
/** Room kept free at the edges of the screen. */
const EDGE = 8;

export class DetailsHere {
  private spot: [number, number] | null = null;
  private outline: [number, number][] = [];

  constructor(private parts: DetailsHereParts) {
    parts.button.addEventListener("click", () => {
      this.hide();
      parts.onOpen();
    });
    compactQuery.addEventListener("change", () => {
      if (!compactQuery.matches) this.hide();
    });
  }

  /**
   * Shows the button under the land tapped, on phones and tablets only: below
   * the lowest point of the piece of the shape tapped, so it never hides it.
   */
  show(spot: [number, number] | null | undefined, rings?: number[][]) {
    if (!compactQuery.matches || !spot) return this.hide();
    this.spot = spot;
    this.outline = outlineAround(spot, rings ?? []);
    this.place();
  }

  hide() {
    this.spot = null;
    this.outline = [];
    this.parts.button.hidden = true;
  }

  get shown(): boolean {
    return !!this.spot;
  }

  /** Moves the button under its land; called after every frame of the globe or the map. */
  place() {
    const { button, toScreen } = this.parts;
    if (!this.spot) return;
    const point = toScreen(this.spot);
    // The timeline covers the foot of the screen.
    const bottom = innerHeight - (document.querySelector("footer")?.offsetHeight ?? 0);
    if (!point || point.x < 0 || point.y < 0 || point.x > innerWidth || point.y > bottom) {
      button.hidden = true;
      return;
    }
    // The lowest point of the land on screen, as the globe turns or the map pans.
    let low = point.y;
    for (const lonLat of this.outline) {
      const p = toScreen(lonLat);
      if (p && p.y > low) low = p.y;
    }
    button.hidden = false;
    const w = button.offsetWidth;
    const h = button.offsetHeight;
    const x = Math.max(EDGE, Math.min(innerWidth - w - EDGE, point.x - w / 2));
    const y = Math.max(EDGE, Math.min(bottom - h - EDGE, low + GAP));
    button.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}

/** Points kept from an outline, enough to find its lowest point on screen each frame. */
const SAMPLES = 400;

/** Whether a point is inside a flat [lon, lat, …] ring. */
function inRing(ring: number[], lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The outline of the piece of land tapped (Laos, not every colony of the
 * empire), as a few hundred [lon, lat] points.
 */
function outlineAround(spot: [number, number], rings: number[][]): [number, number][] {
  // A spot just off a simplified outline goes by the ring nearest to it.
  const nearest = (r: number[]) => {
    let best = Infinity;
    for (let i = 0; i < r.length; i += 2) best = Math.min(best, (r[i] - spot[0]) ** 2 + (r[i + 1] - spot[1]) ** 2);
    return best;
  };
  const ring =
    rings.find((r) => inRing(r, spot[0], spot[1])) ??
    rings.reduce<number[] | undefined>((best, r) => (!best || nearest(r) < nearest(best) ? r : best), undefined);
  if (!ring) return [];
  const step = Math.max(1, Math.ceil(ring.length / 2 / SAMPLES));
  const points: [number, number][] = [];
  for (let i = 0; i < ring.length; i += 2 * step) points.push([ring[i], ring[i + 1]]);
  return points;
}
