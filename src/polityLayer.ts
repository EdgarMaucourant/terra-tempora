import {
  ArcType,
  Cartesian3,
  Color,
  GeometryInstance,
  HorizontalOrigin,
  Label,
  LabelCollection,
  LabelStyle,
  Material,
  MaterialAppearance,
  Math as CesiumMath,
  NearFarScalar,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  Scene,
  VerticalOrigin,
} from "cesium";
import type { Polity } from "./data";
import { MUTED } from "./colors";

// Shapes float slightly above the globe surface so they never z-fight with it.
const CONTEXT_HEIGHT = 2500;
const FEATURED_HEIGHT = 5000;
const FEATURED_FILL_ALPHA = 0.5;
const CONTEXT_FILL_ALPHA = 0.4;
// A greyed realm under the pointer lights up to this.
const HOVER_FILL_ALPHA = 0.62;
// Width, in years, of the crossfade between two consecutive snapshots.
const FADE = 0.6;
// Context realms this large (km²) get a name on the globe.
const CONTEXT_LABEL_AREA = 900_000;
// Shapes built per frame, so a fast scrub never freezes the page.
const BUILDS_PER_FRAME = 40;
// Above this many built shapes, those far from the current year are freed.
const MAX_BUILT = 1500;
const KEEP_YEARS = 30;

interface ShapeGraphics {
  fill: Primitive;
  line: Primitive;
  fillMaterial: Material;
  lineMaterial: Material;
  fillColor: Color;
  lineColor: Color;
  /** Drawn in the highlight colours rather than greyed out. */
  highlighted: boolean;
  label?: Label;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Opacity of a shape at a (fractional) year. A shape owns the span from half a
 * year before its first year to half a year after its last, and fades across
 * each edge so consecutive snapshots blend into each other.
 */
export function shapeOpacity(p: Polity, year: number): number {
  const start = p.from - 0.5;
  const end = p.to + 0.5;
  return smoothstep(start - FADE / 2, start + FADE / 2, year) * (1 - smoothstep(end - FADE / 2, end + FADE / 2, year));
}

/** Whether a point lies inside a flat [lon, lat, …] ring (even-odd rule). */
function inRing(ring: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const yi = ring[i + 1];
    const yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((ring[j] - ring[i]) * (y - yi)) / (yj - yi) + ring[i]) inside = !inside;
  }
  return inside;
}

export interface LayerState {
  /** Shapes are still being built or downloaded; draw again next frame. */
  pending: boolean;
  /** Shapes visible at this year. */
  visible: number;
}

export class PolityLayer {
  private polities = new Map<number, Polity>();
  private graphics = new Map<number, ShapeGraphics>();
  private labels: LabelCollection;
  /** Colours of the highlighted realms, by Cliopatria name. Others are grey. */
  private highlight = new Map<string, string>();
  /** Name of the greyed realm under the pointer. */
  private hovered: string | null = null;
  /** Today's border of the country being looked at. */
  private outline: Primitive | null = null;
  showContext = false;
  /**
   * Whether every highlighted realm is named; when false (today's map, where
   * every country is coloured), only the large ones are, like greyed realms.
   */
  labelAll = true;
  /** A realm's name as shown on its label. */
  nameOf = (realm: string) => realm;

  constructor(private scene: Scene) {
    this.labels = scene.primitives.add(new LabelCollection({ scene }));
  }

  /** Adds downloaded shapes; shapes already known are skipped. */
  add(polities: Polity[]) {
    for (const p of polities) if (!this.polities.has(p.id)) this.polities.set(p.id, p);
  }

  /**
   * Label point of the largest shape among these realm names that exists at
   * `year`, or null when none of them is downloaded for that year.
   */
  labelAt(names: string[], year: number): [number, number] | null {
    let best: Polity | null = null;
    for (const p of this.polities.values()) {
      if (!p.label || year < p.from || year > p.to || !names.includes(p.name)) continue;
      if (!best || p.area > best.area) best = p;
    }
    return best?.label ?? null;
  }

