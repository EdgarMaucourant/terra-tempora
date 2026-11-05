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
import { MUTED } from "./colors";
import { highlightOf, type Polity } from "./data";
import { inRing } from "./frame";

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
// Realms this large (km²) catch the eye when they appear late: they are built
// first, and playback waits for them (see readyAt). Smaller ones may follow.
const BIG_AREA = 100_000;
// Coarse outlines are seen from afar, where triangles this large (degrees)
// look the same as 1° ones and take about half the time to cut.
const COARSE_GRANULARITY = 2;

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
  /** The shape's finer outline, being built to take this one's place. */
  next?: ShapeGraphics;
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

interface LayerState {
  /** Shapes are still being built or downloaded; draw again next frame. */
  pending: boolean;
  /** Shapes visible at this year. */
  visible: number;
}

/** A ring's closed border line at a height, for picking as `id`. */
function border(ring: number[], height: number, width: number, id?: Polity): GeometryInstance {
  const positions: number[] = [];
  for (let i = 0; i < ring.length; i += 2) positions.push(ring[i], ring[i + 1], height);
  positions.push(ring[0], ring[1], height);
  return new GeometryInstance({
    id,
    geometry: new PolylineGeometry({
      positions: Cartesian3.fromDegreesArrayHeights(positions),
      width,
      arcType: ArcType.GEODESIC,
      vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
    }),
  });
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
  /** Shapes drawn with a coarse outline whose detailed one has arrived. */
  private stale = new Set<number>();
  showContext = true;
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

  /**
   * Adds downloaded shapes; shapes already known are skipped, unless the new
   * one is the detailed outline of a coarse one, which it then replaces.
   */
  add(polities: Polity[]) {
    for (const p of polities) {
      const known = this.polities.get(p.id);
      if (known && !(known.coarse && !p.coarse)) continue;
      this.polities.set(p.id, p);
      // A coarse outline already drawn stays until the detailed one is ready.
      if (this.graphics.has(p.id)) this.stale.add(p.id);
    }
  }

  /**
   * Years ahead of the current one whose shapes are built in advance; raised
   * while playing so shapes are ready by the time their year comes.
   */
  lookahead = 3;

  /**
   * True when every large realm showing at `year` is built and ready to draw,
   * so playback can move on without big borders popping in late.
   */
  readyAt(year: number): boolean {
    for (const p of this.polities.values()) {
      if (p.area < BIG_AREA || shapeOpacity(p, year) <= 0.002) continue;
      if (!(this.showContext || this.isHighlighted(p))) continue;
      const g = this.graphics.get(p.id);
      if (!g || !g.fill.ready || !g.line.ready) return false;
    }
    return true;
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

  /** The realms drawn at `year`, coloured or greyed, one shape per realm name. */
  at(year: number): Polity[] {
    const y = Math.round(year);
    const byName = new Map<string, Polity>();
    for (const p of this.polities.values()) {
      if (y < p.from || y > p.to || !(this.showContext || this.isHighlighted(p))) continue;
      const seen = byName.get(p.name);
      // The detailed shape over the coarse one, and the one with a label.
      if (!seen || (seen.coarse && !p.coarse) || (!seen.label && p.label)) byName.set(p.name, p);
    }
    return [...byName.values()];
  }

  /** A realm's colour on the globe, or undefined when it is greyed. */
  colorOf(p: Polity): string | undefined {
    return highlightOf(this.highlight, p);
  }

  isHighlighted(p: Polity): boolean {
    return highlightOf(this.highlight, p) !== undefined;
  }

  /** Draws these rings as a dashed white border above every realm, or none. */
  setOutline(rings: number[][] | null) {
    if (this.outline) this.scene.primitives.remove(this.outline);
    this.outline = null;
    if (!rings?.length) return;
    const height = FEATURED_HEIGHT + 3000;
    this.outline = this.scene.primitives.add(
      new Primitive({
        geometryInstances: rings.map((ring) => border(ring, height, 2.5)),
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

  /** Colours the given realms and greys out the rest. */
  setHighlight(colors: Map<string, string>) {
    const changed = new Set<string>();
    for (const [name, color] of colors) if (this.highlight.get(name) !== color) changed.add(name);
    for (const name of this.highlight.keys()) if (!colors.has(name)) changed.add(name);
    this.highlight = new Map(colors);
    // Shapes whose colour or height changes are rebuilt on the next update.
    for (const [id, g] of this.graphics) {
      const p = this.polities.get(id)!;
      if (changed.has(p.name) || p.groups?.some((name) => changed.has(name))) this.free(id, g);
    }
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
    // Build shapes before they are needed so playback stays smooth: those due
    // within a year first, largest first, as a big realm appearing late is
    // seen at once while a small one goes unnoticed; then those further ahead.
    const due: Polity[] = [];
    for (const p of this.polities.values()) {
      if (this.graphics.has(p.id) || !(this.showContext || this.isHighlighted(p))) continue;
      if (year >= p.from - this.lookahead && year <= p.to + 1) due.push(p);
    }
    if (due.length) {
      const later = (p: Polity) => (p.from <= year + 1 ? 0 : 1);
      due.sort((a, b) => later(a) - later(b) || (later(a) ? a.from - b.from : 0) || b.area - a.area);
      for (const p of due.slice(0, BUILDS_PER_FRAME)) this.graphics.set(p.id, this.build(p));
      builds = Math.min(due.length, BUILDS_PER_FRAME);
      if (due.length > BUILDS_PER_FRAME) pending = true;
    }
    for (const p of this.polities.values()) {
      const highlighted = this.isHighlighted(p);
      const visibleKind = highlighted || this.showContext;
      const opacity = visibleKind ? shapeOpacity(p, year) : 0;
      if (opacity > 0.5) visible++;
      let g = this.graphics.get(p.id);
      if (!g) continue;
      if (this.stale.has(p.id) && opacity <= 0.002) {
        // Not on screen: rebuilt from the detailed outline when it next is.
        this.free(p.id, g);
        continue;
      }
      if (this.stale.has(p.id)) {
        if (!g.next && builds < BUILDS_PER_FRAME) {
          g.next = this.build(p);
          builds++;
        }
        const next = g.next;
        if (next?.fill.ready && next.line.ready) {
          g.next = undefined;
          this.free(p.id, g);
          this.graphics.set(p.id, (g = next));
        } else {
          // Shown while still see-through, so CesiumJS builds it.
          if (next) next.fill.show = next.line.show = true;
          pending = true;
        }
      }
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
      } else if (!g.fill.ready || !g.line.ready) pending = true;
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
      // Shapes built ahead for playback are kept too.
      if (distance <= KEEP_YEARS || (year < p.from && distance <= this.lookahead + 1)) continue;
      this.free(id, g);
    }
  }

  private free(id: number, g: ShapeGraphics) {
    for (const each of g.next ? [g, g.next] : [g]) {
      this.scene.primitives.remove(each.fill);
      this.scene.primitives.remove(each.line);
      if (each.label) this.labels.remove(each.label);
    }
    this.graphics.delete(id);
    this.stale.delete(id);
  }

  private build(p: Polity): ShapeGraphics {
    const color = highlightOf(this.highlight, p);
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
              granularity: CesiumMath.RADIANS_PER_DEGREE * (p.coarse ? COARSE_GRANULARITY : 1),
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
      geometryInstances: p.rings.map((ring) => border(ring, height + 300, highlighted ? 2 : 1, p)),
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
        text: this.nameOf(p.name),
        font: highlighted ? "600 15px 'Instrument Sans Variable', sans-serif" : "500 12px 'Instrument Sans Variable', sans-serif",
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

    return { fill, line, fillMaterial, lineMaterial, fillColor, lineColor, highlighted, label };
  }
}
