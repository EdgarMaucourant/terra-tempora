import { geoArea, geoContains, geoEqualEarth, geoEquirectangular, geoGraticule10, geoMercator, geoNaturalEarth1, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import { geoCylindricalEqualArea, geoEckert4, geoMiller, geoMollweide, geoRobinson, geoWinkel3 } from "d3-geo-projection";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { feature } from "topojson-client";
import landUrl from "world-atlas/land-50m.json?url";
import { BLANK_COLOR, BLANK_FILL_ALPHA, JOINT_DARK, JOINT_LIGHT, MUTED, LABEL_OUTLINE, ROUGH_COLOR, ROUGH_LABEL_AREA } from "./colors";
import { foldedInGroup, highlightOf, withClosedGroups, type Polity } from "./data";
import { shapeOpacity } from "./polityLayer";
import { badgeUrl, eventOpacity, supersededYears, type EventKind, type HistoryEvent } from "./events";
import { PIN_HEIGHT, PIN_URL, PIN_WIDTH } from "./pin";

// Event badges, in CSS pixels.
const BADGE = 26;

interface ProjectionChoice {
  id: string;
  make: () => GeoProjection;
  /** Projections that run to infinity at the poles are fitted to this latitude band. */
  band?: [number, number];
}

export const PROJECTIONS: ProjectionChoice[] = [
  { id: "equal-earth", make: geoEqualEarth },
  { id: "mercator", make: geoMercator, band: [-62, 80] },
  { id: "gall-peters", make: () => geoCylindricalEqualArea().parallel(45) },
  { id: "eckert4", make: geoEckert4 },
  { id: "robinson", make: geoRobinson },
  { id: "winkel3", make: geoWinkel3 },
  { id: "mollweide", make: geoMollweide },
  { id: "natural-earth", make: geoNaturalEarth1 },
  { id: "miller", make: geoMiller, band: [-70, 82] },
  { id: "equirectangular", make: geoEquirectangular },
];

const FEATURED_FILL_ALPHA = 0.55;
const CONTEXT_FILL_ALPHA = 0.4;
const HOVER_FILL_ALPHA = 0.62;
/** The least area (km²) of a realm named at the starting zoom (see PolityLayer). */
const CONTEXT_LABEL_AREA = 150_000;
/** The outline and name of a group of territories (French West Africa). */
const GROUP_COLOR = "#f2d48a";
const MIN_ZOOM = 0.8;
// Close enough to see Macau or Gibraltar on the flat map, as on the globe.
const MAX_ZOOM = 160;
// The closest a realm is framed when it opens, so a tiny one keeps some context.
const MAX_FRAME_ZOOM = 40;
// The globe camera's field of view across the wider side of the screen (Cesium's default).
const FOV = Math.PI / 3;

type Shape = Feature<Polygon | MultiPolygon, null>;

/** A Cliopatria shape as GeoJSON, each ring wound the way d3 expects. */
function toFeature(p: Polity): Shape {
  const polygons = p.rings.map((flat) => {
    const ring: [number, number][] = [];
    for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]]);
    ring.push(ring[0]);
    // d3 treats a ring wound the other way as "everything but this shape".
    if (geoArea({ type: "Polygon", coordinates: [ring] }) > 2 * Math.PI) ring.reverse();
    return [ring];
  });
  const geometry: Polygon | MultiPolygon =
    polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons };
  return { type: "Feature", properties: null, geometry };
}

interface MapEvents {
  /** The pointer is over a realm (or none) at these canvas coordinates. */
  onHover: (p: Polity | null, x: number, y: number) => void;
  /** A click or tap on a realm (or none) at these canvas coordinates. */
  onClick: (p: Polity | null, x: number, y: number) => void;
  /** The pointer is over an event badge (or none). */
  onEventHover: (e: HistoryEvent | null, x: number, y: number) => void;
  onEventClick: (e: HistoryEvent) => void;
  /** Pixels at the bottom of the canvas covered by the timeline. */
  bottomInset: () => number;
  /** Drawn at this scale, in CSS pixels per degree at the equator. */
  onScale: (pixelsPerDegree: number) => void;
}

