import {
  buildModuleUrl,
  Cartesian3,
  CesiumWidget,
  defined,
  EllipsoidTerrainProvider,
  ImageryLayer,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  TileMapServiceImageryProvider,
} from "cesium";
import "cesium/Build/Cesium/Widgets/CesiumWidget/CesiumWidget.css";
import "./style.css";
import { civEraText, Civilizations, type Civilization } from "./civilizations";
import { highlightColors } from "./colors";
import { BorderData, type Polity, type Span } from "./data";
import { eraAt, ERAS, NOW } from "./eras";
import { Landing } from "./landing";
import { PolityLayer } from "./polityLayer";
import { Timeline } from "./timeline";
import { attachTimelineGrip } from "./timelineGrip";
import { realmFacts } from "./wikidata";
import { era, formatRange, formatYear, yearNumber } from "./years";

const FIRST_YEAR = ERAS[0].from;
// Old links (#y1241) open on the Mongol Empire, the first prototype's subject.
const DEFAULT_CIV = "mongol-empire";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const yearNumberEl = $("year-number");
const yearEraEl = $("year-era");
const yearPeriodEl = $("year-period");
const playButton = $<HTMLButtonElement>("play");
const playIcon = document.getElementById("play-icon")!;
const speedSelect = $<HTMLSelectElement>("speed");
const contextToggle = $<HTMLInputElement>("context-toggle");
const statusEl = $("status");
const hintEl = $("hint");
const info = $("info");
const sources = $("sources");
const tooltip = $("tooltip");
const landingEl = $("landing");

// The neutral globe: Natural Earth II relief imagery shipped with CesiumJS,
// served from our own files. No Cesium ion account or token is involved.
const widget = new CesiumWidget($("globe"), {
  baseLayer: ImageryLayer.fromProviderAsync(
    TileMapServiceImageryProvider.fromUrl(buildModuleUrl("Assets/Textures/NaturalEarthII")),
  ),
  terrainProvider: new EllipsoidTerrainProvider(),
  creditContainer: $("credits"),
  requestRenderMode: true,
  maximumRenderTimeChange: Infinity,
});
const scene = widget.scene;
scene.globe.showGroundAtmosphere = true;
const camera = scene.screenSpaceCameraController;
// The bundled imagery is low resolution, so stop zooming at regional scale.
camera.minimumZoomDistance = 700_000;
camera.maximumZoomDistance = 45_000_000;

const narrow = window.matchMedia("(max-width: 640px)").matches;
widget.camera.setView({
  destination: Cartesian3.fromDegrees(78, narrow ? 28 : 32, narrow ? 22_000_000 : 14_500_000),
});

const layer = new PolityLayer(scene);
let data: BorderData | undefined;
let civs: Civilizations | undefined;
let timeline: Timeline | undefined;
let landing: Landing | undefined;
let year = 1206;
let playing = false;
// The civilization shown on the globe and the realms related to it, highlighted first.
let active: Civilization | undefined;
let highlighted: Civilization[] = [];
let colors = new Map<string, string>();

// Links: #c=mongol-empire&y=1241 opens a civilization on a year, an empty hash
// the landing page. #y1241 (and #y-500 for 500 BCE) still work.
interface Route {
  civ?: string;
  year?: number;
}

function readHash(): Route {
  const legacy = /^#y(-?\d{1,5})$/.exec(location.hash);
  if (legacy) return { civ: DEFAULT_CIV, year: Number(legacy[1]) };
  const params = new URLSearchParams(location.hash.slice(1));
  const y = params.get("y");
  return { civ: params.get("c") ?? undefined, year: y && /^-?\d{1,5}$/.test(y) ? Number(y) : undefined };
}

function hashFor(route: Route): string {
  if (!route.civ) return location.pathname + location.search;
  return `#c=${route.civ}${route.year !== undefined ? `&y=${Math.round(route.year)}` : ""}`;
}

function go(route: Route, push: boolean) {
  try {
    if (push) history.pushState(null, "", hashFor(route));
    else history.replaceState(null, "", hashFor(route));
  } catch {
    // Some embedded viewers refuse history changes; the view still changes.
  }
}

function writeHash() {
  if (active) go({ civ: active.id, year }, false);
}

function showYear() {
  yearNumberEl.textContent = yearNumber(year);
  yearEraEl.textContent = era(year);
  yearPeriodEl.textContent = eraAt(year).name;
}

