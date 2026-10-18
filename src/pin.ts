// The pin that marks the spot a visitor reported, when a reviewer opens the
// link in the report's issue (#…&p=<lon>,<lat>). The globe shows it as a
// billboard; the map draws the same picture (see MapView.setPin).
import { BillboardCollection, Cartesian3, Scene, VerticalOrigin } from "cesium";

export const PIN_WIDTH = 30;
export const PIN_HEIGHT = 40;

/** A map pin: a red drop with a white dot, its tip at the bottom middle. */
export const PIN_URL = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 30 40">` +
    `<path d="M15 39C15 39 2 23.5 2 14a13 13 0 0 1 26 0c0 9.5-13 25-13 25z" fill="#e5484d" stroke="#fff" stroke-width="2"/>` +
    `<circle cx="15" cy="14" r="5" fill="#fff"/></svg>`,
)}`;

/** Reads "lon,lat" from a link, or null when it isn't a place on Earth. */
export function parsePin(value: string | null): [number, number] | null {
  const [lon, lat] = (value ?? "").split(",").map(Number);
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 ? [lon, lat] : null;
}

/** The pin on the globe. */
export class PinLayer {
  private collection: BillboardCollection;

  constructor(private scene: Scene) {
    this.collection = scene.primitives.add(new BillboardCollection({ scene })) as BillboardCollection;
  }

  set(lonLat: [number, number] | null) {
    this.collection.removeAll();
    if (lonLat) {
      this.collection.add({
        // Raised like the event badges, so the realms' shapes don't cover it.
        position: Cartesian3.fromDegrees(lonLat[0], lonLat[1], 40_000),
        image: PIN_URL,
        width: PIN_WIDTH,
        height: PIN_HEIGHT,
        verticalOrigin: VerticalOrigin.BOTTOM,
      });
    }
    this.scene.requestRender();
  }
}