/**
 * A flat map of the same borders as the globe, drawn on a canvas in a choice
 * of projections. Drag sideways to turn the world, up and down to pan; scroll
 * or pinch to zoom.
 */
export class MapView {
  private ctx: CanvasRenderingContext2D;
  private polities = new Map<number, Polity>();
  private shapes = new Map<number, Shape>();
  private land: GeoPermissibleObjects | null = null;
  private landLoading: Promise<void> | null = null;
  private highlight = new Map<string, string>();
  /** The colours asked for, before closed groups take one colour. */
  private chosen = new Map<string, string>();
  private ownerFirst = false;
  private hovered: string | null = null;
  /** Today's border of the country being looked at, drawn dashed over everything. */
  private outline: Shape | null = null;
  private events: HistoryEvent[] = [];
  private eventsUntil = new Map<HistoryEvent, number>();
  /** The reported spot, from a report's link. */
  private pin: [number, number] | null = null;
  private pinImage: HTMLImageElement | null = null;
  private badgeImages = new Map<EventKind, HTMLImageElement>();
  /** Badges drawn last frame, for hit-testing. */
  private drawnBadges: { e: HistoryEvent; x: number; y: number }[] = [];
  private drawnSigns: { p: Polity; x: number; y: number }[] = [];
  showContext = true;
  /** Whether every highlighted realm is named (see PolityLayer.labelAll). */
  labelAll = true;
  private openGroups = new Set<string>();
  /** A realm's name as shown on its label. */
  nameOf = (realm: string) => realm;