// Border downloads: fetch the years around the playhead, and further ahead while playing.
let loading = 0;
function ensureBorders() {
  if (!data) return;
  const ahead = playing ? Number(speedSelect.value) * 3 : 10;
  const from = Math.max(data.from, Math.floor(year) - 10);
  const to = Math.min(data.to, Math.ceil(year) + ahead);
  if (from > to || data.hasYears(from, to)) return;
  loading++;
  updateHint();
  data
    .load(from, to)
    .then((shapes) => {
      layer.add(shapes);
      render();
    })
    .catch((error: unknown) => console.error(error))
    .finally(() => {
      loading--;
      updateHint();
    });
}

let visible = 0;
function updateHint() {
  let text = "";
  if (data && year < data.from) text = `No borders are mapped before ${formatYear(data.from)}.`;
  else if (data && year > data.to + 0.5) text = `Borders are mapped up to ${formatYear(data.to)}.`;
  else if (loading) text = "Loading borders…";
  else if (data && visible === 0) text = "No borders are mapped for this year.";
  hintEl.textContent = text;
  hintEl.hidden = !text;
}

let drawing = false;
function render() {
  scene.requestRender();
  if (drawing) return;
  drawing = true;
  // Shapes are triangulated in the background; keep drawing until they are in.
  const tick = () => {
    const state = layer.update(year);
    visible = state.visible;
    updateHint();
    scene.requestRender();
    if (state.pending) requestAnimationFrame(tick);
    else drawing = false;
  };
  requestAnimationFrame(tick);
}

function setYear(next: number) {
  year = Math.min(NOW, Math.max(FIRST_YEAR, next));
  showYear();
  ensureBorders();
  render();
}

// Playback
let lastFrame = 0;
function frame(now: number) {
  if (!playing) return;
  const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  const next = year + dt * Number(speedSelect.value);
  if (next >= NOW) {
    setYear(NOW);
    timeline?.setYear(year);
    setPlaying(false);
    return;
  }
  setYear(next);
  timeline?.setYear(year);
  requestAnimationFrame(frame);
}

function setPlaying(on: boolean) {
  playing = on;
  playButton.setAttribute("aria-label", on ? "Pause" : "Play");
  playIcon.setAttribute("d", on ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5v14l11-7z");
  if (on) {
    if (year >= NOW - 0.01) setYear(FIRST_YEAR);
    lastFrame = 0;
    requestAnimationFrame(frame);
  } else {
    setYear(Math.round(year));
    timeline?.setYear(year);
    writeHash();
  }
}

playButton.addEventListener("click", () => setPlaying(!playing));
contextToggle.addEventListener("change", () => {
  layer.showContext = contextToggle.checked;
  render();
});
document.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (!landingEl.hidden) return;
  if (e.code === "Space" && !["BUTTON", "SELECT", "INPUT", "A"].includes(target.tagName) && target.id !== "track") {
    e.preventDefault();
    setPlaying(!playing);
  }
  if (e.key === "Escape") {
    info.hidden = true;
    sources.hidden = true;
  }
});

// Tap or click a realm for its details.
const nf = new Intl.NumberFormat("en");
function showInfo(p: Polity) {
  sources.hidden = true;
  const civ = civs?.ofRealm(p.name);
  $("info-kind").textContent = civ === active ? "Highlighted realm" : civ && highlighted.includes(civ) ? "Related realm" : "Realm";
  $("info-name").textContent = p.name;
  $("info-shape").textContent = formatRange(p.from, p.to);
  const span = data?.realmSpan(p.name) ?? [p.from, p.to];
  $("info-span").textContent = formatRange(span[0], span[1]);
  $("info-area").textContent = `${nf.format(Math.round(p.area / 1000) * 1000)} km²`;
  const links = $("info-links");
  links.replaceChildren();
  const link = (href: string, text: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = text;
    links.append(a);
  };
  if (p.wikipedia) link(`https://en.wikipedia.org/wiki/${encodeURIComponent(p.wikipedia.replace(/ /g, "_"))}`, "Wikipedia");
  if (p.wikidata) link(`https://www.wikidata.org/wiki/${encodeURIComponent(p.wikidata)}`, "Wikidata");
  info.hidden = false;
}

function polityAt(position: { x: number; y: number }): Polity | undefined {
  const picked = scene.pick(position as never);
  const p = defined(picked) ? (picked.id as Polity | undefined) : undefined;
  return p && typeof p === "object" && "rings" in p ? p : undefined;
}

