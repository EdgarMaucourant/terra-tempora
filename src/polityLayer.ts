import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  GeometryInstance,
  Material,
  MaterialAppearance,
  Math as CesiumMath,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  Scene,
  SceneTransforms,
} from "cesium";
import { BLANK_COLOR, BLANK_FILL_ALPHA, JOINT_DARK, JOINT_LIGHT, MUTED, ROUGH_COLOR, ROUGH_LABEL_AREA } from "./colors";
import { foldedInGroup, highlightOf, isOverlay, withClosedGroups, type Polity } from "./data";
import { FlatLabel, FlatLabels } from "./flatLabels";
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
// Hatching: land held by another state than its owner, drawn just above the
// owner's land. Higher, the hatching seen at a slant slides off the land and
// leaves a strip of it bare (Saint-Martin in 1815).
const HATCH_LIFT = 400;
// A group's outline (French West Africa), above everything it groups.
const GROUP_HEIGHT = FEATURED_HEIGHT + 3000;
const GROUP_COLOR = "#f2d48a";
const HATCH_ALPHA = 0.85;
// The hatch lines' spacing, in km: the pattern repeats across the shape's extent.
const HATCH_SPACING_KM = 12;
// Land not reviewed yet: a faint flat grey, under the realms.
const UNREVIEWED_COLOR = "#3a3f46";
const UNREVIEWED_ALPHA = 0.72;
// Land ruled jointly by two states (a condominium) is hatched in both
// colours, one line in each: color2 is the second state's (else color).
const HATCH_SOURCE = `
uniform vec4 color;
uniform vec4 color2;
uniform float repeat;
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  float x = (materialInput.st.s + materialInput.st.t) * repeat;
  float v = fract(x);
  vec4 c = fract(x * 0.5) < 0.5 ? color : color2;
  material.diffuse = c.rgb;
  material.alpha = c.a * step(0.55, v);
  return material;
}`;

