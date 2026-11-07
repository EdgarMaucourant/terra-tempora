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
// Outlines with fewer points than this are drawn together, a realm's small
// islands in one piece, to keep the number of pieces on the globe down.
const SMALL_RING = 16;



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
function border(ring: number[], height: number, width: number, id?: object): GeometryInstance {
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


/**
 * One outline, or a realm's small outlines together, drawn in one style and
 * shared by every snapshot that has them: when a realm changes, its unchanged
 * outlines stay as they are and only the new ones are built.
 */
class Piece {
  /** The snapshots drawn with this piece. */
  users = new Set<Polity>();
  /** This frame's opacity, hover and most visible snapshot (for picking). */
  opacity = 0;
  hovered = false;
  owner: Polity | null = null;
  private ownerOpacity = 0;
  fill!: Primitive;
  line!: Primitive;

  constructor(
    readonly key: string,
    readonly fillMaterial: Material,
    readonly lineMaterial: Material,
    readonly fillColor: Color,
    readonly lineColor: Color,
    readonly highlighted: boolean,
  ) {}

  get ready(): boolean {
    return this.fill.ready && this.line.ready;
  }

  reset() {
    this.opacity = this.ownerOpacity = 0;
    this.hovered = false;
    this.owner = null;
  }

  /** Adds a snapshot's opacity; a fading snapshot and the next one add up to 1. */
  addOpacity(p: Polity, opacity: number, hovered: boolean) {
    this.opacity += opacity;
    if (opacity > this.ownerOpacity) {
      this.ownerOpacity = opacity;
      this.owner = p;
    }
    if (hovered && opacity > 0) this.hovered = true;
  }
}

/** A snapshot on the globe: its pieces and its label. */
interface Drawn {
  pieces: Piece[];
  highlighted: boolean;
  label?: Label;
}

const isReady = (d: Drawn) => d.pieces.every((piece) => piece.ready);

export class PolityLayer {
  private polities = new Map<number, Polity>();
  /** Snapshots on the globe, including coarse ones waiting for their replacement. */
  private drawn = new Map<Polity, Drawn>();
  private pieces = new Map<string, Piece>();
  /** Coarse snapshots still drawn until their detailed outline is ready, by id. */
  private retiring = new Map<number, Polity>();
  /** A number for each outline, as the same outline is the same array. */
  private ringIds = new WeakMap<number[], number>();
  private nextRing = 0;
  private labels: LabelCollection;
  /** Colours of the highlighted realms, by Cliopatria name. Others are grey. */
  private highlight = new Map<string, string>();
  /** Name of the greyed realm under the pointer. */
  private hovered: string | null = null;
  /** Today's border of the country being looked at. */
  private outline: Primitive | null = null;
  showContext = true;
  /**
   * Whether every highlighted realm is named; when false (today's map, where
   * every country is coloured), only the large ones are, like greyed realms.
   */
  labelAll = true;
  /** A realm's name as shown on its label. */
  nameOf = (realm: string) => realm;
  /**
   * Years ahead of the current one whose shapes are built in advance; raised
   * while playing so shapes are ready by the time their year comes.
   */
  lookahead = 3;

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
      if (known && this.drawn.has(known)) this.retiring.set(p.id, known);
    }
  }

  /** The realm drawn by a picked piece of the globe, if it is one. */
  polityOf(picked: unknown): Polity | undefined {
    return picked instanceof Piece ? (picked.owner ?? [...picked.users][0]) : undefined;
  }

  /**
   * True when every large realm showing at `year` is built and ready to draw,
   * so playback can move on without big borders popping in late.
   */
  readyAt(year: number): boolean {
    for (const p of this.polities.values()) {
      if (p.area < BIG_AREA || shapeOpacity(p, year) <= 0.002 || !this.visibleKind(p)) continue;
      const d = this.drawn.get(p);
      if (d && isReady(d)) continue;
      const old = this.retiring.get(p.id);
      const oldDrawn = old && this.drawn.get(old);
      if (!oldDrawn || !isReady(oldDrawn)) return false;
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
      if (y < p.from || y > p.to || !this.visibleKind(p)) continue;
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

  private visibleKind(p: Polity): boolean {
    return this.showContext || this.isHighlighted(p);
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
    for (const p of [...this.drawn.keys()]) {
      if (changed.has(p.name) || p.groups?.some((name) => changed.has(name)) || (p.partOf && changed.has(p.partOf))) {
        this.detach(p);
      }
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
    // Build shapes before they are needed so playback stays smooth: those due
    // within a year first, largest first, as a big realm appearing late is
    // seen at once while a small one goes unnoticed; then those further ahead.
    const due: Polity[] = [];
    for (const p of this.polities.values()) {
      const kind = this.visibleKind(p);
      if (kind && shapeOpacity(p, year) > 0.5) visible++;
      if (kind && !this.drawn.has(p) && year >= p.from - this.lookahead && year <= p.to + 1) due.push(p);
    }
    if (due.length) {
      const later = (p: Polity) => (p.from <= year + 1 ? 0 : 1);
      due.sort((a, b) => later(a) - later(b) || (later(a) ? a.from - b.from : 0) || b.area - a.area);
      let builds = 0;
      for (const p of due) {
        const built = this.attach(p, BUILDS_PER_FRAME - builds, builds === 0);
        // Too much to build this frame; snapshots made of pieces already
        // built still go on.
        if (built < 0) {
          pending = true;
          continue;
        }
        builds += built;
      }
    }

    for (const piece of this.pieces.values()) piece.reset();
    for (const [p, d] of [...this.drawn]) {
      const opacity = this.visibleKind(p) ? shapeOpacity(p, year) : 0;
      const current = this.polities.get(p.id);
      if (current !== p) {
        // A coarse snapshot whose detailed outline has arrived: it goes once
        // that is ready, or at once when it is not on screen.
        const next = current && this.drawn.get(current);
        if (opacity <= 0.002 || (next && isReady(next))) {
          this.detach(p);
          continue;
        }
        pending = true;
      } else if (!isReady(d)) {
        pending = true;
        // The detailed outline waits, unseen, while the coarse one still shows.
        if (this.retiring.has(p.id)) continue;
      }
      const hovered = !d.highlighted && p.name === this.hovered;
      for (const piece of d.pieces) piece.addOpacity(p, opacity, hovered);
      // Labels switch at the midpoint of a fade. Changing a label's colour
      // redraws its glyphs, which is too costly to do every frame.
      if (d.label) d.label.show = opacity > 0.5;
    }

    for (const piece of this.pieces.values()) {
      const opacity = Math.min(1, piece.opacity);
      const show = opacity > 0.002;
      piece.fill.show = show;
      piece.line.show = show;
      if (!show) continue;
      const base = piece.highlighted ? FEATURED_FILL_ALPHA : piece.hovered ? HOVER_FILL_ALPHA : CONTEXT_FILL_ALPHA;
      const lineAlpha = piece.hovered ? 0.95 : piece.lineColor.alpha;
      piece.fillMaterial.uniforms.color = Color.fromAlpha(piece.fillColor, base * opacity, piece.fillMaterial.uniforms.color);
      piece.lineMaterial.uniforms.color = Color.fromAlpha(piece.lineColor, lineAlpha * opacity, piece.lineMaterial.uniforms.color);
    }
    if (this.drawn.size > MAX_BUILT) this.release(year);
    return { pending, visible };
  }

  /** Frees the shapes far from `year`; they are rebuilt if the year comes back. */
  private release(year: number) {
    for (const p of [...this.drawn.keys()]) {
      const distance = year < p.from ? p.from - year : year - p.to;
      // Shapes built ahead for playback are kept too.
      if (distance <= KEEP_YEARS || (year < p.from && distance <= this.lookahead + 1)) continue;
      this.detach(p);
    }
  }

  private ringId(ring: number[]): number {
    let id = this.ringIds.get(ring);
    if (id === undefined) this.ringIds.set(ring, (id = this.nextRing++));
    return id;
  }

  /**
   * Puts a snapshot on the globe, reusing the pieces it shares with others.
   * Returns how many new pieces were built, or -1 when that would take more
   * than `budget` (unless `force`), in which case nothing is done.
   */
  private attach(p: Polity, budget: number, force: boolean): number {
    const color = highlightOf(this.highlight, p);
    const highlighted = color !== undefined;
    const style = color ?? "";
    // Each sizeable outline is its own piece; the small ones go together.
    const groups: number[][][] = [];
    const small: number[][] = [];
    for (const ring of p.rings) (ring.length / 2 >= SMALL_RING ? groups.push([ring]) : small.push(ring));
    if (small.length) groups.push(small);
    const keys = groups.map((rings) => `${style}|${rings.map((r) => this.ringId(r)).join(",")}`);
    const missing = keys.filter((key) => !this.pieces.has(key)).length;
    if (missing > budget && !force) return -1;

    const pieces = groups.map((rings, i) => {
      let piece = this.pieces.get(keys[i]);
      if (!piece) this.pieces.set(keys[i], (piece = this.build(keys[i], rings, color, p.coarse)));
      piece.users.add(p);
      return piece;
    });

    let label: Label | undefined;
    if (p.label && ((highlighted && this.labelAll) || p.area >= CONTEXT_LABEL_AREA)) {
      const height = highlighted ? FEATURED_HEIGHT : CONTEXT_HEIGHT;
      label = this.labels.add({
        id: p,
        position: Cartesian3.fromDegrees(p.label[0], p.label[1], height + 2000),
        text: this.nameOf(p.name),
        font: highlighted ? "600 15px 'Instrument Sans Variable', sans-serif" : "500 12px 'Instrument Sans Variable', sans-serif",
        fillColor: highlighted ? Color.fromCssColorString("#fbf6ec") : Color.fromCssColorString("#b4bac1"),
        outlineColor: Color.BLACK.withAlpha(0.85),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        scaleByDistance: new NearFarScalar(2e6, 1.15, 2.5e7, 0.8),
        show: false,
      });
    }
    this.drawn.set(p, { pieces, highlighted, label });
    return missing;
  }

  /** Takes a snapshot off the globe, freeing the pieces no other one uses. */
  private detach(p: Polity) {
    const d = this.drawn.get(p);
    if (!d) return;
    for (const piece of d.pieces) {
      piece.users.delete(p);
      if (piece.users.size) continue;
      this.scene.primitives.remove(piece.fill);
      this.scene.primitives.remove(piece.line);
      this.pieces.delete(piece.key);
    }
    if (d.label) this.labels.remove(d.label);
    this.drawn.delete(p);
    if (this.retiring.get(p.id) === p) this.retiring.delete(p.id);
  }

  private build(key: string, rings: number[][], color: string | undefined, coarse?: boolean): Piece {
    const highlighted = color !== undefined;
    const height = highlighted ? FEATURED_HEIGHT : CONTEXT_HEIGHT;
    const fillColor = Color.fromCssColorString(color ?? MUTED);
    const lineColor = highlighted
      ? Color.fromCssColorString(color).brighten(0.35, new Color()).withAlpha(0.95)
      : Color.fromCssColorString("#e4e7ea").withAlpha(0.45);
    const fillMaterial = Material.fromType("Color", { color: fillColor.withAlpha(0) });
    const lineMaterial = Material.fromType("Color", { color: lineColor.withAlpha(0) });
    const piece = new Piece(key, fillMaterial, lineMaterial, fillColor, lineColor, highlighted);
    // Picking a piece finds the snapshot it is drawn for (see polityOf).
    piece.fill = new Primitive({
      geometryInstances: rings.map(
        (ring) =>
          new GeometryInstance({
            id: piece,
            geometry: new PolygonGeometry({
              polygonHierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(ring)),
              height,
              granularity: CesiumMath.RADIANS_PER_DEGREE * (coarse ? COARSE_GRANULARITY : 1),
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
    piece.line = new Primitive({
      geometryInstances: rings.map((ring) => border(ring, height + 300, highlighted ? 2 : 1, piece)),
      appearance: new PolylineMaterialAppearance({ material: lineMaterial, translucent: true }),
      asynchronous: true,
      show: false,
    });
    this.scene.primitives.add(piece.fill);
    this.scene.primitives.add(piece.line);
    return piece;
  }
}