  /**
   * Name of the realm that covers a point at `year`, the smallest when several
   * overlap, or null when none of the downloaded shapes covers it.
   */
  realmAt(lon: number, lat: number, year: number): string | null {
    let best: Polity | null = null;
    for (const p of this.polities.values()) {
      if (year < p.from || year > p.to || (best && p.area >= best.area)) continue;
      if (p.rings.some((ring) => inRing(ring, lon, lat))) best = p;
    }
    return best?.name ?? null;
  }

  isHighlighted(name: string): boolean {
    return this.highlight.has(name);
  }

  /** Colours the given realms and greys out the rest. */
  /** Draws these rings as a dashed white border above every realm, or none. */
  setOutline(rings: number[][] | null) {
    if (this.outline) this.scene.primitives.remove(this.outline);
    this.outline = null;
    if (!rings?.length) return;
    const height = FEATURED_HEIGHT + 3000;
    this.outline = this.scene.primitives.add(
      new Primitive({
        geometryInstances: rings.map((ring) => {
          const positions: number[] = [];
          for (let i = 0; i < ring.length; i += 2) positions.push(ring[i], ring[i + 1], height);
          positions.push(ring[0], ring[1], height);
          return new GeometryInstance({
            geometry: new PolylineGeometry({
              positions: Cartesian3.fromDegreesArrayHeights(positions),
              width: 2.5,
              arcType: ArcType.GEODESIC,
              vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
            }),
          });
        }),
        appearance: new PolylineMaterialAppearance({
          material: Material.fromType("PolylineDash", {
            color: Color.WHITE,
            gapColor: Color.BLACK.withAlpha(0.35),
            dashLength: 14,
          }),
        }),
        asynchronous: true,
      }),
    ) as Primitive;
  }

  setHighlight(colors: Map<string, string>) {
    const changed = new Set<string>();
    for (const [name, color] of colors) if (this.highlight.get(name) !== color) changed.add(name);
    for (const name of this.highlight.keys()) if (!colors.has(name)) changed.add(name);
    this.highlight = new Map(colors);
    // Shapes whose colour or height changes are rebuilt on the next update.
    for (const [id, g] of this.graphics) if (changed.has(this.polities.get(id)!.name)) this.free(id, g);
  }

  /** Lights up a greyed realm under the pointer; null clears it. */
  setHovered(name: string | null) {
    this.hovered = name;
  }

  /** Shows the shapes that exist at `year`. */
  update(year: number): LayerState {
    let pending = false;
    let visible = 0;
    let builds = 0;
    for (const p of this.polities.values()) {
      const highlighted = this.highlight.has(p.name);
      const visibleKind = highlighted || this.showContext;
      const opacity = visibleKind ? shapeOpacity(p, year) : 0;
      if (opacity > 0.5) visible++;
      let g = this.graphics.get(p.id);
      // Build shapes shortly before they are needed so playback stays smooth.
      if (!g && visibleKind && year >= p.from - 3 && year <= p.to + 1) {
        if (builds < BUILDS_PER_FRAME) {
          g = this.build(p);
          builds++;
        } else pending = true;
      }
      if (!g) continue;
      const show = opacity > 0.002;
      g.fill.show = show;
      g.line.show = show;
      if (show) {
        const hovered = !g.highlighted && p.name === this.hovered;
        const base = g.highlighted ? FEATURED_FILL_ALPHA : hovered ? HOVER_FILL_ALPHA : CONTEXT_FILL_ALPHA;
        const lineAlpha = hovered ? 0.95 : g.lineColor.alpha;
        g.fillMaterial.uniforms.color = Color.fromAlpha(g.fillColor, base * opacity, g.fillMaterial.uniforms.color);
        g.lineMaterial.uniforms.color = Color.fromAlpha(g.lineColor, lineAlpha * opacity, g.lineMaterial.uniforms.color);
        if (!g.fill.ready || !g.line.ready) pending = true;
      }
      // Labels switch at the midpoint of a fade. Changing a label's colour
      // redraws its glyphs, which is too costly to do every frame.
      if (g.label) g.label.show = opacity > 0.5;
    }
    if (this.graphics.size > MAX_BUILT) this.release(year);
    return { pending, visible };
  }