/** A diagonal hatch, lines about HATCH_SPACING_KM apart across a shape of `extentKm`. */
function hatchMaterial(color: Color, extentKm: number, color2 = color): Material {
  return new Material({
    fabric: {
      uniforms: { color, color2, repeat: Math.min(400, Math.max(3, extentKm / HATCH_SPACING_KM)) },
      source: HATCH_SOURCE,
    },
    translucent: true,
  });
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

/** The larger side of the rings' box, in km. */
function extentKm(rings: number[][]): number {
  let [x0, y0, x1, y1] = [180, 90, -180, -90];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 2) {
      x0 = Math.min(x0, ring[i]);
      x1 = Math.max(x1, ring[i]);
      y0 = Math.min(y0, ring[i + 1]);
      y1 = Math.max(y1, ring[i + 1]);
    }
  }
  const cos = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  return Math.max((x1 - x0) * cos, y1 - y0) * 111;
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
  kind: Polity["kind"];
  fill!: Primitive;
  line!: Primitive;

  constructor(
    readonly key: string,
    readonly fillMaterial: Material,
    readonly lineMaterial: Material,
    readonly fillColor: Color,
    readonly lineColor: Color,
    readonly highlighted: boolean,
    /** A jointly ruled land's hatch: the second state's colour. */
    readonly fillColor2?: Color,
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
  label?: FlatLabel;
  /** An active war zone's warning sign (see Polity.rough). */
  sign?: FlatLabel;
  signWanted?: boolean;
  /** Whether the label is due on the globe; it still gives way to a name it would cover. */
  wanted?: boolean;
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
  private labels: FlatLabels;
  /** Warning signs, kept above every other primitive (see attach). */
  private signs: FlatLabels;
  /** Colours of the highlighted realms, by Cliopatria name. Others are grey. */
  private highlight = new Map<string, string>();
  /** The colours asked for, before closed groups take one colour. */
  private chosen = new Map<string, string>();
  private ownerFirst = false;
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
  private openGroups = new Set<string>();
  /** A realm's name as shown on its label. */
  nameOf = (realm: string) => realm;
  /**
   * Years ahead of the current one whose shapes are built in advance; raised
   * while playing so shapes are ready by the time their year comes.
   */
  lookahead = 3;

  constructor(private scene: Scene) {
    // Drawn flat over the globe, so no border or hatching covers them; the
    // warning signs over the names.
    this.labels = new FlatLabels(scene);
    this.signs = new FlatLabels(scene);
    scene.preRender.addEventListener(() => this.declutter());
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
    // A group's members, now known, take its colour.
    if (this.chosen.size) this.applyHighlight();
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
      if (isOverlay(p) || year < p.from || year > p.to || (best && p.area >= best.area)) continue;
      if (p.rings.some((ring) => inRing(ring, lon, lat))) best = p;
    }
    return best?.name ?? null;
  }

  /** The realm or territory whose own land is at a point at `year`, under any hatching. */
  landAt(lon: number, lat: number, year: number): Polity | undefined {
    const y = Math.round(year);
    let best: Polity | undefined;
    for (const p of this.polities.values()) {
      if (isOverlay(p) || y < p.from || y > p.to || (best && p.area >= best.area)) continue;
      if (p.rings.some((ring) => inRing(ring, lon, lat))) best = p;
    }
    return best;
  }

  /** The war zone whose warning sign is at this point on the screen, if any. */
  signAt(x: number, y: number): Polity | undefined {
    const at = new Cartesian2();
    const camera = this.scene.camera.positionWC;
    for (const [p, d] of this.drawn) {
      if (!d.sign?.show) continue;
      const position = d.sign.position;
      if (Cartesian3.dot(position, camera) <= Cartesian3.magnitudeSquared(position) * 0.98) continue;
      const point = SceneTransforms.worldToWindowCoordinates(this.scene, position, at);
      if (point && Math.hypot(point.x - x, point.y - y) <= 16) return p;
    }
    return undefined;
  }

  /** The land under a hatching at `year`: at its label, or found by name. */
  landUnder(h: Polity, year: number): Polity | undefined {
    const at = h.label ? this.landAt(h.label[0], h.label[1], year) : undefined;
    const name = h.land ?? h.name;
    if (at?.name === name) return at;
    const y = Math.round(year);
    for (const p of this.polities.values()) {
      if (!isOverlay(p) && !p.kind && p.name === name && y >= p.from && y <= p.to && (!h.land || p.partOf === h.name)) return p;
    }
    return at;
  }

  /**
   * The hatching over a point at `year`, if any: picking passes through the
   * gaps between its lines, so a pick on its owner is checked against it.
   */
  hatchAt(lon: number, lat: number, year: number): Polity | undefined {
    const y = Math.round(year);
    for (const p of this.polities.values()) {
      if (p.kind === "hatch" && y >= p.from && y <= p.to && p.rings.some((ring) => inRing(ring, lon, lat))) return p;
    }
    return undefined;
  }

  /** The outline of a group of territories (French West Africa) drawn that year. */
  groupAt(name: string, year: number): Polity | undefined {
    const y = Math.round(year);
    for (const p of this.polities.values()) if (p.kind === "group" && p.name === name && y >= p.from && y <= p.to) return p;
    return undefined;
  }

  /** The realms drawn at `year`, coloured or greyed, one shape per realm name. */
  at(year: number): Polity[] {
    const y = Math.round(year);
    const byName = new Map<string, Polity>();
    for (const p of this.polities.values()) {
      if (isOverlay(p) || y < p.from || y > p.to || !this.visibleKind(p)) continue;
      const seen = byName.get(p.name);
      // The detailed shape over the coarse one, and the one with a label.
      if (!seen || (seen.coarse && !p.coarse) || (!seen.label && p.label)) byName.set(p.name, p);
    }
    return [...byName.values()];
  }

  /** A realm's colour on the globe, or undefined when it is greyed. */
  colorOf(p: Polity): string | undefined {
    return highlightOf(this.highlight, p, this.ownerFirst);
  }

  isHighlighted(p: Polity): boolean {
    return highlightOf(this.highlight, p, this.ownerFirst) !== undefined;
  }

  private visibleKind(p: Polity): boolean {
    if (p.kind === "unreviewed") return this.showContext;
    // Land no state held is always shown, so that visitors see it and can tell us about it.
    if (p.kind === "blank") return true;
    return this.showContext || this.isHighlighted(p);
  }

  /** Whether the land under a hatching is drawn highlighted, and so higher. */
  private landHighlighted(h: Polity): boolean {
    // A hatching is named after the land's owner (France under German occupation).
    if (highlightOf(this.highlight, h, this.ownerFirst) !== undefined) return true;
    const rings = new Set(h.rings);
    for (const q of this.polities.values()) {
      if (!q.kind && q.from <= h.to && q.to >= h.from && q.rings.some((r) => rings.has(r)) && highlightOf(this.highlight, q, this.ownerFirst) !== undefined) return true;
    }
    return false;
  }

  /**
   * The colour of a hatch: the holder's when it is highlighted, else a light
   * grey; for land ruled jointly, both rulers' as "first/second".
   */
  private hatchColor(p: Polity): string {
    if (!p.with) return (p.by && this.highlight.get(p.by)) ?? "#e4e7ea";
    // Two rulers not highlighted are still told apart: light and dark lines.
    return `${this.highlight.get(p.by!) ?? JOINT_LIGHT}/${this.highlight.get(p.with) ?? JOINT_DARK}`;
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
  private labelsDirty = true;
  private lastView = "";
  private lastDeclutter = 0;

  /**
   * Shows the names that are due without letting one cover another: those of
   * highlighted realms first, then groups, then by size. Run before each
   * frame, it only works when the names or the view have changed.
   */
  private declutter() {
    const camera = this.scene.camera;
    const view = `${camera.positionWC.x.toFixed(0)},${camera.positionWC.y.toFixed(0)},${camera.positionWC.z.toFixed(0)},${camera.heading.toFixed(3)},${this.scene.canvas.clientWidth}`;
    if (!this.labelsDirty && view === this.lastView) return;
    // While the globe turns, ten times a second is enough.
    const now = performance.now();
    if (!this.labelsDirty && now - this.lastDeclutter < 100) {
      this.scene.requestRender();
      return;
    }
    this.labelsDirty = false;
    this.lastView = view;
    this.lastDeclutter = now;
    // A warning sign past the horizon would show through the globe.
    for (const [, d] of this.drawn) {
      if (!d.sign || !d.signWanted) continue;
      const position = d.sign.position;
      d.sign.show = Cartesian3.dot(position, camera.positionWC) > Cartesian3.magnitudeSquared(position) * 0.98;
    }
    const rank = (p: Polity, d: Drawn) => (d.highlighted && this.labelAll ? 2 : p.kind === "group" ? 1 : 0);
    const due = [...this.drawn].filter(([, d]) => d.label && d.wanted).sort((a, b) => rank(b[0], b[1]) - rank(a[0], a[1]) || b[0].area - a[0].area);
    const placed: [number, number, number, number][] = [];
    const at = new Cartesian2();
    const range = Cartesian3.magnitude(camera.positionWC);
    for (const [p, d] of due) {
      const label = d.label!;
      const position = label.position;
      // Past the horizon, the globe hides the name anyway.
      const facing = Cartesian3.dot(position, camera.positionWC) > Cartesian3.magnitudeSquared(position) * 0.98;
      const point = facing ? SceneTransforms.worldToWindowCoordinates(this.scene, position, at) : undefined;
      if (!point) {
        label.show = false;
        continue;
      }
      const size = (rank(p, d) === 2 ? 15 : 12) * (range < 1.2e7 ? 1.15 : 1);
      const w = (label.text.length * size * 0.56) / 2 + 3;
      const h = size * 0.8;
      // A group's name moves above or below the names already there.
      const shifts = p.kind === "group" ? [0, -22, 22, -44, 44] : [0];
      const dy = shifts.find((dy) => {
        const box = [point.x - w, point.y + dy - h, point.x + w, point.y + dy + h];
        return !placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
      });
      label.show = dy !== undefined;
      if (dy === undefined) continue;
      placed.push([point.x - w, point.y + dy - h, point.x + w, point.y + dy + h]);
      label.pixelOffset.y = dy;
    }
  }

  /** The groups whose territories are named, after a click inside them. */
  setOpenGroups(groups: Iterable<string>) {
    this.openGroups = new Set(groups);
    this.applyHighlight();
    this.labelsDirty = true;
    this.scene.requestRender();
  }

  /** ownerFirst: territories take their owner's colour (the home globe). */
  setHighlight(colors: Map<string, string>, ownerFirst = false) {
    // Switching how territories are coloured rebuilds every shape.
    const flipped = ownerFirst !== this.ownerFirst;
    this.ownerFirst = ownerFirst;
    this.chosen = new Map(colors);
    this.applyHighlight(flipped);
  }

  /** The chosen colours, with each closed group in one colour. */
  private applyHighlight(all = false) {
    const colors = withClosedGroups(this.chosen, this.polities.values(), this.openGroups, this.ownerFirst);
    const changed = new Set<string>();
    for (const [name, color] of colors) if (this.highlight.get(name) !== color) changed.add(name);
    for (const name of this.highlight.keys()) if (!colors.has(name)) changed.add(name);
    this.highlight = new Map(colors);
    // Shapes whose colour or height changes are rebuilt on the next update.
    for (const p of [...this.drawn.keys()]) {
      if (
        all ||
        changed.has(p.name) ||
        p.groups?.some((name) => changed.has(name)) ||
        (p.partOf && changed.has(p.partOf)) ||
        (p.by && changed.has(p.by)) ||
        // A hatching follows its land up or down (see landHighlighted).
        (p.kind === "hatch" && changed.size > 0)
      ) {
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

    // A group (French West Africa) is named alone until a click inside it:
    // its territories' names then take the place of its own.
    const groupNames = new Set<string>();
    for (const [p, d] of this.drawn) {
      if (p.kind === "group" && d.label && this.visibleKind(p) && shapeOpacity(p, year) > 0.5) groupNames.add(p.name);
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
      const hovered = !d.highlighted && !!this.hovered && (p.name === this.hovered || !!p.groups?.includes(this.hovered));
      for (const piece of d.pieces) piece.addOpacity(p, opacity, hovered);
      // Labels switch at the midpoint of a fade. Changing a label's colour
      // redraws its glyphs, which is too costly to do every frame.
      if (d.sign) {
        const wanted = opacity > 0.5;
        if (wanted !== d.signWanted) this.labelsDirty = true;
        d.signWanted = wanted;
        if (!wanted) d.sign.show = false;
      }
      if (d.label) {
        const wanted =
          opacity > 0.5 &&
          (p.kind === "group" ? !this.openGroups.has(p.name) : !foldedInGroup(p, groupNames, this.openGroups));
        if (wanted !== d.wanted) this.labelsDirty = true;
        d.wanted = wanted;
        if (!wanted) d.label.show = false;
      }
    }

    for (const piece of this.pieces.values()) {
      const opacity = Math.min(1, piece.opacity);
      const show = opacity > 0.002;
      piece.fill.show = show && piece.kind !== "group";
      piece.line.show = show;
      if (!show) continue;
      const base =
        piece.kind === "hatch"
          ? HATCH_ALPHA
          : piece.kind === "unreviewed"
            ? UNREVIEWED_ALPHA
            : piece.kind === "blank"
              ? BLANK_FILL_ALPHA
            : piece.highlighted
              ? FEATURED_FILL_ALPHA
              : piece.hovered
                ? HOVER_FILL_ALPHA
                : CONTEXT_FILL_ALPHA;
      const lineAlpha = piece.hovered ? 0.95 : piece.lineColor.alpha;
      piece.fillMaterial.uniforms.color = Color.fromAlpha(piece.fillColor, base * opacity, piece.fillMaterial.uniforms.color);
      if (piece.kind === "hatch") {
        piece.fillMaterial.uniforms.color2 = Color.fromAlpha(piece.fillColor2 ?? piece.fillColor, base * opacity, piece.fillMaterial.uniforms.color2);
      }
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
    const color =
      p.kind === "hatch"
        ? this.hatchColor(p)
        : p.kind === "unreviewed"
          ? UNREVIEWED_COLOR
          : p.kind === "blank"
            ? BLANK_COLOR
            : p.kind === "group"
              ? GROUP_COLOR
              : highlightOf(this.highlight, p, this.ownerFirst);
    const highlighted = !p.kind && color !== undefined;
    // A hatching sits just above its land, which is higher when highlighted.
    const lifted = p.kind === "hatch" && this.landHighlighted(p);
    const style = `${p.kind ?? ""}:${color ?? ""}${lifted ? ":lifted" : ""}`;
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
      if (!piece) this.pieces.set(keys[i], (piece = this.build(keys[i], rings, color, p.coarse, p.kind, lifted)));
      piece.users.add(p);
      return piece;
    });

    let label: FlatLabel | undefined;
    // A group's territories all have a name, shown once a click opens the group.
    if (!p.kind && p.label && ((highlighted && this.labelAll) || p.area >= CONTEXT_LABEL_AREA || (p.partOf && p.groups?.length))) {
      const height = highlighted ? FEATURED_HEIGHT : CONTEXT_HEIGHT;
      label = this.labels.add({
        id: p,
        position: Cartesian3.fromDegrees(p.label[0], p.label[1], height + 2000),
        text: this.nameOf(p.display ?? p.name),
        font: highlighted ? "600 15px 'Instrument Sans Variable', sans-serif" : "500 12px 'Instrument Sans Variable', sans-serif",
        fill: highlighted ? "#fbf6ec" : "#b4bac1",
        outline: "rgba(0, 0, 0, 0.85)",
        outlineWidth: 3,
        near: [2e6, 1.15],
        far: [2.5e7, 0.8],
      });
    }
    // An active war zone carries a warning sign that its lines are rough,
    // small from afar.
    let sign: FlatLabel | undefined;
    if (p.kind === "hatch" && p.rough && p.label && p.area >= ROUGH_LABEL_AREA) {
      sign = this.signs.add({
        id: p,
        position: Cartesian3.fromDegrees(p.label[0], p.label[1], FEATURED_HEIGHT + 4000),
        text: "⚠",
        font: "700 20px 'Instrument Sans Variable', sans-serif",
        fill: ROUGH_COLOR,
        outline: "rgba(0, 0, 0, 0.9)",
        outlineWidth: 4,
        near: [1.5e6, 1.3],
        far: [2e7, 0.6],
      });
    }
    // A group's name sits above its members' names, in capitals.
    if (p.kind === "group" && p.label) {
      label = this.labels.add({
        id: p,
        position: Cartesian3.fromDegrees(p.label[0], p.label[1], GROUP_HEIGHT + 2000),
        text: this.nameOf(p.name).toUpperCase(),
        font: "italic 600 12px 'Instrument Sans Variable', sans-serif",
        fill: GROUP_COLOR,
        outline: "rgba(0, 0, 0, 0.85)",
        outlineWidth: 3,
        near: [2e6, 1.15],
        far: [2.5e7, 0.8],
      });
    }
    this.drawn.set(p, { pieces, highlighted, label, sign });
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
    if (d.sign) this.signs.remove(d.sign);
    this.drawn.delete(p);
    if (this.retiring.get(p.id) === p) this.retiring.delete(p.id);
  }

  private build(key: string, rings: number[][], color: string | undefined, coarse?: boolean, kind?: Polity["kind"], lifted = false): Piece {
    const highlighted = !kind && color !== undefined;
    const height =
      kind === "group"
        ? GROUP_HEIGHT
        : kind === "hatch"
          ? (lifted ? FEATURED_HEIGHT : CONTEXT_HEIGHT) + HATCH_LIFT
          : highlighted
            ? FEATURED_HEIGHT
            : CONTEXT_HEIGHT - (kind ? 500 : 0);
    const [first, second] = (color ?? MUTED).split("/");
    const fillColor = Color.fromCssColorString(first);
    const fillColor2 = second ? Color.fromCssColorString(second) : undefined;
    const lineColor = kind
      ? fillColor.withAlpha(kind === "hatch" ? 0.7 : kind === "group" ? 0.9 : kind === "blank" ? 0.8 : 0)
      : highlighted
        ? Color.fromCssColorString(color!).brighten(0.35, new Color()).withAlpha(0.95)
        : Color.fromCssColorString("#e4e7ea").withAlpha(0.45);
    const fillMaterial =
      kind === "hatch" ? hatchMaterial(fillColor.withAlpha(0), extentKm(rings), (fillColor2 ?? fillColor).withAlpha(0)) : Material.fromType("Color", { color: fillColor.withAlpha(0) });
    // Land no state held has a dashed outline of today's borders.
    const lineMaterial =
      kind === "blank"
        ? Material.fromType("PolylineDash", { color: lineColor.withAlpha(0), dashLength: 16 })
        : Material.fromType("Color", { color: lineColor.withAlpha(0) });
    const piece = new Piece(key, fillMaterial, lineMaterial, fillColor, lineColor, highlighted, fillColor2);
    piece.kind = kind;
    const vertexFormat = (kind === "hatch" ? MaterialAppearance.MaterialSupport.TEXTURED : MaterialAppearance.MaterialSupport.BASIC).vertexFormat;
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
              vertexFormat,
            }),
          }),
      ),
      appearance: new MaterialAppearance({
        material: fillMaterial,
        materialSupport: kind === "hatch" ? MaterialAppearance.MaterialSupport.TEXTURED : MaterialAppearance.MaterialSupport.BASIC,
        translucent: true,
        flat: true,
        faceForward: true,
      }),
      asynchronous: true,
      // A group's outline lets clicks through to its members, and land no
      // state held lets them through to the note asking for a source.
      allowPicking: kind !== "group" && kind !== "blank",
      show: false,
    });
    piece.line = new Primitive({
      geometryInstances: rings.map((ring) => border(ring, height + 300, kind === "group" ? 3 : highlighted || kind === "blank" ? 2 : 1, piece)),
      appearance: new PolylineMaterialAppearance({ material: lineMaterial, translucent: true }),
      asynchronous: true,
      allowPicking: kind !== "blank",
      show: false,
    });
    this.scene.primitives.add(piece.fill);
    this.scene.primitives.add(piece.line);
    return piece;
  }
}
