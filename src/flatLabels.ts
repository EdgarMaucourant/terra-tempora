import { Cartesian2, Cartesian3, type Scene, SceneTransforms } from "cesium";

/**
 * Names drawn on a flat canvas over the globe rather than in the 3D scene, so
 * that no border or hatching is ever drawn over them, even where the globe
 * curves away near its edge (Cesium blends its labels with the translucent
 * shapes around them).
 */
export interface FlatLabelOptions {
  id?: unknown;
  position: Cartesian3;
  text: string;
  /** A CSS font with its size in px, scaled with the distance. */
  font: string;
  fill: string;
  outline: string;
  outlineWidth: number;
  /** [distance in metres, scale] near and far, as Cesium's NearFarScalar. */
  near: [number, number];
  far: [number, number];
}

/**
 * Puts a long name on two lines: the owner in brackets goes on the second
 * line, or else the name breaks at the space nearest its middle.
 */
export function wrapLabel(text: string, max = 26): string {
  if (text.length <= max) return text;
  const bracket = text.lastIndexOf(" (");
  if (bracket > 0 && text.endsWith(")")) return `${text.slice(0, bracket)}\n${text.slice(bracket + 1)}`;
  const middle = text.length / 2;
  let best = -1;
  for (let i = text.indexOf(" "); i >= 0; i = text.indexOf(" ", i + 1)) if (best < 0 || Math.abs(i - middle) < Math.abs(best - middle)) best = i;
  return best < 0 ? text : `${text.slice(0, best)}\n${text.slice(best + 1)}`;
}

export class FlatLabel {
  show = false;
  pixelOffset = new Cartesian2(0, 0);
  constructor(readonly options: FlatLabelOptions) {}
  get position() {
    return this.options.position;
  }
  get text() {
    return this.options.text;
  }
}

export class FlatLabels {
  private canvas = document.createElement("canvas");
  private all = new Set<FlatLabel>();
  private at = new Cartesian2();

  constructor(private scene: Scene) {
    Object.assign(this.canvas.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", pointerEvents: "none" });
    this.canvas.setAttribute("aria-hidden", "true");
    scene.canvas.parentElement!.appendChild(this.canvas);
    scene.postRender.addEventListener(() => this.draw());
  }

  add(options: FlatLabelOptions): FlatLabel {
    const label = new FlatLabel(options);
    this.all.add(label);
    return label;
  }

  remove(label: FlatLabel) {
    this.all.delete(label);
  }

  private draw() {
    const width = this.scene.canvas.clientWidth;
    const height = this.scene.canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(width * ratio) || this.canvas.height !== Math.round(height * ratio)) {
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
    }
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    const camera = this.scene.camera.positionWC;
    for (const label of this.all) {
      if (!label.show) continue;
      const o = label.options;
      const point = SceneTransforms.worldToWindowCoordinates(this.scene, o.position, this.at);
      if (!point) continue;
      const distance = Cartesian3.distance(camera, o.position);
      const t = Math.min(1, Math.max(0, (distance - o.near[0]) / (o.far[0] - o.near[0])));
      const scale = o.near[1] + (o.far[1] - o.near[1]) * t;
      ctx.font = o.font.replace(/(\d+(?:\.\d+)?)px/, (_, size: string) => `${(Number(size) * scale).toFixed(1)}px`);
      const x = point.x + label.pixelOffset.x;
      const lines = o.text.split("\n");
      // Lines are spaced by the font size, centred on the place as one block.
      const step = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 12) * 1.15;
      lines.forEach((line, i) => {
        const y = point.y + label.pixelOffset.y + (i - (lines.length - 1) / 2) * step;
        if (o.outlineWidth) {
          ctx.strokeStyle = o.outline;
          ctx.lineWidth = o.outlineWidth;
          ctx.strokeText(line, x, y);
        }
        ctx.fillStyle = o.fill;
        ctx.fillText(line, x, y);
      });
    }
  }
}