  /** Frees the shapes far from `year`; they are rebuilt if the year comes back. */
  private release(year: number) {
    for (const [id, g] of this.graphics) {
      const p = this.polities.get(id)!;
      const distance = year < p.from ? p.from - year : year - p.to;
      if (distance <= KEEP_YEARS) continue;
      this.free(id, g);
    }
  }

  private free(id: number, g: ShapeGraphics) {
    this.scene.primitives.remove(g.fill);
    this.scene.primitives.remove(g.line);
    if (g.label) this.labels.remove(g.label);
    this.graphics.delete(id);
  }

  private build(p: Polity): ShapeGraphics {
    const color = this.highlight.get(p.name);
    const highlighted = color !== undefined;
    const height = highlighted ? FEATURED_HEIGHT : CONTEXT_HEIGHT;
    const fillColor = Color.fromCssColorString(color ?? MUTED);
    const lineColor = highlighted
      ? Color.fromCssColorString(color).brighten(0.35, new Color()).withAlpha(0.95)
      : Color.fromCssColorString("#e4e7ea").withAlpha(0.45);

    const fillMaterial = Material.fromType("Color", { color: fillColor.withAlpha(0) });
    const fill = new Primitive({
      geometryInstances: p.rings.map(
        (ring) =>
          new GeometryInstance({
            id: p,
            geometry: new PolygonGeometry({
              polygonHierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(ring)),
              height,
              granularity: CesiumMath.RADIANS_PER_DEGREE,
              vertexFormat: MaterialAppearance.MaterialSupport.BASIC.vertexFormat,
            }),
          }),
      ),
      appearance: new MaterialAppearance({
        material: fillMaterial,
        materialSupport: MaterialAppearance.MaterialSupport.BASIC,
        translucent: true,
        flat: true,
        faceForward: true,
      }),
      asynchronous: true,
      show: false,
    });

    const lineMaterial = Material.fromType("Color", { color: lineColor.withAlpha(0) });
    const line = new Primitive({
      geometryInstances: p.rings.map((ring) => {
        const positions: number[] = [];
        for (let i = 0; i < ring.length; i += 2) positions.push(ring[i], ring[i + 1], height + 300);
        positions.push(ring[0], ring[1], height + 300);
        return new GeometryInstance({
          id: p,
          geometry: new PolylineGeometry({
            positions: Cartesian3.fromDegreesArrayHeights(positions),
            width: highlighted ? 2 : 1,
            arcType: ArcType.GEODESIC,
            vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
          }),
        });
      }),
      appearance: new PolylineMaterialAppearance({ material: lineMaterial, translucent: true }),
      asynchronous: true,
      show: false,
    });

    this.scene.primitives.add(fill);
    this.scene.primitives.add(line);

    let label: Label | undefined;
    const labelColor = highlighted ? Color.fromCssColorString("#fbf6ec") : Color.fromCssColorString("#b4bac1");
    if (p.label && ((highlighted && this.labelAll) || p.area >= CONTEXT_LABEL_AREA)) {
      label = this.labels.add({
        id: p,
        position: Cartesian3.fromDegrees(p.label[0], p.label[1], height + 2000),
        // Cliopatria writes a realm's overseas parts as "(Name)".
        text: this.nameOf(p.name).replace(/^\((.*)\)$/, "$1"),
        font: highlighted ? "600 15px 'Instrument Sans', sans-serif" : "500 12px 'Instrument Sans', sans-serif",
        fillColor: labelColor,
        outlineColor: Color.BLACK.withAlpha(0.85),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        scaleByDistance: new NearFarScalar(2e6, 1.15, 2.5e7, 0.8),
        show: false,
      });
    }

    const g: ShapeGraphics = { fill, line, fillMaterial, lineMaterial, fillColor, lineColor, highlighted, label };
    this.graphics.set(p.id, g);
    return g;
  }
}
