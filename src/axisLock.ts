// "Natural axis": the globe leans 23.5° on Earth's axis and turns only about
// that axis, as a classroom globe spins in its stand. Dragging spins it east or
// west under the pointer; scrolling or pinching zooms straight in and out, so
// the latitude in view never changes. "Free movement" hands control back to
// CesiumJS.

import { Cartesian2, Cartesian3, Math as CesiumMath, type Camera, type Scene } from "cesium";

interface Orientation {
  heading: number;
  pitch: number;
  roll: number;
}

export class AxisLock {
  private on = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;

  constructor(
    private scene: Scene,
    private camera: Camera,
    private orientation: () => Orientation,
  ) {
    const canvas = scene.canvas;
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.on || (e.pointerType === "mouse" && e.button !== 0)) return;
      this.camera.cancelFlight();
      // Keep turning when the pointer runs off the canvas mid-drag.
      canvas.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      this.pinch = this.spread();
    });
    canvas.addEventListener("pointermove", (e) => {
      const last = this.pointers.get(e.pointerId);
      if (!this.on || !last) return;
      const next = { x: e.offsetX, y: e.offsetY };
      this.pointers.set(e.pointerId, next);
      if (this.pointers.size === 1) this.spin(last, next);
      else if (this.pointers.size === 2) {
        const spread = this.spread();
        if (this.pinch && spread) this.zoom(this.pinch / spread);
        this.pinch = spread;
      }
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      this.pinch = this.spread();
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.on) return;
        e.preventDefault();
        this.camera.cancelFlight();
        this.zoom(Math.exp(Math.max(-1, Math.min(1, e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)))));
      },
      { passive: false },
    );
  }

  get enabled(): boolean {
    return this.on;
  }

  set enabled(on: boolean) {
    this.on = on;
    this.pointers.clear();
    const control = this.scene.screenSpaceCameraController;
    control.enableRotate = !on;
    control.enableTilt = !on;
    control.enableLook = !on;
    control.enableZoom = !on;
    control.enableTranslate = !on;
  }

  /** Distance between two touching fingers, 0 with fewer. */
  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private longitudeAt(p: { x: number; y: number }): number | null {
    const at = this.camera.pickEllipsoid(new Cartesian2(p.x, p.y), this.scene.globe.ellipsoid);
    return at ? this.scene.globe.ellipsoid.cartesianToCartographic(at).longitude : null;
  }

  /** Turns the globe about its axis so the longitude under the pointer follows it. */
  private spin(from: { x: number; y: number }, to: { x: number; y: number }) {
    const place = this.camera.positionCartographic;
    const a = this.longitudeAt(from);
    const b = this.longitudeAt(to);
    let turn: number;
    if (a !== null && b !== null) {
      turn = a - b;
      if (turn > Math.PI) turn -= 2 * Math.PI;
      if (turn < -Math.PI) turn += 2 * Math.PI;
    } else {
      // Off the globe's edge: turn by the drag along the leaning equator.
      const heading = this.orientation().heading;
      const along = (to.x - from.x) * Math.cos(heading) + (to.y - from.y) * Math.sin(heading);
      turn = (-along * place.height) / 6_371_000 / Math.max(0.2, Math.cos(place.latitude)) / 600;
    }
    this.place(place.longitude + turn, place.latitude, place.height);
  }

  private zoom(factor: number) {
    const place = this.camera.positionCartographic;
    const control = this.scene.screenSpaceCameraController;
    const height = Math.min(control.maximumZoomDistance, Math.max(control.minimumZoomDistance, place.height * factor));
    this.place(place.longitude, place.latitude, height);
  }

  private place(longitude: number, latitude: number, height: number) {
    this.camera.setView({
      destination: Cartesian3.fromRadians(CesiumMath.negativePiToPi(longitude), latitude, height),
      orientation: this.orientation(),
    });
    this.scene.requestRender();
  }
}
