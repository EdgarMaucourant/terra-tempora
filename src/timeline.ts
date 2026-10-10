import type { Span } from "./data";
import { ERAS, eraName, eraShort, type Era } from "./eras";
import { t } from "./i18n";
import { formatRange, formatYear, tickLabel } from "./years";

const MIN_SPAN = 10;
const TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
// Minimum room per tick label, in pixels.
const TICK_SPACING = 84;
// Pixels a press may move and still count as a tap.
const TAP_SLOP = 6;
// Lane heights, in pixels, when the timeline is resized taller.
const MIN_LANE_HEIGHT = 13;
const MAX_LANE_HEIGHT = 26;
// Gap between a lane and its before/after icons, in pixels.
const LINK_GAP = 2;
// Event marks: their row is resizable, from two rows of small marks up to
// marks twice as large, then more rows. Sizes in pixels.
const MARK_MIN = 14;
const MARK_MAX = 28;
const MARK_GAP = 2;
const MARKS_MIN_HEIGHT = 2 * MARK_MIN + MARK_GAP;
const MARKS_MAX_HEIGHT = 4 * MARK_MAX + 3 * MARK_GAP;
const MARKS_KEY = "terra-tempora:marks-height";
// Lines joining a lane to a related lane that is on the timeline too.
const CONNECTOR = "#e0533f";

/** A civilization that came before or after a lane's, reached from an icon at the lane's end. */
export interface LaneLink {
  id: string;
  name: string;
  from: number;
  to: number;
}

/** An event shown as a small icon above the ruler. */
export interface TimelineMark {
  id: string;
  year: number;
  /** Icon markup (SVG). */
  icon: string;
  label: string;
  /** Kind and date, shown under the label on hover. */
  detail: string;
}

/** A highlighted realm's lifespan, with the civilizations before and after it. */
export interface Lane extends Span {
  before?: LaneLink[];
  after?: LaneLink[];
}

export interface TimelineOptions {
  track: HTMLElement;
  min: number;
  max: number;
  year: number;
  view: [number, number];
  /** Lifespans of the highlighted realms, drawn as lanes under the eras. */
  featured: Lane[];
  /** What the highlighted realms are called on the pointer shown when they are out of view. */
  featuredLabel: string;
  /** Colour of a highlighted realm's lane. */
  colorOf: (name: string) => string;
  /** Called when the person picks a year; `settled` is false while dragging. */
  onYear: (year: number, settled: boolean) => void;
  /** Called when a highlighted realm's lane is tapped; the year is left to the caller. */
  onLane?: (name: string) => void;
  /** Called when a before/after icon is tapped, with that civilization's id. */
  onLink?: (id: string) => void;
  /** Called when an event mark is tapped, with its id. */
  onMark?: (id: string) => void;
  /** Called when the visible span changes. */
  onView?: (from: number, to: number) => void;
}

type Gesture =
  | { kind: "none" }
  | { kind: "press"; x: number; y: number; scroll: number; viewFrom: number; viewTo: number; target: HTMLElement }
  | { kind: "pan"; x: number; y: number; scroll: number; viewFrom: number; viewTo: number }
  | { kind: "scrub" }
  | { kind: "pinch"; distance: number; anchor: number; span: number; mid: number };

/**
 * A zoomable time axis: era band, lanes for the featured realms, ticks and a
 * playhead. Drag to pan, pinch or scroll to zoom, tap to jump to a year, drag
 * the playhead to scrub.
 */
export class Timeline {
  year: number;
  viewFrom: number;
  viewTo: number;
  private readonly min: number;
  private readonly max: number;
  private readonly track: HTMLElement;
  private readonly erasEl: HTMLElement;
  private readonly lanesEl: HTMLElement;
  private readonly rulerEl: HTMLElement;
  private readonly marksEl: HTMLElement;
  private marks: TimelineMark[] = [];
  private readonly playhead: HTMLElement;
  private featured: Lane[];
  private featuredLabel: string;
  private readonly colorOf: TimelineOptions["colorOf"];
  private readonly onYear: TimelineOptions["onYear"];
  private readonly onView?: TimelineOptions["onView"];
  private readonly onLane?: TimelineOptions["onLane"];
  private readonly onLink?: TimelineOptions["onLink"];
  private readonly onMark?: TimelineOptions["onMark"];
  private width = 1;
  private frame = 0;
  private pointers = new Map<number, number>();
  private gesture: Gesture = { kind: "none" };
  private laneOf = new Map<string, number>();
  private laneCount = 1;
  private laneHeight = MIN_LANE_HEIGHT;
  private marksItems!: HTMLElement;
  private marksHeight = MARKS_MIN_HEIGHT;
  private markSize = MARK_MIN;
  private markRows = 2;

