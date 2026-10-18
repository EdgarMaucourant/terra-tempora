import { geoArea, geoContains, geoEqualEarth, geoEquirectangular, geoGraticule10, geoMercator, geoNaturalEarth1, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import { geoCylindricalEqualArea, geoEckert4, geoMiller, geoMollweide, geoRobinson, geoWinkel3 } from "d3-geo-projection";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import landUrl from "world-atlas/land-50m.json?url";
import { MUTED } from "./colors";
import type { Polity } from "./data";
import { shapeOpacity } from "./polityLayer";
import { badgeUrl, eventOpacity, type EventKind, type HistoryEvent } from "./events";

// Event badges, in CSS pixels.
const BADGE = 26;

export interface ProjectionChoice {
  id: string;
  name: string;
  make: () => GeoProjection;
  /** Projections that run to infinity at the poles are fitted to this latitude band. */
  band?: [number, number];
}

export const PROJECTIONS: ProjectionChoice[] = [
  { id: "equal-earth", name: "Equal Earth", make: geoEqualEarth },
  { id: "mercator", name: "Mercator", make: geoMercator, band: [-62, 80] },
  { id: "gall-peters", name: "Gall–Peters", make: () => geoCylindricalEqualArea().parallel(45) },
  { id: "eckert4", name: "Eckert IV", make: geoEckert4 },
  { id: "robinson", name: "Robinson", make: geoRobinson },
  { id: "winkel3", name: "Winkel tripel", make: geoWinkel3 },
  { id: "mollweide", name: "Mollweide", make: geoMollweide },
  { id: "natural-earth", name: "Natural Earth", make: geoNaturalEarth1 },
  { id: "miller", name: "Miller", make: geoMiller, band: [-70, 82] },
  { id: "equirectangular", name: "Equirectangular", make: geoEquirectangular },
];

const FEATURED_FILL_ALPHA = 0.55;
const CONTEXT_FILL_ALPHA = 0.4;
const HOVER_FILL_ALPHA = 0.62;
const CONTEXT_LABEL_AREA = 900_000;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 14;

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
  onClick: (p: Polity | null) => void;
  /** The pointer is over an event badge (or none). */
  onEventHover: (e: HistoryEvent | null, x: number, y: number) => void;
  onEventClick: (e: HistoryEvent) => void;
  /** Pixels at the bottom of the canvas covered by the timeline. */
  bottomInset: () => number;
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
  private hovered: string | null = null;
  /** Today's border of the country being looked at, drawn dashed over everything. */
  private outline: Shape | null = null;
  private events: HistoryEvent[] = [];
  private badgeImages = new Map<EventKind, HTMLImageElement>();
  /** Badges drawn last frame, for hit-testing. */
  private drawnBadges: { e: HistoryEvent; x: number; y: number }[] = [];
  showContext = false;
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

  get projectionId() {
    return this.choice.id;
  }

  /** Longitude and latitude at the middle of the view, and the zoom. */
  centre(): { lon: number; lat: number; zoom: number } {
    const at = this.projection.invert?.([this.width / 2, this.viewCentreY()]);
    const lat = at && Number.isFinite(at[1]) ? at[1] : 0;
    return { lon: ((this.lambda + 540) % 360) - 180, lat, zoom: this.zoom };
  }

  add(polities: Polity[]) {
    for (const p of polities) if (!this.polities.has(p.id)) this.polities.set(p.id, p);
  }

  /** Draws these rings as a dashed border on top of the realms, or none. */
  setOutline(rings: number[][] | null) {
    this.outline = rings?.length ? toFeature({ rings } as Polity) : null;
    this.draw();
  }

  /** The events that may show: those of the highlighted civilizations. */
  setEvents(events: HistoryEvent[]) {
    this.events = events;
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

  setHighlight(colors: Map<string, string>) {
    this.highlight = new Map(colors);
    this.draw();
  }

  setHovered(name: string | null) {
    this.hovered = name;
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
      .then((r) => r.json() as Promise<Topology>)
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

  /** Centres the map on a point, zoomed to frame a realm of `area` km² (null keeps the zoom). */
  focus(lon: number, lat: number, area: number | null) {
    if (!this.width) return;
    const zoom = area === null ? this.zoom : zoomFor(area);
    const from = { lambda: this.lambda, zoom: this.zoom, ty: this.ty };
    // Where the point lands with the target rotation and zoom decides the target pan.
    this.apply(lon, zoom, 0);
    const [, y] = this.projection([lon, lat]) ?? [0, this.height / 2];
    const to = { lambda: lon, zoom, ty: this.viewCentreY() - y };
    // Turn the short way round.
    let dl = ((to.lambda - from.lambda + 540) % 360) - 180;
    if (!Number.isFinite(dl)) dl = 0;
    cancelAnimationFrame(this.tween);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      this.lambda = from.lambda + dl * e;
      this.zoom = from.zoom * (to.zoom / from.zoom) ** e;
      this.ty = from.ty + (to.ty - from.ty) * e;
      this.drawNow();
      if (t < 1) this.tween = requestAnimationFrame(step);
    };
    this.apply(from.lambda, from.zoom, from.ty);
    this.tween = requestAnimationFrame(step);
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

    // Realms: greyed ones first, highlighted on top.
    const context: { p: Polity; opacity: number }[] = [];
    const featured: { p: Polity; opacity: number }[] = [];
    for (const p of this.polities.values()) {
      const highlighted = this.highlight.has(p.name);
      if (!highlighted && !this.showContext) continue;
      const opacity = shapeOpacity(p, this.year);
      if (opacity <= 0.002) continue;
      (highlighted ? featured : context).push({ p, opacity });
    }
    this.drawn = [];
    for (const { p, opacity } of [...context, ...featured]) {
      let shape = this.shapes.get(p.id);
      if (!shape) {
        shape = toFeature(p);
        this.shapes.set(p.id, shape);
      }
      const color = this.highlight.get(p.name);
      const hovered = !color && p.name === this.hovered;
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
    const minArea = CONTEXT_LABEL_AREA / Math.min(this.zoom, 8) ** 1.6;
    const candidates = this.drawn
      .filter(({ p }) => p.label && (this.highlight.has(p.name) || p.area >= minArea))
      .sort((a, b) => Number(this.highlight.has(b.p.name)) - Number(this.highlight.has(a.p.name)) || b.p.area - a.p.area);
    const placed: [number, number, number, number][] = [];
    const named = new Set<string>();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const { p } of candidates) {
      if (named.has(p.name)) continue;
      const at = this.projection(p.label!);
      if (!at || at[0] < 0 || at[0] > this.width || at[1] < 0 || at[1] > this.height) continue;
      const highlighted = this.highlight.has(p.name);
      ctx.font = highlighted ? "600 14px 'Instrument Sans', sans-serif" : "500 11px 'Instrument Sans', sans-serif";
      const text = this.nameOf(p.name).replace(/^\((.*)\)$/, "$1");
      const w = ctx.measureText(text).width / 2 + 3;
      const h = highlighted ? 10 : 8;
      const box: [number, number, number, number] = [at[0] - w, at[1] - h, at[0] + w, at[1] + h];
      if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      named.add(p.name);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
      ctx.lineWidth = 3;
      ctx.strokeText(text, at[0], at[1]);
      ctx.fillStyle = highlighted ? "#fbf6ec" : "#b4bac1";
      ctx.fillText(text, at[0], at[1]);
    }

    // Event badges, on top of everything but the title shade.
    this.drawnBadges = [];
    for (const e of this.events) {
      const opacity = eventOpacity(e, this.year);
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
        else this.handlers.onClick(this.polityAt(at.x, at.y));
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

/** Zoom that frames a realm of this many km². */
export function zoomFor(area: number): number {
  return Math.min(MAX_ZOOM, Math.max(1, 14_000 / Math.sqrt(Math.max(area, 1))));
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.35);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