  private choice = PROJECTIONS[0];
  private projection: GeoProjection = PROJECTIONS[0].make();
  /** Longitude at the centre of the map. */
  private lambda = 0;
  private zoom = 1;
  /** Vertical position of the projection's origin, in CSS pixels. */
  private ty = 0;
  private baseScale = 1;
  private baseTy = 0;
  private width = 0;
  private height = 0;
  private year = 0;
  /** What was drawn last, in drawing order, for hit testing. */
  private drawn: { p: Polity; shape: Shape }[] = [];
  private frame = 0;
  private tween = 0;
  active = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private handlers: MapEvents,
  ) {
    this.ctx = canvas.getContext("2d")!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.attachPointer();
  }

  /** Longitude and latitude at the middle of the view, and the zoom. */
  centre(): { lon: number; lat: number; zoom: number } {
    const at = this.projection.invert?.([this.width / 2, this.viewCentreY()]);
    const lat = at && Number.isFinite(at[1]) ? at[1] : 0;
    return { lon: ((this.lambda + 540) % 360) - 180, lat, zoom: this.zoom };
  }

  /** Adds downloaded shapes; a detailed outline replaces a coarse one. */
  add(polities: Polity[]) {
    for (const p of polities) {
      const known = this.polities.get(p.id);
      if (known && !(known.coarse && !p.coarse)) continue;
      this.polities.set(p.id, p);
      this.shapes.delete(p.id);
    }
    // A group's members, now known, take its colour.
    if (this.chosen.size) this.highlight = withClosedGroups(this.chosen, this.polities.values(), this.openGroups, this.ownerFirst);
  }

  private shapeOf(p: Polity): Shape {
    let shape = this.shapes.get(p.id);
    if (!shape) {
      shape = toFeature(p);
      this.shapes.set(p.id, shape);
    }
    return shape;
  }

  /** Draws these rings as a dashed border on top of the realms, or none. */
  setOutline(rings: number[][] | null) {
    this.outline = rings?.length ? toFeature({ rings } as Polity) : null;
    this.draw();
  }

  /** Marks a spot with a pin, or removes it. */
  setPin(lonLat: [number, number] | null) {
    this.pin = lonLat;
    if (lonLat && !this.pinImage) {
      this.pinImage = new Image();
      this.pinImage.onload = () => this.draw();
      this.pinImage.src = PIN_URL;
    }
    this.draw();
  }

  /** The events that may show: those of the highlighted civilizations. */
  setEvents(events: HistoryEvent[]) {
    this.events = events;
    this.eventsUntil = supersededYears(events);
    this.draw();
  }

  /** The event badge under these canvas coordinates, drawn on top. */
  eventAt(x: number, y: number): HistoryEvent | null {
    for (let i = this.drawnBadges.length - 1; i >= 0; i--) {
      const b = this.drawnBadges[i];
      if (Math.hypot(b.x - x, b.y - y) <= BADGE / 2 + 3) return b.e;
    }
    return null;
  }

  private badge(kind: EventKind): HTMLImageElement | null {
    let img = this.badgeImages.get(kind);
    if (!img) {
      img = new Image();
      img.addEventListener("load", () => this.draw());
      img.src = badgeUrl(kind);
      this.badgeImages.set(kind, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  /** ownerFirst: territories take their owner's colour (the home globe). */
  /** The war zone whose warning sign is at this point of the canvas, if any. */
  signAt(x: number, y: number): Polity | undefined {
    return this.drawnSigns.find((s) => Math.hypot(s.x - x, s.y - y) <= 14)?.p;
  }

  setHighlight(colors: Map<string, string>, ownerFirst = false) {
    this.ownerFirst = ownerFirst;
    this.chosen = new Map(colors);
    this.highlight = withClosedGroups(this.chosen, this.polities.values(), this.openGroups, this.ownerFirst);
    this.draw();
  }

  setHovered(name: string | null) {
    this.hovered = name;
  }

  /** The groups whose territories are named, after a click inside them. */
  setOpenGroups(groups: Iterable<string>) {
    this.openGroups = new Set(groups);
    this.highlight = withClosedGroups(this.chosen, this.polities.values(), this.openGroups, this.ownerFirst);
    this.draw();
  }

  setYear(year: number) {
    this.year = year;
    this.draw();
  }

  /** Shows the map; the land outline is downloaded the first time. */
  show() {
    this.active = true;
    this.canvas.hidden = false;
    this.landLoading ??= fetch(landUrl)
      .then((r) => r.json() as Promise<Parameters<typeof feature>[0]>)
      .then((topology) => {
        this.land = feature(topology, topology.objects.land) as GeoPermissibleObjects;
        this.draw();
      })
      .catch((error: unknown) => console.error("The land outline could not load.", error));
    this.resize();
  }

  hide() {
    this.active = false;
    this.canvas.hidden = true;
  }

  /** Switches projection, keeping the same longitude in the middle. */
  setProjection(id: string) {
    this.choice = PROJECTIONS.find((p) => p.id === id) ?? PROJECTIONS[0];
    this.projection = this.choice.make();
    this.zoom = 1;
    this.fit();
    this.draw();
  }

  /**
   * Flies to a point, showing as much land around it as the globe's camera
   * would from `altitude` metres up (null keeps the zoom). Like the globe, a
   * long trip pulls back a little on the way and comes in at the end.
   */
  focus(lon: number, lat: number, altitude: number | null, duration = 1400) {
    if (!this.width) return;
    cancelAnimationFrame(this.tween);
    const here = this.centre();
    const zoom = altitude === null ? this.zoom : this.zoomFor(lat, altitude);
    // Positions in pixels of the map at zoom 1, along the middle meridian.
    const unit = this.pixelsPerDegree();
    const y = (at: number) => {
      this.apply(this.lambda, 1, 0);
      return this.projection([this.lambda, at])?.[1] ?? 0;
    };
    // Turn the short way round.
    let dl = ((lon - this.lambda + 540) % 360) - 180;
    if (!Number.isFinite(dl)) dl = 0;
    const from: View = [this.lambda * unit, y(here.lat), this.width / this.zoom];
    const to: View = [(this.lambda + dl) * unit, y(lat), this.width / zoom];
    this.apply(this.lambda, this.zoom, this.ty);
    const path = flightPath(from, to);
    const show = ([x, cy, w]: View) => {
      this.lambda = x / unit;
      this.zoom = this.width / w;
      this.ty = this.viewCentreY() - cy * this.zoom;
      this.drawNow();
    };
    if (duration <= 0) return show(to);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      show(path(t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2));
      if (t < 1) this.tween = requestAnimationFrame(step);
    };
    this.tween = requestAnimationFrame(step);
  }

  /** The globe camera's altitude, in metres, that shows as much land as the map shows now. */
  altitude(): number {
    const { lat } = this.centre();
    return (Math.max(this.width, this.height) / (this.zoom * this.pixelsPerKm(lat))) / (2 * Math.tan(FOV / 2)) * 1000;
  }

  /** Map zoom that shows as much land around this latitude as the globe from `altitude` metres. */
  private zoomFor(lat: number, altitude: number): number {
    const across = 2 * Math.tan(FOV / 2) * (altitude / 1000);
    const zoom = Math.max(this.width, this.height) / (across * this.pixelsPerKm(lat));
    return Math.min(MAX_FRAME_ZOOM, Math.max(1, zoom));
  }

  /** Pixels per degree of longitude along the equator, at zoom 1. */
  private pixelsPerDegree(): number {
    this.apply(this.lambda, 1, 0);
    const a = this.projection([this.lambda - 0.5, 0]);
    const b = this.projection([this.lambda + 0.5, 0]);
    this.apply(this.lambda, this.zoom, this.ty);
    return a && b ? Math.abs(b[0] - a[0]) : (this.baseScale * Math.PI) / 180;
  }

  /** Pixels per kilometre east-west at this latitude, at zoom 1: Miller stretches the north. */
  private pixelsPerKm(lat: number): number {
    const at = Math.max(-80, Math.min(80, lat));
    this.apply(this.lambda, 1, 0);
    const a = this.projection([this.lambda - 0.5, at]);
    const b = this.projection([this.lambda + 0.5, at]);
    this.apply(this.lambda, this.zoom, this.ty);
    const px = a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : (this.baseScale * Math.PI) / 180;
    return px / (111.32 * Math.cos((at * Math.PI) / 180));
  }

  /** [longitude, latitude] under these canvas coordinates, or null off the map. */
  lonLatAt(x: number, y: number): [number, number] | null {
    const point = this.projection.invert?.([x, y]);
    return point && Number.isFinite(point[0]) && Number.isFinite(point[1]) ? [point[0], point[1]] : null;
  }

  /** The realm under these canvas coordinates, drawn on top. */
  polityAt(x: number, y: number): Polity | null {
    const point = this.projection.invert?.([x, y]);
    if (!point || !Number.isFinite(point[0])) return null;
    for (let i = this.drawn.length - 1; i >= 0; i--) {
      if (geoContains(this.drawn[i].shape, point)) return this.drawn[i].p;
    }
    return null;
  }

  draw() {
    if (!this.active || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.drawNow();
    });
  }

  private viewCentreY() {
    return (this.height - this.handlers.bottomInset()) / 2;
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = window.devicePixelRatio || 1;
    const centreLat = this.width ? this.projection.invert?.([this.width / 2, this.viewCentreY()])?.[1] : undefined;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.fit();
    if (centreLat !== undefined && this.zoom > 1) {
      this.apply(this.lambda, this.zoom, 0);
      const y = this.projection([this.lambda, centreLat])?.[1];
      if (y !== undefined) this.ty = this.viewCentreY() - y;
    }
    this.drawNow();
  }

  /** Measures the projection at zoom 1 so the whole world fits above the timeline. */
  private fit() {
    if (!this.width) return;
    const pad = 16;
    const bottom = this.height - this.handlers.bottomInset() - pad;
    const target: GeoPermissibleObjects = this.choice.band
      ? {
          type: "MultiPoint",
          coordinates: [
            [-179.9, this.choice.band[0]],
            [179.9, this.choice.band[1]],
          ],
        }
      : { type: "Sphere" };
    this.projection.rotate([0, 0]).fitExtent(
      [
        [pad, pad + 56],
        [this.width - pad, Math.max(pad + 120, bottom)],
      ],
      target,
    );
    this.baseScale = this.projection.scale();
    const [, ty] = this.projection.translate();
    this.baseTy = ty;
    if (this.zoom <= 1) this.ty = ty;
    this.apply(this.lambda, this.zoom, this.ty);
  }

  private apply(lambda: number, zoom: number, ty: number) {
    this.projection
      .rotate([-lambda, 0])
      .scale(this.baseScale * zoom)
      .translate([this.width / 2, ty]);
  }

  /** Keeps some of the map at the middle of the screen. */
  private clampPan() {
    if (this.zoom <= 1) {
      this.ty = this.baseTy;
      return;
    }
    this.apply(this.lambda, this.zoom, this.ty);
    const target: GeoPermissibleObjects = this.choice.band
      ? { type: "LineString", coordinates: [[this.lambda, this.choice.band[0]], [this.lambda, this.choice.band[1]]] }
      : { type: "Sphere" };
    const [[, top], [, bottom]] = geoPath(this.projection).bounds(target);
    const mid = this.viewCentreY();
    if (top > mid) this.ty -= top - mid;
    if (bottom < mid) this.ty += mid - bottom;
  }

  private drawNow() {
    if (!this.active || !this.width) return;
    this.clampPan();
    this.apply(this.lambda, this.zoom, this.ty);
    this.handlers.onScale((this.projection.scale() * Math.PI) / 180);
    const ctx = this.ctx;
    const path = geoPath(this.projection, ctx);
    ctx.clearRect(0, 0, this.width, this.height);

    // Sea, graticule and land.
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = "#0f2131";
    ctx.fill();
    ctx.beginPath();
    path(geoGraticule10());
    ctx.strokeStyle = "rgba(160, 190, 215, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (this.land) {
      ctx.beginPath();
      path(this.land);
      ctx.fillStyle = "#2e3b33";
      ctx.fill();
      ctx.strokeStyle = "rgba(170, 190, 175, 0.28)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Land not reviewed yet, then the realms (greyed ones first, highlighted
    // on top), then the hatching of land held by another state than its owner.
    const unreviewed: { p: Polity; opacity: number }[] = [];
    const context: { p: Polity; opacity: number }[] = [];
    const featured: { p: Polity; opacity: number }[] = [];
    const hatched: { p: Polity; opacity: number }[] = [];
    const grouped: { p: Polity; opacity: number }[] = [];
    const blank: { p: Polity; opacity: number }[] = [];
    for (const p of this.polities.values()) {
      // Land no state held is always shown, so that visitors see it and can
      // tell us about it.
      if (p.kind === "blank") {
        const opacity = shapeOpacity(p, this.year);
        if (opacity > 0.002) blank.push({ p, opacity });
        continue;
      }
      if (p.kind === "group") {
        const opacity = shapeOpacity(p, this.year);
        if (opacity > 0.002 && (this.showContext || highlightOf(this.highlight, p, this.ownerFirst) !== undefined)) grouped.push({ p, opacity });
        continue;
      }
      if (p.kind) {
        const opacity = shapeOpacity(p, this.year);
        if (opacity > 0.002 && (this.showContext || p.kind === "hatch")) (p.kind === "hatch" ? hatched : unreviewed).push({ p, opacity });
        continue;
      }
      const highlighted = highlightOf(this.highlight, p, this.ownerFirst) !== undefined;
      if (!highlighted && !this.showContext) continue;
      const opacity = shapeOpacity(p, this.year);
      if (opacity <= 0.002) continue;
      (highlighted ? featured : context).push({ p, opacity });
    }
    this.drawn = [];
    for (const { p, opacity } of unreviewed) {
      const shape = this.shapeOf(p);
      ctx.beginPath();
      path(shape);
      ctx.globalAlpha = 0.22 * opacity;
      ctx.fillStyle = "#8a9099";
      ctx.fill();
      ctx.globalAlpha = 1;
      if (opacity > 0.5) this.drawn.push({ p, shape });
    }
    // Land no state held: a light grey with a dashed outline of today's
    // borders. It is not pickable: a pointer there finds no realm.
    for (const { p, opacity } of blank) {
      const shape = this.shapeOf(p);
      ctx.beginPath();
      path(shape);
      ctx.globalAlpha = BLANK_FILL_ALPHA * opacity;
      ctx.fillStyle = BLANK_COLOR;
      ctx.fill();
      ctx.globalAlpha = 0.8 * opacity;
      ctx.strokeStyle = BLANK_COLOR;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    for (const { p, opacity } of [...context, ...featured]) {
      const shape = this.shapeOf(p);
      const color = highlightOf(this.highlight, p, this.ownerFirst);
      const hovered = !color && !!this.hovered && (p.name === this.hovered || !!p.groups?.includes(this.hovered));
      ctx.beginPath();
      path(shape);
      ctx.globalAlpha = (color ? FEATURED_FILL_ALPHA : hovered ? HOVER_FILL_ALPHA : CONTEXT_FILL_ALPHA) * opacity;
      ctx.fillStyle = color ?? MUTED;
      ctx.fill();
      ctx.globalAlpha = (color || hovered ? 0.95 : 0.45) * opacity;
      ctx.strokeStyle = color ? lighten(color) : "#e4e7ea";
      ctx.lineWidth = color ? 1.6 : 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (opacity > 0.5) this.drawn.push({ p, shape });
    }
    for (const { p, opacity } of hatched) {
      const shape = this.shapeOf(p);
      // Land ruled jointly (a condominium) takes every other line in the second
      // state's colour; rulers not highlighted are light and dark lines.
      const color = (p.by && this.highlight.get(p.by)) ?? (p.with ? JOINT_LIGHT : "#e4e7ea");
      const color2 = p.with ? (this.highlight.get(p.with) ?? JOINT_DARK) : color;
      ctx.save();
      ctx.beginPath();
      path(shape);
      ctx.clip();
      ctx.globalAlpha = 0.85 * opacity;
      ctx.lineWidth = 1.5;
      // Diagonal lines 6 px apart across the screen, kept to the shape by the clip.
      for (const [offset, stroke] of [[0, color], [6, color2]] as const) {
        ctx.strokeStyle = stroke;
        ctx.beginPath();
        for (let x = -this.height + offset; x < this.width; x += 12) {
          ctx.moveTo(x, this.height);
          ctx.lineTo(x + this.height, 0);
        }
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      path(shape);
      ctx.globalAlpha = 0.7 * opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (opacity > 0.5) this.drawn.push({ p, shape });
    }

    // Groups of territories (French West Africa): an outline over their
    // members, which clicks pass through.
    for (const { p, opacity } of grouped) {
      ctx.beginPath();
      path(this.shapeOf(p));
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.strokeStyle = GROUP_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Today's border of the country being looked at.
    if (this.outline) {
      ctx.beginPath();
      path(this.outline);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The world's edge.
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.strokeStyle = "rgba(214, 220, 228, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Names: highlighted realms first, then greyed ones by size, skipping
    // any that would overlap a name already placed.
    // A group (French West Africa) is named alone until a click inside it:
    // its territories' names then take the place of its own.
    const groupNames = new Set(grouped.filter((g) => g.opacity > 0.5 && g.p.label).map((g) => g.p.name));
    const folded = (p: Polity) => foldedInGroup(p, groupNames, this.openGroups);
    const minArea = CONTEXT_LABEL_AREA / Math.min(this.zoom, 8) ** 1.6;
    const candidates = this.drawn
      .filter(({ p }) => !p.kind && p.label && !folded(p) && (highlightOf(this.highlight, p, this.ownerFirst) || p.area >= minArea || p.groups?.some((g) => groupNames.has(g))))
      .sort((a, b) => Number(!!highlightOf(this.highlight, b.p, this.ownerFirst)) - Number(!!highlightOf(this.highlight, a.p, this.ownerFirst)) || b.p.area - a.p.area);
    const placed: [number, number, number, number][] = [];
    const named = new Set<string>();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    // An active war zone's warning sign: its text shows on hover.
    ctx.font = "700 18px 'Instrument Sans Variable', sans-serif";
    this.drawnSigns = [];
    for (const { p, opacity } of hatched) {
      if (opacity <= 0.5 || !p.rough || !p.label || p.area < ROUGH_LABEL_AREA) continue;
      const at = this.projection(p.label);
      if (!at || at[0] < 0 || at[0] > this.width || at[1] < 0 || at[1] > this.height) continue;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      ctx.lineWidth = 4;
      ctx.strokeText("⚠", at[0], at[1]);
      ctx.fillStyle = ROUGH_COLOR;
      ctx.fillText("⚠", at[0], at[1]);
      placed.push([at[0] - 11, at[1] - 11, at[0] + 11, at[1] + 11]);
      this.drawnSigns.push({ p, x: at[0], y: at[1] });
    }
    for (const { p } of candidates) {
      if (named.has(p.name)) continue;
      const at = this.projection(p.label!);
      if (!at || at[0] < 0 || at[0] > this.width || at[1] < 0 || at[1] > this.height) continue;
      const highlighted = highlightOf(this.highlight, p, this.ownerFirst) !== undefined;
      ctx.font = highlighted ? "600 14px 'Instrument Sans Variable', sans-serif" : "500 11px 'Instrument Sans Variable', sans-serif";
      const text = this.nameOf(p.display ?? p.name);
      const w = ctx.measureText(text).width / 2 + 3;
      const h = highlighted ? 10 : 8;
      const box: [number, number, number, number] = [at[0] - w, at[1] - h, at[0] + w, at[1] + h];
      if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      named.add(p.name);
      ctx.strokeStyle = LABEL_OUTLINE;
      ctx.lineWidth = 3;
      ctx.strokeText(text, at[0], at[1]);
      ctx.fillStyle = highlighted ? "#fbf6ec" : "#b4bac1";
      ctx.fillText(text, at[0], at[1]);
    }

    // Group names, in capitals, just above or below their members' names.
    ctx.font = "italic 600 12px 'Instrument Sans Variable', sans-serif";
    for (const { p, opacity } of grouped) {
      if (!p.label || opacity <= 0.5 || this.openGroups.has(p.name)) continue;
      const at = this.projection(p.label);
      if (!at || at[0] < 0 || at[0] > this.width || at[1] < 0 || at[1] > this.height) continue;
      const text = this.nameOf(p.name).toUpperCase();
      const w = ctx.measureText(text).width / 2 + 3;
      for (const dy of [0, -22, 22, -44, 44]) {
        const y = at[1] + dy;
        const box: [number, number, number, number] = [at[0] - w, y - 9, at[0] + w, y + 9];
        if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
        placed.push(box);
        ctx.strokeStyle = LABEL_OUTLINE;
        ctx.lineWidth = 3;
        ctx.strokeText(text, at[0], y);
        ctx.fillStyle = GROUP_COLOR;
        ctx.fillText(text, at[0], y);
        break;
      }
    }

    // Event badges, on top of everything but the title shade.
    this.drawnBadges = [];
    for (const e of this.events) {
      const opacity = eventOpacity(e, this.year, this.eventsUntil.get(e));
      if (opacity <= 0) continue;
      const at = this.projection(e.lonLat);
      const img = this.badge(e.kind);
      if (!at || !img) continue;
      const size = opacity === 1 ? BADGE : BADGE * 0.8;
      ctx.globalAlpha = opacity;
      ctx.drawImage(img, at[0] - size / 2, at[1] - size / 2, size, size);
      ctx.globalAlpha = 1;
      this.drawnBadges.push({ e, x: at[0], y: at[1] });
    }

    // The reported spot, its tip on the place.
    const pinAt = this.pin && this.projection(this.pin);
    if (pinAt && this.pinImage?.complete) {
      ctx.drawImage(this.pinImage, pinAt[0] - PIN_WIDTH / 2, pinAt[1] - PIN_HEIGHT, PIN_WIDTH, PIN_HEIGHT);
    }

    // A shade behind the title so it stays readable over the map.
    const shade = ctx.createLinearGradient(0, 0, 0, 200);
    shade.addColorStop(0, "rgba(7, 10, 14, 0.78)");
    shade.addColorStop(1, "rgba(7, 10, 14, 0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, this.width, 200);
  }

  private attachPointer() {
    const canvas = this.canvas;
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinch = 0;
    const local = (e: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      moved = 0;
      cancelAnimationFrame(this.tween);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      const at = local(e);
      const last = pointers.get(e.pointerId);
      if (!last) {
        const event = this.eventAt(at.x, at.y);
        this.handlers.onEventHover(event, at.x, at.y);
        if (!event) this.handlers.onHover(this.polityAt(at.x, at.y), at.x, at.y);
        return;
      }
      pointers.set(e.pointerId, at);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, distance / pinch);
        pinch = distance;
        moved += 10;
        return;
      }
      const dx = at.x - last.x;
      const dy = at.y - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      // Sideways turns the world, so it can be spun all the way round.
      this.lambda -= (dx / this.projection.scale()) * (180 / Math.PI);
      this.ty += dy;
      this.drawNow();
    });
    const end = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      pinch = 0;
      if (pointers.size === 0 && moved < 5) {
        const at = local(e);
        const event = this.eventAt(at.x, at.y);
        if (event) this.handlers.onEventClick(event);
        else this.handlers.onClick(this.polityAt(at.x, at.y), at.x, at.y);
      }
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", (e) => {
      pointers.delete(e.pointerId);
      pinch = 0;
    });
    canvas.addEventListener("pointerleave", () => {
      if (!pointers.size) this.handlers.onHover(null, 0, 0);
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        cancelAnimationFrame(this.tween);
        const at = local(e);
        this.zoomAt(at.x, at.y, Math.exp(-e.deltaY * 0.0015));
      },
      { passive: false },
    );
  }

  /** Zooms by `factor`, keeping the place under (x, y) where it is. */
  private zoomAt(x: number, y: number, factor: number) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    if (next === this.zoom) return;
    const before = this.projection.invert?.([x, y]);
    const applied = next / this.zoom;
    this.zoom = next;
    this.ty = y - (y - this.ty) * applied;
    this.apply(this.lambda, this.zoom, this.ty);
    const after = this.projection.invert?.([x, y]);
    if (before && after && Number.isFinite(before[0]) && Number.isFinite(after[0])) {
      this.lambda += before[0] - after[0];
    }
    this.drawNow();
  }
}

/** A view of the map: middle point in pixels at zoom 1, and the width it shows. */
type View = [number, number, number];

/**
 * The smooth pan and zoom between two views (van Wijk and Nuij), which zooms
 * out on a long trip and back in at the end, as the globe's camera flies.
 * Takes 0..1 along the way.
 */
function flightPath([x0, y0, w0]: View, [x1, y1, w1]: View): (t: number) => View {
  const rho = Math.SQRT2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-6) {
    const s = Math.log(w1 / w0);
    return (t) => [x0, y0, w0 * Math.exp(s * t)];
  }
  const d = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + rho ** 4 * d2) / (2 * w0 * rho * rho * d);
  const b1 = (w1 * w1 - w0 * w0 - rho ** 4 * d2) / (2 * w1 * rho * rho * d);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  return (t) => {
    const s = t * S;
    const c0 = Math.cosh(r0);
    const u = (w0 / (rho * rho * d)) * (c0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
    return [x0 + u * dx, y0 + u * dy, (w0 * c0) / Math.cosh(rho * s + r0)];
  };
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.35);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