  constructor(options: TimelineOptions) {
    this.track = options.track;
    this.min = options.min;
    this.max = options.max;
    this.year = options.year;
    [this.viewFrom, this.viewTo] = options.view;
    this.featured = options.featured;
    this.featuredLabel = options.featuredLabel;
    this.colorOf = options.colorOf;
    this.onYear = options.onYear;
    this.onView = options.onView;
    this.onLane = options.onLane;
    this.onLink = options.onLink;
    this.onMark = options.onMark;

    this.erasEl = this.part("eras");
    this.lanesEl = this.part("lanes");
    this.marksEl = this.part("marks");
    this.setupMarksResize();
    this.rulerEl = this.part("ruler");
    this.playhead = this.part("playhead");
    this.playhead.innerHTML = '<span class="playhead-knob"></span>';
    this.packLanes();

    this.track.tabIndex = 0;
    this.track.setAttribute("role", "slider");
    this.track.setAttribute("aria-label", t("timeline.year"));
    this.track.setAttribute("aria-valuemin", String(this.min));
    this.track.setAttribute("aria-valuemax", String(this.max));

    new ResizeObserver(() => {
      this.width = Math.max(1, this.track.clientWidth);
      this.fitLanes();
      this.render();
    }).observe(this.track);
    this.track.addEventListener("pointerdown", (e) => this.pointerDown(e));
    this.track.addEventListener("pointermove", (e) => this.pointerMove(e));
    this.track.addEventListener("pointerup", (e) => this.pointerUp(e));
    this.track.addEventListener("pointercancel", (e) => this.pointerUp(e, true));
    this.track.addEventListener("wheel", (e) => this.wheel(e), { passive: false });
    this.track.addEventListener("keydown", (e) => this.key(e));
  }

  /** Moves the playhead, panning the view to keep it in sight. */
  setYear(year: number) {
    this.year = this.clampYear(year);
    const span = this.viewTo - this.viewFrom;
    const margin = span * 0.04;
    if (this.year > this.viewTo - margin) this.setView(this.year - span * 0.2, this.year + span * 0.8);
    else if (this.year < this.viewFrom + margin) this.setView(this.year - span * 0.8, this.year + span * 0.2);
    this.render();
  }

  /** Replaces the highlighted realms' lanes. */
  setFeatured(featured: Lane[], label: string) {
    this.featured = featured;
    this.featuredLabel = label;
    this.laneOf.clear();
    this.packLanes();
    this.render();
  }

  /**
   * Gives the track a fixed height in pixels, or null for its natural height.
   * Extra height goes to the lanes, which grow taller to fill it.
   */
  /** Events to mark above the ruler; an empty list hides the row. */
  setMarks(marks: TimelineMark[]) {
    this.marks = [...marks].sort((a, b) => a.year - b.year);
    this.track.classList.toggle("has-marks", this.marks.length > 0);
    this.render();
  }