// Tap or click a highlighted realm for its details, a greyed one to switch to it.
const handler = new ScreenSpaceEventHandler(scene.canvas);
handler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
  const p = polityAt(event.position);
  hideTooltip();
  if (!p) {
    info.hidden = true;
    return;
  }
  const civ = civs?.ofRealm(p.name);
  if (layer.isHighlighted(p.name) || !civ) showInfo(p);
  else {
    info.hidden = true;
    openCiv(civ, { year, push: true, flyTo: p.label ?? civ.center });
  }
}, ScreenSpaceEventType.LEFT_CLICK);

// Hovering a realm names it; a greyed realm also lights up.
let hoverPosition: { x: number; y: number } | null = null;
let hoverFrame = 0;
function hideTooltip() {
  tooltip.hidden = true;
  scene.canvas.style.cursor = "";
  layer.setHovered(null);
  render();
}
handler.setInputAction((event: ScreenSpaceEventHandler.MotionEvent) => {
  hoverPosition = { x: event.endPosition.x, y: event.endPosition.y };
  if (hoverFrame) return;
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0;
    if (!hoverPosition) return;
    const p = polityAt(hoverPosition);
    const civ = p && civs?.ofRealm(p.name);
    if (!p || !civ) {
      if (!tooltip.hidden) hideTooltip();
      return;
    }
    const greyed = !layer.isHighlighted(p.name);
    layer.setHovered(greyed ? p.name : null);
    tooltip.replaceChildren(
      Object.assign(document.createElement("strong"), { textContent: civ.name }),
      Object.assign(document.createElement("span"), {
        textContent: greyed ? `${formatRange(civ.from, civ.to)} · click to explore` : formatRange(civ.from, civ.to),
      }),
    );
    tooltip.style.transform = `translate(${hoverPosition.x + 14}px, ${hoverPosition.y + 14}px)`;
    tooltip.hidden = false;
    scene.canvas.style.cursor = "pointer";
    render();
  });
}, ScreenSpaceEventType.MOUSE_MOVE);
scene.canvas.addEventListener("pointerleave", () => {
  hoverPosition = null;
  hideTooltip();
});

$("info-close").addEventListener("click", () => (info.hidden = true));
$("sources-button").addEventListener("click", () => {
  info.hidden = true;
  sources.hidden = !sources.hidden;
});
$("sources-close").addEventListener("click", () => (sources.hidden = true));

// Cards on phones sit just above the timeline, whose height changes as lanes fold.
const footer = document.querySelector("footer")!;
new ResizeObserver(() => {
  document.documentElement.style.setProperty("--timeline-height", `${footer.offsetHeight}px`);
}).observe(footer);

// The highlighted civilization

/** Altitude that frames a realm of this many km². */
function altitudeFor(area: number): number {
  const altitude = Math.sqrt(area) * 1000 * 6 * (narrow ? 1.5 : 1);
  return Math.min(22_000_000, Math.max(2_500_000, altitude));
}

function focusView(c: Civilization): [number, number] {
  const pad = Math.max(60, (c.to - c.from) * 0.5);
  return [c.from - pad, c.to + pad];
}

function showHighlight() {
  if (!active) return;
  colors = highlightColors(
    active.name,
    highlighted.filter((c) => c !== active).map((c) => c.name),
  );
  const byRealm = new Map<string, string>();
  for (const c of highlighted) for (const n of c.names) byRealm.set(n, colors.get(c.name)!);
  layer.setHighlight(byRealm);

  const spans: Span[] = highlighted.map((c) => ({ name: c.name, from: c.from, to: c.to }));
  timeline?.setFeatured(spans, highlighted.length > 1 ? `${active.name} and related realms` : active.name);

  const legend = $("legend");
  legend.replaceChildren(
    ...highlighted.slice(0, 9).map((c) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = c === active ? "legend-item active" : "legend-item";
      button.style.setProperty("--swatch", colors.get(c.name)!);
      button.textContent = c.name;
      button.title = `${c.name}, ${formatRange(c.from, c.to)}`;
      if (c !== active) button.addEventListener("click", () => openCiv(c, { push: true }));
      else button.addEventListener("click", () => setYearEverywhere(Math.min(c.to, Math.max(c.from, year))));
      item.append(button);
      return item;
    }),
  );
  legend.hidden = highlighted.length < 2;
  render();
}

function setYearEverywhere(next: number) {
  setYear(next);
  timeline?.setYear(year);
  writeHash();
}

interface OpenOptions {
  year?: number;
  push?: boolean;
  /** Where to point the camera; defaults to the realm at its largest. */
  flyTo?: [number, number] | null;
}

