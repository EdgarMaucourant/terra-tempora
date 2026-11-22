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

/** Room left between the spot tapped and the button. */
const GAP = 14;
/** Room kept free at the edges of the screen. */
const EDGE = 8;

export class DetailsHere {
  private spot: [number, number] | null = null;

  constructor(private parts: DetailsHereParts) {
    parts.button.addEventListener("click", () => {
      this.hide();
      parts.onOpen();
    });
    compactQuery.addEventListener("change", () => {
      if (!compactQuery.matches) this.hide();
    });
  }

  /** Shows the button under this spot, on phones and tablets only. */
  show(spot: [number, number] | null | undefined) {
    if (!compactQuery.matches || !spot) return this.hide();
    this.spot = spot;
    this.place();
  }

  hide() {
    this.spot = null;
    this.parts.button.hidden = true;
  }

  get shown(): boolean {
    return !!this.spot;
  }

  /** Moves the button under its spot; called after every frame of the globe or the map. */
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
    button.hidden = false;
    const w = button.offsetWidth;
    const h = button.offsetHeight;
    const x = Math.max(EDGE, Math.min(innerWidth - w - EDGE, point.x - w / 2));
    const y = Math.max(EDGE, Math.min(bottom - h - EDGE, point.y + GAP));
    button.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