  /**
   * A grip on top of the marks row resizes it: marks grow up to twice their
   * size, then fill more rows. Double-click resets it. Remembered in this browser.
   */
  private setupMarksResize() {
    const grip = document.createElement("div");
    grip.className = "marks-grip";
    grip.title = t("timeline.marksGripTitle");
    grip.setAttribute("role", "separator");
    grip.setAttribute("aria-label", t("timeline.marksGripLabel"));
    this.marksItems = document.createElement("div");
    this.marksItems.className = "marks-items";
    this.marksEl.append(grip, this.marksItems);
    let saved = MARKS_MIN_HEIGHT;
    try {
      saved = Number(localStorage.getItem(MARKS_KEY)) || MARKS_MIN_HEIGHT;
    } catch {
      // Storage may be unavailable; the default size stands.
    }
    this.setMarksHeight(saved, false);
    let drag: { y: number; start: number } | null = null;
    grip.addEventListener("pointerdown", (e) => {
      // The track would take this as a pan or a tap.
      e.stopPropagation();
      grip.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, start: this.marksHeight };
      grip.classList.add("dragging");
    });
    grip.addEventListener("pointermove", (e) => {
      if (drag) this.setMarksHeight(drag.start + (drag.y - e.clientY));
    });
    const end = () => {
      drag = null;
      grip.classList.remove("dragging");
    };
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    grip.addEventListener("dblclick", () => this.setMarksHeight(MARKS_MIN_HEIGHT));
  }

  private setMarksHeight(height: number, save = true) {
    this.marksHeight = Math.round(Math.min(MARKS_MAX_HEIGHT, Math.max(MARKS_MIN_HEIGHT, height)));
    this.markSize = Math.min(MARK_MAX, Math.max(MARK_MIN, Math.floor((this.marksHeight - MARK_GAP) / 2)));
    this.markRows = Math.max(2, Math.floor((this.marksHeight + MARK_GAP) / (this.markSize + MARK_GAP)));
    this.marksEl.style.height = `${this.marksHeight}px`;
    this.marksEl.style.setProperty("--mark-size", `${this.markSize}px`);
    if (save) {
      try {
        localStorage.setItem(MARKS_KEY, String(this.marksHeight));
      } catch {
        // Not remembered, then.
      }
    }
    this.fitLanes();
    this.render();
  }

  setHeight(height: number | null) {
    this.track.classList.toggle("sized", height !== null);
    this.track.style.height = height === null ? "" : `${height}px`;
    this.fitLanes();
  }

  // Lanes share the room the track has, within a readable range.
  private fitLanes() {
    let height = MIN_LANE_HEIGHT;
    if (this.track.classList.contains("sized")) {
      const room = this.lanesEl.clientHeight;
      height = Math.floor((room + 3) / this.laneCount - 3);
      height = Math.min(MAX_LANE_HEIGHT, Math.max(MIN_LANE_HEIGHT, height));
    }
    this.laneHeight = height;
    this.track.style.setProperty("--lane-height", `${height}px`);
  }

  setView(from: number, to: number) {
    let span = Math.min(this.max - this.min, Math.max(MIN_SPAN, to - from));
    let start = (from + to) / 2 - span / 2;
    start = Math.min(this.max - span, Math.max(this.min, start));
    span = Math.min(span, this.max - start);
    this.viewFrom = start;
    this.viewTo = start + span;
    this.onView?.(this.viewFrom, this.viewTo);
    this.render();
  }

  /** Zooms by `factor` (below 1 zooms in) keeping `anchor` where it is on screen. */
  zoom(factor: number, anchor = this.year) {
    const span = this.viewTo - this.viewFrom;
    const next = Math.min(this.max - this.min, Math.max(MIN_SPAN, span * factor));
    const t = (anchor - this.viewFrom) / span;
    this.setView(anchor - t * next, anchor - t * next + next);
  }

  private part(name: string): HTMLElement {
    const el = document.createElement("div");
    el.className = name;
    this.track.append(el);
    return el;
  }

  private clampYear(year: number) {
    return Math.min(this.max, Math.max(this.min, year));
  }

  private x(year: number) {
    return ((year - this.viewFrom) / (this.viewTo - this.viewFrom)) * this.width;
  }

  private yearAt(clientX: number) {
    const rect = this.track.getBoundingClientRect();
    return this.viewFrom + ((clientX - rect.left) / this.width) * (this.viewTo - this.viewFrom);
  }

  private pick(year: number, settled: boolean) {
    this.year = this.clampYear(settled ? Math.round(year) : year);
    this.render();
    this.onYear(this.year, settled);
  }

  // Featured realms share as few lanes as possible without overlapping.
  /**
   * Assigns each lane a row, oldest first. A realm that follows one of its
   * predecessors without overlapping it continues that predecessor's row, so
   * a chain like Mongol Empire, Yuan, Ming reads along one line. Otherwise it
   * goes in the free row nearest its relatives, or a new row next to them;
   * unrelated realms take the first free row.
   */
  private packLanes() {
    this.laneOf.clear();
    const byName = new Map(this.featured.map((s) => [s.name, s]));
    const related = new Map<string, { before: Set<string>; after: Set<string> }>();
    const rel = (name: string) => {
      let r = related.get(name);
      if (!r) related.set(name, (r = { before: new Set(), after: new Set() }));
      return r;
    };
    for (const s of this.featured) {
      for (const link of s.after ?? []) {
        if (!byName.has(link.name) || link.name === s.name) continue;
        rel(s.name).after.add(link.name);
        rel(link.name).before.add(s.name);
      }
      for (const link of s.before ?? []) {
        if (!byName.has(link.name) || link.name === s.name) continue;
        rel(s.name).before.add(link.name);
        rel(link.name).after.add(s.name);
      }
    }

    interface Row {
      end: number;
      last: Lane;
    }
    const rows: Row[] = [];
    const rowOf = new Map<string, Row>();
    const free = (row: Row, span: Lane) => row.end < span.from - 4;
    const ordered = [...this.featured].sort((a, b) => a.from - b.from || b.to - b.from - (a.to - a.from));
    for (const span of ordered) {
      const r = related.get(span.name);
      const placed = [...(r?.before ?? []), ...(r?.after ?? [])]
        .map((n) => rowOf.get(n))
        .filter((row): row is Row => !!row);
      let row: Row | undefined;
      // Continue a predecessor's row when it ends just before this realm starts.
      const chain = [...(r?.before ?? [])]
        .map((n) => rowOf.get(n))
        .filter((x): x is Row => !!x && r!.before.has(x.last.name) && x.end <= span.from)
        .sort((a, b) => b.end - a.end)[0];
      if (chain) row = chain;
      else if (placed.length) {
        // The free row closest to its relatives, or a new row just below them.
        const target = placed.map((x) => rows.indexOf(x)).reduce((a, b) => a + b, 0) / placed.length;
        const best = rows
          .map((x, i) => ({ x, d: Math.abs(i - target) }))
          .filter(({ x }) => free(x, span))
          .sort((a, b) => a.d - b.d)[0];
        if (best && best.d <= 1) row = best.x;
        else {
          row = { end: -Infinity, last: span };
          rows.splice(Math.min(rows.length, Math.max(...placed.map((x) => rows.indexOf(x))) + 1), 0, row);
        }
      } else {
        row = rows.find((x) => free(x, span));
        if (!row) rows.push((row = { end: -Infinity, last: span }));
      }
      row.end = Math.max(row.end, span.to);
      row.last = span;
      rowOf.set(span.name, row);
    }
    for (const [name, row] of rowOf) this.laneOf.set(name, rows.indexOf(row));
    this.laneCount = Math.max(1, rows.length);
    this.lanesEl.style.setProperty("--lanes", String(rows.length));
    this.fitLanes();
  }

  render() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private draw() {
    const span = this.viewTo - this.viewFrom;

    // Era band
    this.erasEl.replaceChildren(
      ...ERAS.filter((e) => e.to > this.viewFrom && e.from < this.viewTo).map((e) => this.eraBlock(e)),
    );

    // Featured realm lanes. A lane's before/after realm that has a lane too is
    // joined to it by a line; the others get an icon at the lane's end.
    const bars: Element[] = [];
    const byName = new Map(this.featured.map((s) => [s.name, s]));
    const joins = new Map<string, [Lane, Lane]>();
    for (const s of this.featured) {
      for (const link of s.after ?? []) {
        const t = byName.get(link.name);
        if (t && t !== s) joins.set(`${s.name}\u0000${t.name}`, [s, t]);
      }
      for (const link of s.before ?? []) {
        const t = byName.get(link.name);
        if (t && t !== s) joins.set(`${t.name}\u0000${s.name}`, [t, s]);
      }
    }
    for (const s of this.featured) {
      if (s.to + 1 < this.viewFrom || s.from > this.viewTo) continue;
      const left = this.x(s.from);
      const width = Math.max(3, this.x(s.to + 1) - left);
      const bar = document.createElement("button");
      bar.type = "button";
      bar.className = "lane-bar";
      bar.tabIndex = -1;
      bar.style.left = `${left}px`;
      bar.style.width = `${width}px`;
      bar.style.top = `calc(${this.laneOf.get(s.name) ?? 0} * (var(--lane-height) + 3px))`;
      bar.style.background = this.colorOf(s.name);
      bar.textContent = width > 40 ? s.name : "";
      bar.title = `${s.name}, ${formatRange(s.from, s.to)}`;
      bar.dataset.from = String(s.from);
      bar.dataset.name = s.name;
      bars.push(bar);
      const lane = this.laneOf.get(s.name) ?? 0;
      (s.before ?? [])
        .filter((link) => !byName.has(link.name))
        .forEach((link, i) => bars.push(this.linkIcon(link, "before", lane, left - (i + 1) * LINK_GAP, i)));
      (s.after ?? [])
        .filter((link) => !byName.has(link.name))
        .forEach((link, i) => bars.push(this.linkIcon(link, "after", lane, left + width + (i + 1) * LINK_GAP, i)));
    }
    if (bars.length && joins.size) bars.unshift(this.connectors([...joins.values()]));
    // When the featured realms are out of view, the lanes fold to one row
    // pointing at them, so the reader keeps a sense of where they sit in time.
    if (bars.length === 0 && this.featured.length) bars.push(this.pointer());
    this.lanesEl.classList.toggle("folded", bars.length === 1 && bars[0].classList.contains("lane-pointer"));
    this.lanesEl.replaceChildren(...bars);

    // Event marks at their years; one that would overlap the mark before it
    // drops to the second row, and when both rows are taken it joins the
    // nearest mark as a numbered cluster that zooms in when tapped.
    const groups: { x: number; row: number; items: TimelineMark[] }[] = [];
    const size = this.markSize;
    const last: ((typeof groups)[number] | undefined)[] = Array(this.markRows).fill(undefined);
    for (const m of this.marks) {
      if (m.year < this.viewFrom - 1 || m.year > this.viewTo + 1) continue;
      // Zoomed in, a year is wide enough for several marks side by side.
      const step = size + 1;
      const first = this.x(m.year) + step / 2;
      const room = this.x(m.year + 1) - step / 2 - first;
      const spots = room >= step ? Array.from({ length: Math.floor(room / step) + 1 }, (_, i) => first + i * step) : [this.x(m.year + 0.5)];
      let x = spots[0];
      let row = -1;
      for (const spot of spots) {
        row = last.findIndex((g) => !g || spot - g.x >= step);
        if (row >= 0) {
          x = spot;
          break;
        }
      }
      if (row >= 0) {
        const group = { x, row, items: [m] };
        groups.push(group);
        last[row] = group;
      } else {
        const nearest = last.reduce((a, b) => (b!.x > a!.x ? b : a))!;
        nearest.items.push(m);
      }
    }
    const marks = groups.map((g) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mark";
      button.tabIndex = -1;
      button.style.left = `${g.x}px`;
      button.style.top = `${g.row * (size + MARK_GAP)}px`;
      if (g.items.length === 1) {
        const m = g.items[0];
        button.dataset.id = m.id;
        button.dataset.label = m.label;
        button.dataset.detail = m.detail;
        button.setAttribute("aria-label", `${m.label}, ${m.detail}`);
        button.innerHTML = m.icon;
      } else {
        const years = g.items.map((m) => m.year);
        button.classList.add("cluster");
        button.dataset.from = String(Math.min(...years));
        button.dataset.to = String(Math.max(...years));
        button.dataset.label = t("timeline.events", { count: g.items.length });
        button.dataset.detail = g.items.map((m) => m.label).join(", ");
        button.setAttribute("aria-label", t("timeline.clusterLabel", { count: g.items.length, names: button.dataset.detail }));
        button.textContent = String(g.items.length);
      }
      return button;
    });
    this.marksItems.replaceChildren(...marks);

    // Ticks at a round step that leaves room for their labels
    const step = TICK_STEPS.find((s) => (span / s) * TICK_SPACING <= this.width) ?? 5000;
    const ticks: HTMLElement[] = [];
    for (let y = Math.ceil(this.viewFrom / step) * step; y <= this.viewTo; y += step) {
      const x = this.x(y);
      // Skip labels that would be cut off at either end.
      if (x < 22 || x > this.width - 22) continue;
      const tick = document.createElement("span");
      tick.className = "tick";
      tick.style.left = `${x}px`;
      tick.textContent = tickLabel(y);
      ticks.push(tick);
    }
    this.rulerEl.replaceChildren(...ticks);

    const px = this.x(this.year);
    this.playhead.style.transform = `translateX(${px}px)`;
    this.playhead.hidden = px < -2 || px > this.width + 2;
    this.track.setAttribute("aria-valuenow", String(Math.round(this.year)));
    this.track.setAttribute("aria-valuetext", formatYear(this.year));
  }

  /** Red lines from the end of each lane to the start of the lane that followed it. */
  private connectors(joins: [Lane, Lane][]): SVGSVGElement {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.classList.add("lane-joins");
    const rowHeight = this.laneHeight + 3;
    svg.setAttribute("width", String(this.width));
    svg.setAttribute("height", String(this.laneCount * rowHeight));
    const mid = (s: Lane) => (this.laneOf.get(s.name) ?? 0) * rowHeight + this.laneHeight / 2;
    for (const [a, b] of joins) {
      const end = this.x(a.to + 1);
      const start = this.x(b.from);
      const y1 = mid(a);
      const y2 = mid(b);
      let d: string;
      let from: [number, number];
      if (start - end >= 6) {
        // A gap between them: from the end of one lane forward to the start of the other.
        const reach = (start - end) / 2;
        d = `M${end} ${y1}C${end + reach} ${y1} ${start - reach} ${y2} ${start} ${y2}`;
        from = [end, y1];
      } else {
        // They overlap in time: a straight drop from the earlier lane at the
        // moment the later one begins, so lines never loop back and tangle.
        const x = Math.min(end, Math.max(this.x(a.from), start));
        d = `M${x} ${y1}L${x} ${y2}${x === start ? "" : `L${start} ${y2}`}`;
        from = [x, y1];
      }
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("stroke", CONNECTOR);
      svg.append(path);
      for (const [x, y] of [from, [start, y2]]) {
        const dot = document.createElementNS(NS, "circle");
        dot.setAttribute("cx", String(x));
        dot.setAttribute("cy", String(y));
        dot.setAttribute("r", "2.5");
        dot.setAttribute("fill", CONNECTOR);
        svg.append(dot);
      }
    }
    return svg;
  }

  /** An arrow at a lane's end that opens the civilization before or after it. */
  private linkIcon(link: LaneLink, side: "before" | "after", lane: number, x: number, index: number): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lane-link ${side}`;
    button.tabIndex = -1;
    // Icons are as wide as the lane is tall, so they stack outward from the lane's end.
    const offset = `${index} * var(--lane-height)`;
    button.style.left = side === "before" ? `calc(${x}px - var(--lane-height) - ${offset})` : `calc(${x}px + ${offset})`;
    button.style.top = `calc(${lane} * (var(--lane-height) + 3px))`;
    button.dataset.id = link.id;
    button.dataset.side = side;
    button.dataset.name = link.name;
    button.dataset.range = formatRange(link.from, link.to);
    button.setAttribute(
      "aria-label",
      t(side === "before" ? "timeline.beforeLabel" : "timeline.afterLabel", { name: link.name, years: formatRange(link.from, link.to) }),
    );
    button.innerHTML =
      side === "before"
        ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>'
        : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>';
    return button;
  }

  private pointer(): HTMLElement {
    const from = Math.min(...this.featured.map((s) => s.from));
    const to = Math.max(...this.featured.map((s) => s.to));
    const after = from > this.viewTo;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lane-pointer ${after ? "after" : "before"}`;
    button.tabIndex = -1;
    button.dataset.from = String(from);
    button.textContent = after ? `${this.featuredLabel}, ${formatRange(from, to)} →` : `← ${this.featuredLabel}, ${formatRange(from, to)}`;
    return button;
  }

  private eraBlock(e: Era): HTMLElement {
    const left = Math.max(0, this.x(e.from));
    const right = Math.min(this.width, this.x(e.to));
    const el = document.createElement("div");
    el.className = "era";
    el.dataset.era = String(ERAS.indexOf(e));
    el.style.left = `${left}px`;
    el.style.width = `${right - left}px`;
    const name = eraName(e);
    const short = eraShort(e);
    el.title = `${name}, ${formatRange(e.from, e.to)}`;
    const width = right - left;
    el.textContent = width > name.length * 6.6 + 16 ? name : width > short.length * 6.6 + 12 ? short : "";
    return el;
  }

  // Gestures

  private pointerDown(e: PointerEvent) {
    this.track.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, e.clientX);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const mid = (a + b) / 2;
      this.gesture = {
        kind: "pinch",
        distance: Math.max(20, Math.abs(a - b)),
        anchor: this.yearAt(mid),
        span: this.viewTo - this.viewFrom,
        mid,
      };
      return;
    }
    // Marks and icons sit on the track; pressing one never grabs the playhead.
    const onButton = (e.target as HTMLElement).closest(".mark, .lane-link");
    const nearPlayhead = !onButton && Math.abs(this.yearAt(e.clientX) - this.year) * (this.width / (this.viewTo - this.viewFrom)) < 14;
    this.gesture = nearPlayhead
      ? { kind: "scrub" }
      : {
          kind: "press",
          x: e.clientX,
          y: e.clientY,
          scroll: this.lanesEl.scrollTop,
          viewFrom: this.viewFrom,
          viewTo: this.viewTo,
          target: e.target as HTMLElement,
        };
  }

  private pointerMove(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, e.clientX);
    const g = this.gesture;
    if (g.kind === "pinch" && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const span = g.span * (g.distance / Math.max(20, Math.abs(a - b)));
      const rect = this.track.getBoundingClientRect();
      const t = ((a + b) / 2 - rect.left) / this.width;
      this.setView(g.anchor - t * span, g.anchor - t * span + span);
    } else if (g.kind === "scrub") {
      this.pick(this.yearAt(e.clientX), false);
    } else if (g.kind === "press" || g.kind === "pan") {
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (g.kind === "press" && Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return;
      this.gesture = { ...g, kind: "pan" };
      // Dragging up and down scrolls the lanes when there are more than fit.
      this.lanesEl.scrollTop = g.scroll - dy;
      const shift = (dx / this.width) * (g.viewTo - g.viewFrom);
      this.setView(g.viewFrom - shift, g.viewTo - shift);
    }
  }

  private pointerUp(e: PointerEvent, cancelled = false) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (g.kind === "pinch") {
      // Lifting one finger ends the pinch; the other finger does nothing more.
      this.gesture = { kind: "none" };
      return;
    }
    if (!cancelled && g.kind === "scrub") this.pick(this.year, true);
    if (!cancelled && g.kind === "press") {
      // Pointer capture retargets pointerup to the track, so use where the press began.
      const target = g.target;
      const bar = target.closest<HTMLElement>(".lane-bar");
      const link = target.closest<HTMLElement>(".lane-link");
      const mark = target.closest<HTMLElement>(".mark");
      if (mark?.classList.contains("cluster")) {
        const from = Number(mark.dataset.from);
        const to = Number(mark.dataset.to);
        const pad = Math.max(4, (to - from) * 0.6);
        this.setView(from - pad, to + pad + 1);
        return this.endPointer();
      }
      if (mark && this.onMark) {
        this.onMark(mark.dataset.id!);
        return this.endPointer();
      }
      if (link && this.onLink) {
        this.onLink(link.dataset.id!);
        return this.endPointer();
      }
      if (target.closest(".lane-pointer")) {
        const from = Math.min(...this.featured.map((s) => s.from));
        this.setView(from - 60, from + 340);
        this.pick(from, true);
        return this.endPointer();
      }
      if (bar && this.onLane) this.onLane(bar.dataset.name!);
      else this.pick(bar ? Number(bar.dataset.from) : this.yearAt(e.clientX), true);
    }
    this.endPointer();
  }

  private endPointer() {
    if (this.pointers.size === 0) this.gesture = { kind: "none" };
  }

  private wheel(e: WheelEvent) {
    // Over lanes that scroll, a plain vertical wheel scrolls them.
    const lanes = this.lanesEl;
    if (
      !e.ctrlKey &&
      !e.shiftKey &&
      Math.abs(e.deltaY) > Math.abs(e.deltaX) &&
      lanes.scrollHeight > lanes.clientHeight + 1 &&
      lanes.contains(e.target as Node)
    ) {
      return;
    }
    e.preventDefault();
    const span = this.viewTo - this.viewFrom;
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
    if (horizontal && !e.ctrlKey) {
      const delta = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      const shift = (delta / this.width) * span;
      this.setView(this.viewFrom + shift, this.viewTo + shift);
    } else {
      this.zoom(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), this.yearAt(e.clientX));
    }
  }

  private key(e: KeyboardEvent) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowUp: 1,
      PageDown: -100,
      PageUp: 100,
    };
    if (e.key in steps) {
      e.preventDefault();
      const step = steps[e.key] * (e.shiftKey ? 10 : 1);
      this.pick(Math.round(this.year) + step, true);
      this.setYear(this.year);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      this.pick(e.key === "Home" ? this.min : this.max, true);
      this.setYear(this.year);
    } else if (e.key === "+" || e.key === "=") {
      this.zoom(0.7);
    } else if (e.key === "-") {
      this.zoom(1 / 0.7);
    }
  }
}