/** Shows a civilization on the globe, with its related realms highlighted. */
function openCiv(c: Civilization, options: OpenOptions = {}) {
  if (!civs) return;
  const list = civs;
  const switching = active !== c;
  active = c;
  landingEl.hidden = true;
  document.title = `${c.name} · History Globe`;

  if (switching) {
    $("civ-title").textContent = c.name;
    $("civ-sub").textContent = `${formatRange(c.from, c.to)} · ${civEraText(c)}`;
    $("view-focus").textContent = "Its era";
    $("view-focus").setAttribute("aria-label", `Show the years of ${c.name}`);
    highlighted = list.family(c);
    showHighlight();

    // Realms Wikidata records as this one's predecessors and successors join the highlight.
    if (c.wikidata) {
      realmFacts(c.wikidata).then((facts) => {
        if (active !== c || !facts) return;
        const sub = `${formatRange(c.from, c.to)} · ${civEraText(c)}`;
        $("civ-sub").textContent = facts.figures.length ? `${sub} · ${facts.figures.join(", ")}` : sub;
        const linked = [...facts.before, ...facts.after]
          .map((q) => list.ofWikidata(q))
          .filter((o): o is Civilization => !!o && !highlighted.includes(o));
        if (!linked.length) return;
        highlighted = [...highlighted, ...linked];
        showHighlight();
      });
    }

    const target = options.flyTo === undefined ? c.center : options.flyTo;
    if (target) {
      const height = options.flyTo ? widget.camera.positionCartographic.height : altitudeFor(c.area);
      widget.camera.flyTo({
        destination: Cartesian3.fromDegrees(target[0], target[1] - (narrow ? 6 : 0), height),
        duration: 1.4,
      });
    }
  }

  const next = Math.min(NOW, Math.max(FIRST_YEAR, options.year ?? c.peakYear));
  if (timeline && switching && (next < timeline.viewFrom || next > timeline.viewTo || options.year === undefined)) {
    timeline.setView(...focusView(c));
  }
  setYear(next);
  timeline?.setYear(year);
  go({ civ: c.id, year }, options.push ?? false);
}

function showLanding() {
  if (playing) setPlaying(false);
  info.hidden = true;
  sources.hidden = true;
  hideTooltip();
  landingEl.hidden = false;
  document.title = "History Globe";
  landingEl.focus({ preventScroll: true });
}

function route() {
  if (!civs) return;
  const r = readHash();
  const c = r.civ ? civs.get(r.civ) : undefined;
  if (c) openCiv(c, { year: r.year });
  else showLanding();
}

$("back").addEventListener("click", (e) => {
  e.preventDefault();
  go({}, true);
  showLanding();
});
window.addEventListener("popstate", route);
window.addEventListener("hashchange", route);

showYear();

// Load the civilizations and the border index, then start.
const base = new URL("data/", document.baseURI).href;
Promise.all([Civilizations.load(base), BorderData.open(base)])
  .then(([list, borders]) => {
    civs = list;
    data = borders;
    statusEl.textContent = "";
    landing = new Landing(landingEl, list.list, (c) => openCiv(c, { push: true }));
    timeline = new Timeline({
      track: $("track"),
      min: FIRST_YEAR,
      max: NOW,
      year,
      view: [year - 200, year + 200],
      featured: [],
      featuredLabel: "",
      colorOf: (name) => colors.get(name) ?? "#9aa1a9",
      onYear: (next, settled) => {
        if (playing) setPlaying(false);
        setYear(next);
        if (settled) writeHash();
      },
    });
    const t = timeline;
    attachTimelineGrip($("timeline-grip"), footer, $("track"), t);
    $("view-focus").addEventListener("click", () => {
      if (!active) return;
      t.setView(...focusView(active));
      if (year < active.from || year > active.to) setYearEverywhere(active.peakYear);
    });
    $("view-all").addEventListener("click", () => t.setView(FIRST_YEAR, NOW));
    $("zoom-in").addEventListener("click", () => t.zoom(0.5));
    $("zoom-out").addEventListener("click", () => t.zoom(2));
    route();
  })
  .catch((error: unknown) => {
    statusEl.textContent = "The borders could not load. Reload the page to try again.";
    console.error(error);
  });

// A hook for automated checks.
(window as unknown as { historyGlobe: unknown }).historyGlobe = {
  setYear: (y: number) => {
    setYear(y);
    timeline?.setYear(year);
  },
  get timeline() {
    return timeline;
  },
  get landing() {
    return landing;
  },
  open: (id: string) => {
    const c = civs?.get(id);
    if (c) openCiv(c, { push: true });
  },
  scene,
};
