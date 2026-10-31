import { Billboard, BillboardCollection, Cartesian3, Color, NearFarScalar, Scene, VerticalOrigin } from "cesium";
import { badgeUrl, eventOpacity, type HistoryEvent } from "./events";

// Badges float above the realms and their names.
const HEIGHT = 40_000;
const SIZE = 30;

/** Event badges on the globe, shown in the years around each event. */
export class EventLayer {
  private collection: BillboardCollection;
  private badges = new Map<HistoryEvent, Billboard>();

  constructor(private scene: Scene) {
    this.collection = scene.primitives.add(new BillboardCollection({ scene })) as BillboardCollection;
  }

  /** The events that may show: those of the highlighted civilizations. */
  set(events: HistoryEvent[]) {
    this.collection.removeAll();
    this.badges.clear();
    for (const e of events) {
      const badge = this.collection.add({
        id: e,
        position: Cartesian3.fromDegrees(e.lonLat[0], e.lonLat[1], HEIGHT),
        image: badgeUrl(e.kind),
        width: SIZE,
        height: SIZE,
        verticalOrigin: VerticalOrigin.CENTER,
        scaleByDistance: new NearFarScalar(1.5e6, 1.15, 2.5e7, 0.7),
        show: false,
      });
      this.badges.set(e, badge);
    }
  }

  /** Shows each badge at its opacity for this year, or as `opacityOf` says. */
  update(year: number, opacityOf: (e: HistoryEvent) => number = (e) => eventOpacity(e, year)) {
    for (const [e, badge] of this.badges) {
      const opacity = opacityOf(e);
      badge.show = opacity > 0;
      if (!badge.show) continue;
      badge.color = Color.WHITE.withAlpha(opacity);
      badge.scale = opacity === 1 ? 1 : 0.8;
    }
    this.scene.requestRender();
  }
}
