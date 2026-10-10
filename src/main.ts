import {
  buildModuleUrl,
  Cartesian2,
  Cartesian3,
  CesiumWidget,
  defined,
  EllipsoidTerrainProvider,
  ImageryLayer,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  TileMapServiceImageryProvider,
} from "cesium";
import "cesium/Build/Cesium/Widgets/CesiumWidget/CesiumWidget.css";
import "./style.css";
import { civEraText, Civilizations, type Civilization } from "./civilizations";
import { formatNumber, initLanguage, languageMenu, t, translatePage, withText, type MessageKey } from "./i18n";
import { highlightColors } from "./colors";
import { countryCivIds, loadCountries, type Country, type CountryView } from "./countries";
import { BorderData, type Polity } from "./data";
import { eraAt, eraName, ERAS, NOW } from "./eras";
import { EventLayer } from "./eventLayer";
import { Feedback } from "./feedback";
import { badgeSvg, eventArticle, eventLinks, kindLabel, loadEvents, type HistoryEvent } from "./events";
import { Landing } from "./landing";
import { MapView, PROJECTIONS } from "./mapView";
import { Picker } from "./picker";
import { PolityLayer } from "./polityLayer";
import { Timeline, type Lane, type LaneLink } from "./timeline";
import { attachTimelineGrip } from "./timelineGrip";
import { loadTravel, Travel, travelWhen, type TravelEvent } from "./travel";
import { pictureCredit, pictureTitle, realmFacts } from "./wikidata";
import { wikidataEvents } from "./wikiEvents";
import { era, formatRange, formatYear, yearNumber } from "./years";

const FIRST_YEAR = ERAS[0].from;
// Old links (#y1241) open on the Mongol Empire, the first prototype's subject.
const DEFAULT_CIV = "mongol-empire";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Choices saved before the app was renamed from History Globe move to the new
// names; cached Wikidata answers are dropped and fetched again.
try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith("history-globe:")) continue;
    const value = localStorage.getItem(key);
    if (value !== null && !key.startsWith("history-globe:facts:")) {
      localStorage.setItem(key.replace("history-globe:", "terra-tempora:"), value);
    }
    localStorage.removeItem(key);
  }
} catch {
  // Storage blocked; nothing was saved.
}

// The interface text comes first: everything below writes it.
await initLanguage();
translatePage();
document.querySelector(".toolbar")!.append(languageMenu("language toolbar-language"));
document.querySelector(".landing-head")!.prepend(languageMenu("language landing-language"));

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

// The globe can be drawn upright or leaning on Earth's axial tilt, 23.5°,
// with the North Pole to the right as on a classroom globe. The camera looks
// straight down, so its heading turns the picture about the screen's centre.
const AXIAL_TILT = 23.5;
const TILT_KEY = "terra-tempora:tilted";
let tilted = (() => {
  try {
    return localStorage.getItem(TILT_KEY) === "1";
  } catch {
    return false;
  }
})();

function orientation() {
  return { heading: tilted ? CesiumMath.toRadians(-AXIAL_TILT) : 0, pitch: -CesiumMath.PI_OVER_TWO, roll: 0 };
}

widget.camera.setView({
  destination: Cartesian3.fromDegrees(78, narrow ? 28 : 32, narrow ? 22_000_000 : 14_500_000),
  orientation: orientation(),
});

const layer = new PolityLayer(scene);
const eventLayer = new EventLayer(scene);

// The flat map: the same borders in a choice of projections.
const mapCanvas = $<HTMLCanvasElement>("map");
let mapHover = 0;
const map = new MapView(mapCanvas, {
  onHover: (p, x, y) => {
    cancelAnimationFrame(mapHover);
    mapHover = requestAnimationFrame(() => (p ? hoverRealm(p, x, y) : !tooltip.hidden && hideTooltip()));
  },
  onClick: (p) => clickRealm(p),
  onEventHover: (e, x, y) => {
    if (e) {
      cancelAnimationFrame(mapHover);
      hoverEvent(e, x, y);
    }
  },
  onEventClick: (e) => openEvent(e),
  bottomInset: () => (document.querySelector("footer")?.offsetHeight ?? 0) + 12,
});
let data: BorderData | undefined;
let civs: Civilizations | undefined;
let timeline: Timeline | undefined;
let landing: Landing | undefined;
let year = 1206;
let playing = false;
// The civilizations highlighted on the globe. With one civilization picked,
// the realms related to it join it (`expanded`); with several, exactly those.
let active: Civilization | undefined;
let highlighted: Civilization[] = [];
let expanded = true;
/** The country whose lineage is shown, when the view was opened from a country card. */
let country: Country | null = null;
/** Whether the country is shown as a nation (its lineage) or as land (all that crossed it). */
let countryView: CountryView = "nationality";
let countries: Country[] = [];
let colors = new Map<string, string>();

// Links: #c=mongol-empire&y=1241 opens a civilization on a year, with its
// related realms; #c=a,b,c&m=1 opens exactly those civilizations. An empty hash
// opens the landing page. #y1241 (and #y-500 for 500 BCE) still work.
interface Route {
  /** A country, by id: its lineage (#k=) or its territory (#t=). */
  country?: string;
  view?: CountryView;
  civs?: string[];
  /** Exactly these civilizations, without their related realms. */
  multi?: boolean;
  year?: number;
  /** The history travel. */
  travel?: boolean;
}

function readHash(): Route {
  const legacy = /^#y(-?\d{1,5})$/.exec(location.hash);
  if (legacy) return { civs: [DEFAULT_CIV], year: Number(legacy[1]) };
  const params = new URLSearchParams(location.hash.slice(1));
  const y = params.get("y");
  if (params.has("travel")) return { travel: true, year: y && /^-?\d{1,5}$/.test(y) ? Number(y) : undefined };
  const ids = params.get("c")?.split(",").filter(Boolean);
  return {
    country: params.get("t") ?? params.get("k") ?? undefined,
    view: params.has("t") ? "territory" : "nationality",
    civs: ids?.length ? ids : undefined,
    multi: params.get("m") === "1" || (ids?.length ?? 0) > 1,
    year: y && /^-?\d{1,5}$/.test(y) ? Number(y) : undefined,
  };
}

function hashFor(route: Route): string {
  if (route.travel) return "#travel";
  if (route.country)
    return `#${route.view === "territory" ? "t" : "k"}=${route.country}${route.year !== undefined ? `&y=${Math.round(route.year)}` : ""}`;
  if (!route.civs?.length) return location.pathname + location.search;
  const multi = route.multi && route.civs.length === 1 ? "&m=1" : "";
  return `#c=${route.civs.join(",")}${multi}${route.year !== undefined ? `&y=${Math.round(route.year)}` : ""}`;
}

function go(route: Route, push: boolean) {
  try {
    if (push) history.pushState(null, "", hashFor(route));
    else history.replaceState(null, "", hashFor(route));
  } catch {
    // Some embedded viewers refuse history changes; the view still changes.
  }
}

function currentRoute(): Route {
  if (country) return { country: country.id, view: countryView, year };
  return expanded && active
    ? { civs: [active.id], year }
    : { civs: highlighted.map((c) => c.id), multi: true, year };
}

function writeHash() {
  if (active) go(currentRoute(), false);
}

function showYear() {
  yearNumberEl.textContent = yearNumber(year);
  yearEraEl.textContent = era(year);
  yearPeriodEl.textContent = eraName(eraAt(year));
}

// Border downloads: fetch the years around the playhead, and further ahead while playing.
let loading = 0;
function ensureBorders() {
  if (!data) return;
  const ahead = travel?.active ? Math.max(10, travel.speed * 4) : playing ? Number(speedSelect.value) * 3 : 10;
  const from = Math.max(data.from, Math.floor(year) - 10);
  const to = Math.min(data.to, Math.ceil(year) + ahead);
  if (from > to || data.hasYears(from, to)) return;
  loading++;
  updateHint();
  data
    .load(from, to)
    .then((shapes) => {
      layer.add(shapes);
      map.add(shapes);
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
  if (data && year < data.from) text = t("hint.before", { year: formatYear(data.from) });
  else if (data && year > data.to + 0.5) text = t("hint.after", { year: formatYear(data.to) });
  else if (loading) text = t("status.loading");
  else if (data && visible === 0) text = t("hint.none");
  hintEl.textContent = text;
  hintEl.hidden = !text;
}

let drawing = false;
function render() {
  if (map.active) {
    map.setYear(year);
    updateHint();
    return;
  }
  if (travel?.active) eventLayer.update(year, (e) => travelBadges.get(e as TravelEvent) ?? 0);
  else eventLayer.update(year);
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
  playButton.setAttribute("aria-label", on ? t("controls.pause") : t("controls.play"));
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

function togglePlay() {
  if (travel?.active) travel.setPlaying(!travel.running);
  else setPlaying(!playing);
}

playButton.addEventListener("click", togglePlay);
contextToggle.addEventListener("change", () => {
  layer.showContext = contextToggle.checked;
  map.showContext = contextToggle.checked;
  render();
});
document.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (!landingEl.hidden) return;
  if (e.code === "Space" && !["BUTTON", "SELECT", "INPUT", "A"].includes(target.tagName) && target.id !== "track") {
    e.preventDefault();
    togglePlay();
  }
  if (e.key === "Escape") {
    travel?.release();
    info.hidden = true;
    closeEvent();
    sources.hidden = true;
  }
});

// Tap or click a realm for its details.
let shownRealm: Polity | null = null;
function showInfo(p: Polity) {
  shownRealm = p;
  sources.hidden = true;
  closeEvent();
  const civ = civs?.ofRealm(p.name);
  $("info-kind").textContent =
    civ && highlighted.includes(civ) ? (civ === active || !expanded ? t("info.highlighted") : t("info.related")) : t("info.realm");
  $("info-name").textContent = p.name;
  $("info-shape").textContent = formatRange(p.from, p.to);
  const span = data?.realmSpan(p.name) ?? [p.from, p.to];
  $("info-span").textContent = formatRange(span[0], span[1]);
  $("info-area").textContent = t("info.area", { area: formatNumber(Math.round(p.area / 1000) * 1000) });
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

function eventAt(position: { x: number; y: number }): HistoryEvent | undefined {
  const picked = scene.pick(position as never);
  const e = defined(picked) ? (picked.id as HistoryEvent | undefined) : undefined;
  return e && typeof e === "object" && "lonLat" in e ? e : undefined;
}

function polityAt(position: { x: number; y: number }): Polity | undefined {
  const picked = scene.pick(position as never);
  const p = defined(picked) ? (picked.id as Polity | undefined) : undefined;
  return p && typeof p === "object" && "rings" in p ? p : undefined;
}

// Tap or click a highlighted realm for its details, a greyed one to switch to it.
function clickRealm(p: Polity | null | undefined) {
  hideTooltip();
  if (!p) {
    info.hidden = true;
    closeEvent();
    return;
  }
  const civ = civs?.ofRealm(p.name);
  if (layer.isHighlighted(p.name) || !civ) showInfo(p);
  else {
    info.hidden = true;
    openCiv(civ, { year, push: true, flyTo: p.label ?? civ.center });
  }
}

// Hovering a realm names it; a greyed realm also lights up.
function hoverRealm(p: Polity | null | undefined, x: number, y: number) {
  const civ = p && civs?.ofRealm(p.name);
  if (!p || !civ) {
    if (!tooltip.hidden) hideTooltip();
    return;
  }
  const greyed = !layer.isHighlighted(p.name);
  layer.setHovered(greyed ? p.name : null);
  map.setHovered(greyed ? p.name : null);
  tooltip.replaceChildren(
    Object.assign(document.createElement("strong"), { textContent: civ.name }),
    Object.assign(document.createElement("span"), {
      textContent: greyed ? t("tooltip.explore", { years: formatRange(civ.from, civ.to) }) : formatRange(civ.from, civ.to),
    }),
  );
  tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
  tooltip.hidden = false;
  scene.canvas.style.cursor = "pointer";
  mapCanvas.style.cursor = "pointer";
  render();
}

function hideTooltip() {
  tooltip.hidden = true;
  scene.canvas.style.cursor = "";
  mapCanvas.style.cursor = "";
  layer.setHovered(null);
  map.setHovered(null);
  render();
}

const handler = new ScreenSpaceEventHandler(scene.canvas);
handler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
  const e = eventAt(event.position);
  if (e && travel?.active) travel.pin(e as TravelEvent);
  else if (e) openEvent(e);
  else clickRealm(polityAt(event.position));
}, ScreenSpaceEventType.LEFT_CLICK);

let hoverPosition: { x: number; y: number } | null = null;
let hoverFrame = 0;
handler.setInputAction((event: ScreenSpaceEventHandler.MotionEvent) => {
  hoverPosition = { x: event.endPosition.x, y: event.endPosition.y };
  if (hoverFrame) return;
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0;
    if (!hoverPosition) return;
    const e = eventAt(hoverPosition);
    if (travel?.active) {
      // In the history travel, a badge opens its card rather than a tooltip.
      travel.hoverOnBadge((e as TravelEvent | undefined) ?? null);
      if (e) {
        hideTooltip();
        scene.canvas.style.cursor = "pointer";
        return;
      }
    }
    if (e) hoverEvent(e, hoverPosition.x, hoverPosition.y);
    else hoverRealm(polityAt(hoverPosition), hoverPosition.x, hoverPosition.y);
  });
}, ScreenSpaceEventType.MOUSE_MOVE);
// Visitors' reports, from the panels, the Sources list, the landing page, or
// "Report something here" on a right-click on the globe or map.
const feedback = new Feedback($("feedback"));
const hereButton = $<HTMLButtonElement>("here-report");
let hereContext: Parameters<Feedback["open"]>[0] | null = null;

function offerReportHere(x: number, y: number, lonLat: [number, number] | null, p: Polity | null | undefined) {
  if (!lonLat) return;
  hideTooltip();
  const civ = p ? civs?.ofRealm(p.name) : undefined;
  hereContext = { kind: "place", id: civ?.id, name: p?.name, year: Math.round(year), lonLat };
  hereButton.style.transform = `translate(${x + 8}px, ${y + 8}px)`;
  hereButton.hidden = false;
  hereButton.focus();
}

hereButton.addEventListener("click", () => {
  hereButton.hidden = true;
  if (hereContext) feedback.open(hereContext);
});
hereButton.addEventListener("blur", () => window.setTimeout(() => (hereButton.hidden = true), 150));

handler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
  const at = widget.camera.pickEllipsoid(new Cartesian2(event.position.x, event.position.y), scene.globe.ellipsoid);
  const place = at ? scene.globe.ellipsoid.cartesianToCartographic(at) : undefined;
  const lonLat: [number, number] | null = place
    ? [CesiumMath.toDegrees(place.longitude), CesiumMath.toDegrees(place.latitude)]
    : null;
  offerReportHere(event.position.x, event.position.y, lonLat, polityAt(event.position));
}, ScreenSpaceEventType.RIGHT_CLICK);
scene.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
mapCanvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const box = mapCanvas.getBoundingClientRect();
  const x = e.clientX - box.left;
  const y = e.clientY - box.top;
  offerReportHere(e.clientX, e.clientY, map.lonLatAt(x, y), map.polityAt(x, y));
});

$("info-report").addEventListener("click", () => {
  const p = shownRealm;
  if (!p) return;
  const civ = civs?.ofRealm(p.name);
  feedback.open({ kind: "realm", id: civ?.id, name: p.name, year: Math.round(year), lonLat: p.label });
});
$("event-report").addEventListener("click", () => {
  const e = openedEvent;
  if (e) feedback.open({ kind: "event", id: e.id, name: e.title, year: e.year, lonLat: e.lonLat });
});
for (const id of ["sources-report", "landing-report"]) $(id).addEventListener("click", () => feedback.open({ kind: "app" }));

scene.canvas.addEventListener("pointerleave", () => {
  hoverPosition = null;
  travel?.hoverOnBadge(null);
  hideTooltip();
});

// Hovering a lane's before/after icon names that civilization and its years.
const trackEl = $("track");
trackEl.addEventListener("pointerover", (e) => {
  const mark = (e.target as HTMLElement).closest<HTMLElement>(".mark");
  const link = mark ?? (e.target as HTMLElement).closest<HTMLElement>(".lane-link");
  if (!link) return;
  if (mark) {
    tooltip.replaceChildren(
      Object.assign(document.createElement("strong"), { textContent: mark.dataset.label }),
      Object.assign(document.createElement("span"), {
        textContent: t(mark.classList.contains("cluster") ? "tooltip.zoomIn" : "tooltip.see", { detail: mark.dataset.detail ?? "" }),
      }),
    );
  } else {
    tooltip.replaceChildren(
      Object.assign(document.createElement("span"), { textContent: link.dataset.side === "before" ? t("tooltip.before") : t("tooltip.after") }),
      Object.assign(document.createElement("strong"), { textContent: link.dataset.name }),
      Object.assign(document.createElement("span"), { textContent: t("tooltip.open", { years: link.dataset.range ?? "" }) }),
    );
  }
  tooltip.hidden = false;
  const icon = link.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  const x = Math.min(window.innerWidth - tip.width - 8, Math.max(8, icon.left + icon.width / 2 - tip.width / 2));
  tooltip.style.transform = `translate(${x}px, ${icon.top - tip.height - 8}px)`;
});
trackEl.addEventListener("pointerout", (e) => {
  if ((e.target as HTMLElement).closest(".lane-link, .mark")) tooltip.hidden = true;
});

$("info-close").addEventListener("click", () => (info.hidden = true));
$("sources-button").addEventListener("click", () => {
  info.hidden = true;
  sources.hidden = !sources.hidden;
  if (!sources.hidden) closeEvent();
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

/** Years that frame these civilizations on the timeline. */
function focusView(list: Civilization[]): [number, number] {
  const from = Math.min(...list.map((c) => c.from));
  const to = Math.max(...list.map((c) => c.to));
  const pad = Math.max(60, (to - from) * (list.length > 1 ? 0.1 : 0.5));
  return [from - pad, to + pad];
}

/** The civilizations whose years the "Current Civilization Era" button frames. */
function chosen(): Civilization[] {
  return expanded && active ? [active] : highlighted;
}

function viewTitle(list: Civilization[]): string {
  if (list.length === 1) return list[0].name;
  if (list.length === 2) return t("masthead.two", { first: list[0].name, second: list[1].name });
  return t("masthead.more", { first: list[0].name, second: list[1].name, count: list.length - 2 });
}

function flyToCiv(c: Civilization, target: [number, number] | null = c.center, keepHeight = false) {
  if (!target) return;
  if (map.active) return map.focus(target[0], target[1], keepHeight ? null : c.area);
  const height = keepHeight ? widget.camera.positionCartographic.height : altitudeFor(c.area);
  widget.camera.flyTo({
    destination: Cartesian3.fromDegrees(target[0], target[1] - (narrow ? 6 : 0), height),
    orientation: orientation(),
    duration: 1.4,
  });
}

/** Points the camera so all these civilizations are in view at once. */
function flyToAll(list: Civilization[]) {
  const centers = list.map((c) => c.center).filter((p): p is [number, number] => !!p);
  if (centers.length < 2) return flyToCiv(list[0]);
  // Average on the sphere, so realms on either side of the antimeridian meet in the middle.
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lon, lat] of centers) {
    const l = (lon * Math.PI) / 180;
    const p = (lat * Math.PI) / 180;
    x += Math.cos(p) * Math.cos(l);
    y += Math.cos(p) * Math.sin(l);
    z += Math.sin(p);
  }
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  const lat = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
  // Widest angle from the middle to any realm, in kilometres along the ground.
  const spread = Math.max(
    ...centers.map(([a, b]) => {
      const cos =
        Math.sin((lat * Math.PI) / 180) * Math.sin((b * Math.PI) / 180) +
        Math.cos((lat * Math.PI) / 180) * Math.cos((b * Math.PI) / 180) * Math.cos(((a - lon) * Math.PI) / 180);
      return Math.acos(Math.min(1, Math.max(-1, cos))) * 6371;
    }),
  );
  const largest = Math.max(...list.map((c) => c.area));
  if (map.active) return map.focus(lon, lat, Math.max(largest, (spread * 1.6) ** 2));
  const height = Math.min(22_000_000, Math.max(altitudeFor(largest), spread * 1000 * (narrow ? 3.2 : 2.2)));
  widget.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat - (narrow ? 6 : 0), height),
    orientation: orientation(),
    duration: 1.4,
  });
}

/**
 * Puts a highlighted civilization in the middle of the screen: the year moves
 * into its lifetime if needed (to its largest extent), and the camera flies to
 * where it stands that year.
 */
function focusCiv(c: Civilization) {
  if (year < c.from || year > c.to) {
    timeline?.setView(...focusView([c]));
    setYearEverywhere(c.peakYear);
  }
  flyToCiv(c, layer.labelAt(c.names, year) ?? c.center);
}

function setTilted(on: boolean, animate = true) {
  tilted = on;
  try {
    localStorage.setItem(TILT_KEY, on ? "1" : "0");
  } catch {
    // Storage blocked; the choice lasts until the page reloads.
  }
  const button = $("tilt");
  button.setAttribute("aria-pressed", String(on));
  button.title = on ? t("tilt.uprightTitle") : t("tilt.tiltTitle", { degrees: formatNumber(AXIAL_TILT) });
  $("tilt-label").textContent = on ? t("tilt.upright") : t("tilt.tilt", { degrees: formatNumber(AXIAL_TILT) });
  if (!animate) return;
  // Turn the picture about the point at the centre of the screen.
  const camera = widget.camera;
  const centre = camera.pickEllipsoid(
    new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2),
    scene.globe.ellipsoid,
  );
  const height = camera.positionCartographic.height;
  const target = centre ? scene.globe.ellipsoid.cartesianToCartographic(centre) : camera.positionCartographic;
  camera.flyTo({
    destination: Cartesian3.fromRadians(target.longitude, target.latitude, height),
    orientation: orientation(),
    duration: 0.8,
  });
}

$("tilt").addEventListener("click", () => setTilted(!tilted));
setTilted(tilted, false);

// Globe or flat map. The map opens on the place the globe was looking at, and
// the globe comes back to where the map was.
const MAP_KEY = "terra-tempora:view";
const PROJECTION_KEY = "terra-tempora:projection";
function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked; the choice lasts until the page reloads.
  }
}

const projectionSelect = $<HTMLSelectElement>("projection");
for (const p of PROJECTIONS) projectionSelect.append(new Option(t(`projection.${p.id}` as MessageKey), p.id));
projectionSelect.value = PROJECTIONS.some((p) => p.id === stored(PROJECTION_KEY)) ? stored(PROJECTION_KEY)! : PROJECTIONS[0].id;
map.setProjection(projectionSelect.value);
projectionSelect.addEventListener("change", () => {
  const { lon, lat, zoom } = map.centre();
  map.setProjection(projectionSelect.value);
  store(PROJECTION_KEY, projectionSelect.value);
  // Stay on the same place, at a comparable zoom.
  if (zoom > 1) map.focus(lon, lat, (14_000 / zoom) ** 2);
  else map.focus(lon, 0, null);
});

/** The point at the middle of the globe and the realm size its altitude frames. */
function globeCentre(): { lon: number; lat: number; area: number } {
  const camera = widget.camera;
  const centre = camera.pickEllipsoid(
    new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2),
    scene.globe.ellipsoid,
  );
  const at = centre ? scene.globe.ellipsoid.cartesianToCartographic(centre) : camera.positionCartographic;
  const side = camera.positionCartographic.height / 6000 / (narrow ? 1.5 : 1);
  return { lon: CesiumMath.toDegrees(at.longitude), lat: CesiumMath.toDegrees(at.latitude), area: side * side };
}

function setMapMode(on: boolean, sync = true) {
  if (on === map.active && sync) return;
  hideTooltip();
  $("view-globe").setAttribute("aria-pressed", String(!on));
  $("view-map").setAttribute("aria-pressed", String(on));
  $("projection-field").hidden = !on;
  $("tilt").hidden = on;
  $("globe").hidden = on;
  store(MAP_KEY, on ? "map" : "globe");
  if (on) {
    const { lon, lat, area } = globeCentre();
    map.show();
    if (sync) map.focus(lon, lat, area);
    render();
  } else {
    const { lon, lat, zoom } = map.centre();
    map.hide();
    if (sync) {
      const side = Math.min(22_000_000, Math.max(2_500_000, (14_000 / zoom) * 6000 * (narrow ? 1.5 : 1)));
      widget.camera.setView({ destination: Cartesian3.fromDegrees(lon, lat, side), orientation: orientation() });
    }
    widget.resize();
    render();
  }
}

$("view-globe").addEventListener("click", () => setMapMode(false));
$("view-map").addEventListener("click", () => setMapMode(true));

/** Civilizations Wikidata records before and after each one, by id. */
const neighbours = new Map<string, { before: Civilization[]; after: Civilization[] }>();
let neighbourFrame = 0;

/** Looks up the civilizations before and after these; lanes gain icons as answers arrive. */
function loadNeighbours(list: Civilization[]) {
  for (const c of list) {
    if (!c.wikidata || neighbours.has(c.id)) continue;
    neighbours.set(c.id, { before: [], after: [] });
    realmFacts(c.wikidata).then((facts) => {
      if (!facts || !civs) return;
      const known = civs;
      const pick = (ids: string[]) =>
        [...new Set(ids.map((q) => known.ofWikidata(q)).filter((o): o is Civilization => !!o && o !== c))].sort(
          (a, b) => a.from - b.from,
        );
      neighbours.set(c.id, { before: pick(facts.before), after: pick(facts.after) });
      if (!highlighted.includes(c)) return;
      cancelAnimationFrame(neighbourFrame);
      neighbourFrame = requestAnimationFrame(showHighlight);
    });
  }
}

const toLink = (c: Civilization): LaneLink => ({ id: c.id, name: c.name, from: c.from, to: c.to });

function showHighlight() {
  if (!active) return;
  colors = highlightColors(
    active.name,
    highlighted.filter((c) => c !== active).map((c) => c.name),
  );
  const byRealm = new Map<string, string>();
  for (const c of highlighted) for (const n of c.names) byRealm.set(n, colors.get(c.name)!);
  layer.setHighlight(byRealm);
  map.setHighlight(byRealm);

  loadNeighbours(highlighted);
  const lanes: Lane[] = highlighted.map((c) => ({
    name: c.name,
    from: c.from,
    to: c.to,
    before: neighbours.get(c.id)?.before.map(toLink),
    after: neighbours.get(c.id)?.after.map(toLink),
  }));
  const label = country
    ? countryView === "territory"
      ? t("lanes.territory", { name: country.name })
      : t("lanes.nationality", { name: country.name })
    : !expanded
    ? t("lanes.count", { count: highlighted.length })
    : highlighted.length > 1
      ? t("lanes.related", { name: active.name })
      : active.name;
  timeline?.setFeatured(lanes, label);
  showEvents();
  render();
}

// Events: the badges of the highlighted civilizations' battles, treaties and
// so on, on the globe, the map and the timeline.
let allEvents: HistoryEvent[] = [];
let shownEvents: HistoryEvent[] = [];
let openedEvent: HistoryEvent | null = null;

function eventWhen(e: HistoryEvent): string {
  return e.to && e.to !== e.year ? formatRange(e.year, e.to) : formatYear(e.year);
}

// Events from Wikidata, for civilizations without hand-written ones.
let fetchedEvents: HistoryEvent[] = [];

/** The events of the highlighted civilizations; hand-written ones win over Wikidata's. */
function highlightedEvents(): HistoryEvent[] {
  const ids = new Set(highlighted.map((c) => c.id));
  const ours = (e: HistoryEvent) => e.civs.some((id) => ids.has(id));
  const written = allEvents.filter(ours);
  const titles = new Set(written.map((e) => e.wikipedia));
  return [...written, ...fetchedEvents.filter((e) => ours(e) && !titles.has(e.wikipedia))];
}

function showEvents() {
  renderEvents(highlightedEvents());
  const curated = new Set(allEvents.flatMap((e) => e.civs));
  const wanted = highlighted.filter((c) => !curated.has(c.id));
  if (!wanted.length) return;
  const asked = highlighted;
  wikidataEvents(base, wanted).then((events) => {
    const byId = new Map(fetchedEvents.map((e) => [e.id, e]));
    for (const e of events) {
      const known = byId.get(e.id);
      // A battle between two realms is tied to both once both have been asked for.
      if (known) known.civs = [...new Set([...known.civs, ...e.civs])];
      else fetchedEvents.push(e);
    }
    if (asked === highlighted && events.length) renderEvents(highlightedEvents());
  });
}

function renderEvents(events: HistoryEvent[]) {
  shownEvents = events;
  eventLayer.set(shownEvents);
  eventLayer.update(year);
  map.setEvents(shownEvents);
  timeline?.setMarks(
    shownEvents.map((e) => ({
      id: e.id,
      year: e.year,
      icon: badgeSvg(e.kind, 14),
      label: e.title,
      detail: `${kindLabel(e.kind)} · ${eventWhen(e)}`,
    })),
  );
  if (openedEvent && !shownEvents.includes(openedEvent)) closeEvent();
}

const eventPanel = $("event");
function closeEvent() {
  openedEvent = null;
  eventPanel.hidden = true;
}

/** Opens the panel with an event's story, picture and further reading. */
function openEvent(e: HistoryEvent) {
  hideTooltip();
  info.hidden = true;
  sources.hidden = true;
  openedEvent = e;
  $("event-badge").innerHTML = badgeSvg(e.kind, 22);
  $("event-kind").textContent = kindLabel(e.kind);
  $("event-title").textContent = e.title;
  const where = typeof e.approx === "string" ? e.approx : e.approx ? t("event.approximate", { place: e.place }) : e.place;
  $("event-when").textContent = `${eventWhen(e)} · ${where}`;
  $("event-summary").textContent = e.summary;
  $("event-links").replaceChildren(
    ...eventLinks(e).map((l) => {
      const item = document.createElement("li");
      const a = Object.assign(document.createElement("a"), { href: l.url, target: "_blank", rel: "noopener", textContent: l.label });
      item.append(a);
      if (l.note) item.append(Object.assign(document.createElement("small"), { textContent: l.note }));
      return item;
    }),
  );
  const figure = $("event-figure");
  const image = $<HTMLImageElement>("event-image");
  figure.hidden = true;
  image.removeAttribute("src");
  eventPanel.hidden = false;
  eventPanel.scrollTop = 0;
  eventArticle(e).then((article) => {
    if (openedEvent !== e || !article) return;
    // Wikidata only gives a one-line description; the article's opening tells the story.
    if (e.fromWikidata && article.extract) $("event-summary").textContent = article.extract;
    const picture = article.picture;
    if (!picture) return;
    image.onload = () => {
      if (openedEvent === e) figure.hidden = false;
    };
    image.src = picture.thumb;
    const credit = $<HTMLAnchorElement>("event-credit");
    credit.href = picture.page;
    credit.textContent = pictureCredit(picture);
    credit.title = pictureTitle(picture);
  });
}

function hoverEvent(e: HistoryEvent, x: number, y: number) {
  layer.setHovered(null);
  map.setHovered(null);
  tooltip.replaceChildren(
    Object.assign(document.createElement("strong"), { textContent: e.title }),
    Object.assign(document.createElement("span"), { textContent: t("tooltip.event", { kind: kindLabel(e.kind), when: eventWhen(e) }) }),
  );
  tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
  tooltip.hidden = false;
  scene.canvas.style.cursor = "pointer";
  mapCanvas.style.cursor = "pointer";
}

/** Turns the globe or map to a place, keeping the zoom unless it is too far out. */
function flyToPoint([lon, lat]: [number, number]) {
  if (map.active) return map.focus(lon, lat, null);
  const height = Math.min(widget.camera.positionCartographic.height, 9_000_000);
  widget.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat - (narrow ? 6 : 0), height),
    orientation: orientation(),
    duration: 1.2,
  });
}

$("event-close").addEventListener("click", closeEvent);

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

function showMasthead() {
  const list = chosen();
  const from = Math.min(...list.map((c) => c.from));
  const to = Math.max(...list.map((c) => c.to));
  const title = country ? country.name : viewTitle(list);
  $("civ-title").textContent = title;
  const years = formatRange(from, to);
  $("civ-sub").textContent = country
    ? countryView === "territory"
      ? t("masthead.territory", { count: list.length, name: country.name, years })
      : t("masthead.nationality", { count: list.length, name: country.name, years })
    : list.length === 1
      ? `${years} · ${civEraText(list[0])}`
      : t("masthead.several", { count: list.length, years });
  $("view-focus").setAttribute("aria-label", t("masthead.focusLabel", { name: title }));
  document.title = t("page.titleOf", { name: title });
}

/** Shows a civilization on the globe, with its related realms highlighted. */
function openCiv(c: Civilization, options: OpenOptions = {}) {
  if (!civs) return;
  const list = civs;
  leaveTravel();
  const switching = active !== c || !expanded || !!country;
  country = null;
  showOutline(null);
  active = c;
  expanded = true;
  landingEl.hidden = true;

  if (switching) {
    highlighted = list.family(c);
    showMasthead();
    showHighlight();

    // Realms Wikidata records as this one's predecessors and successors join the highlight.
    if (c.wikidata) {
      realmFacts(c.wikidata).then((facts) => {
        if (active !== c || !expanded || !facts) return;
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

    if (options.flyTo === undefined) flyToCiv(c);
    else flyToCiv(c, options.flyTo, true);
  }

  const next = Math.min(NOW, Math.max(FIRST_YEAR, options.year ?? c.peakYear));
  if (timeline && switching && (next < timeline.viewFrom || next > timeline.viewTo || options.year === undefined)) {
    timeline.setView(...focusView([c]));
  }
  setYear(next);
  timeline?.setYear(year);
  go(currentRoute(), options.push ?? false);
}

interface ViewOptions {
  year?: number;
  push?: boolean;
  /** Move the camera to the first civilization (default true). */
  fly?: boolean;
  /** The country whose lineage or territory this is. */
  country?: Country;
  countryView?: CountryView;
}

/** Shows exactly these civilizations on the globe, each in its own colour. */
function openView(list: Civilization[], options: ViewOptions = {}) {
  const unique = [...new Set(list)];
  if (!unique.length) return;
  leaveTravel();
  active = unique[0];
  expanded = false;
  country = options.country ?? null;
  countryView = options.countryView ?? "nationality";
  showOutline(country && countryView === "territory" ? country : null);
  highlighted = unique;
  landingEl.hidden = true;
  showMasthead();
  showHighlight();
  if (options.fly ?? true) flyToAll(unique);

  // Stay on the year asked for if any of the civilizations existed then.
  const wanted = options.year;
  const fits = wanted !== undefined && unique.some((c) => wanted >= c.from && wanted <= c.to);
  timeline?.setView(...focusView(unique));
  setYear(Math.min(NOW, Math.max(FIRST_YEAR, fits ? wanted : active.peakYear)));
  timeline?.setYear(year);
  go(currentRoute(), options.push ?? false);
}

/** Shows the civilizations picked in the list: new ones join, unticked ones leave. */
function applyPicked(list: Civilization[]) {
  if (!list.length) return;
  const fresh = list.filter((c) => !highlighted.includes(c));
  if (!fresh.length) return openView(list, { year, push: true, fly: false });
  // Jump to the first new civilization's heyday unless one of them is already alive this year.
  const alive = fresh.some((c) => year >= c.from && year <= c.to);
  openView(list, { year: alive ? year : fresh[0].peakYear, push: true, fly: false });
  flyToCiv(fresh[0]);
}

/** Points the camera at a place, framing an area of so many km². */
function flyToPlace([lon, lat]: [number, number], area: number) {
  if (map.active) return map.focus(lon, lat, area);
  widget.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat - (narrow ? 6 : 0), altitudeFor(area)),
    orientation: orientation(),
    duration: 1.4,
  });
}

/** Outlines a country's present border on the globe and map, or clears it. */
let outlineFor: Country | null = null;
function showOutline(k: Country | null) {
  outlineFor = k;
  layer.setOutline(null);
  map.setOutline(null);
  const modern = k && civs?.get(k.civ);
  if (!k || !modern || !data) return;
  const names = new Set(modern.names);
  const last = data.to;
  data
    .load(last, last)
    .then((shapes) => {
      if (outlineFor !== k) return;
      // Cliopatria writes overseas parts as "(Name)"; leave those out.
      const rings = shapes
        .filter((p) => p.to >= last && names.has(p.name) && !p.name.startsWith("("))
        .flatMap((p) => p.rings);
      layer.setOutline(rings);
      map.setOutline(rings);
    })
    .catch((error: unknown) => console.error(error));
}

/**
 * Shows a country: as a nationality, every civilization that led to it; as a
 * territory, every civilization whose borders crossed its present land.
 */
function openCountry(k: Country, view: CountryView, options: { year?: number; push?: boolean } = {}) {
  if (!civs) return;
  const known = civs;
  const list = countryCivIds(k, view)
    .map((id) => known.get(id))
    .filter((c): c is Civilization => !!c);
  if (!list.length) return;
  const start = view === "territory" ? k.territoryYear : k.startYear;
  openView(list, { year: options.year ?? start, push: options.push, fly: false, country: k, countryView: view });
  // A territory is about the land, so it sits in the middle; a hand-picked
  // lineage centres on the realm it is built around.
  const focus = view === "nationality" && k.blurb ? known.get(k.focus) : undefined;
  if (focus) flyToCiv(focus);
  else flyToPlace(k.centre, k.area);
}

function showLanding() {
  leaveTravel();
  if (playing) setPlaying(false);
  info.hidden = true;
  sources.hidden = true;
  hideTooltip();
  landingEl.hidden = false;
  landing?.show();
  document.title = t("page.title");
  landingEl.focus({ preventScroll: true });
}

// The history travel: time plays on its own through the turning points of
// world history, the globe turning to each as it comes.
let travel: Travel | undefined;
let travelEvents: TravelEvent[] = [];
let travelBadges = new Map<TravelEvent, number>();
const travelLayer = $("travel-layer");
let travelRealms = "";
let travelRealmsAt = 0;

function startTravel(at?: number) {
  if (!travelEvents.length || !timeline) return;
  if (playing) setPlaying(false);
  const line = timeline;
  if (!travel) {
    travel = new Travel(
      travelEvents,
      {
        scene,
        end: NOW,
        setYear: (y) => {
          setYear(y);
          line.setYear(year);
        },
        baseSpeed: () => Number(speedSelect.value),
        showBadges: (opacity) => {
          travelBadges = opacity;
          eventLayer.update(year, (e) => opacity.get(e as TravelEvent) ?? 0);
          scene.requestRender();
        },
        showRealms: (events) => showTravelRealms(events),
        onPlaying: (on) => {
          playButton.setAttribute("aria-label", on ? t("controls.pause") : t("controls.play"));
          playIcon.setAttribute("d", on ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5v14l11-7z");
        },
        orientation,
        centre: () => {
          const { lon, lat } = globeCentre();
          return [lon, lat];
        },
        latOffset: narrow ? 8 : 0,
        narrow,
        report: (e) => feedback.open({ kind: "turning-point", id: e.id, name: e.title, year: e.year, lonLat: e.lonLat }),
      },
      travelLayer,
    );
  }
  info.hidden = true;
  sources.hidden = true;
  closeEvent();
  hideTooltip();
  showOutline(null);
  if (map.active) setMapMode(false);
  landingEl.hidden = true;
  document.body.classList.add("traveling");
  active = undefined;
  country = null;
  highlighted = [];
  travelRealms = "";
  layer.setHighlight(new Map());
  map.setHighlight(new Map());
  $("civ-title").textContent = t("travel.title");
  $("civ-sub").textContent = t("travel.sub", { count: travelEvents.length });
  document.title = t("page.titleOf", { name: t("travel.title") });
  line.setFeatured([], "");
  line.setView(FIRST_YEAR, NOW);
  shownEvents = travelEvents;
  eventLayer.set(travelEvents);
  line.setMarks(
    travelEvents.map((e) => ({
      id: e.id,
      year: e.year,
      icon: badgeSvg(e.kind, 14),
      label: e.title,
      detail: `${kindLabel(e.kind)} · ${travelWhen(e)}`,
    })),
  );
  // Cruise at 25 years a second; the travel slows down by itself where history crowds.
  speedSelect.value = "25";
  // Pull back so whole regions show around each turning point.
  const { lon, lat } = globeCentre();
  widget.camera.setView({
    destination: Cartesian3.fromDegrees(lon, lat, narrow ? 18_000_000 : 13_000_000),
    orientation: orientation(),
  });
  go({ travel: true }, false);
  travel.start(at);
}

function leaveTravel() {
  if (!travel?.active) return;
  travel.stop();
  document.body.classList.remove("traveling");
  shownEvents = [];
  eventLayer.set([]);
  timeline?.setMarks([]);
}

/** Lights up the realms each turning point on screen happened in, newest in the accent colour. */
function showTravelRealms(events: TravelEvent[]) {
  const now = performance.now();
  if (now - travelRealmsAt < 300 && events.length) return;
  travelRealmsAt = now;
  const names = [...new Set(events.map((e) => layer.realmAt(e.lonLat[0], e.lonLat[1], year)).filter((n): n is string => !!n))];
  const key = names.join("|");
  if (key === travelRealms) return;
  travelRealms = key;
  const byRealm = names.length ? highlightColors(names[0], names.slice(1)) : new Map<string, string>();
  layer.setHighlight(byRealm);
  map.setHighlight(byRealm);
  render();
}

function route() {
  if (!civs) return;
  const list = civs;
  const r = readHash();
  if (r.travel) return startTravel(r.year);
  const k = r.country ? countries.find((c) => c.id === r.country) : undefined;
  if (k) return openCountry(k, r.view ?? "nationality", { year: r.year });
  const found = (r.civs ?? []).map((id) => list.get(id)).filter((c): c is Civilization => !!c);
  if (!found.length) showLanding();
  else if (!r.multi) openCiv(found[0], { year: r.year });
  else openView(found, { year: r.year });
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
Promise.all([
  Civilizations.load(base),
  BorderData.open(base),
  // The countries are a bonus; the page works without them.
  loadCountries(base)
    .then((list) => withText(base, "countries.json", list))
    .catch((error: unknown) => (console.error(error), [] as Country[])),
  loadEvents(base).catch((error: unknown) => (console.error(error), [] as HistoryEvent[])),
  loadTravel(base).catch((error: unknown) => (console.error(error), [] as TravelEvent[])),
])
  .then(([list, borders, loaded, events, turningPoints]) => {
    travelEvents = turningPoints;
    civs = list;
    allEvents = events;
    countries = loaded;
    data = borders;
    statusEl.textContent = "";
    landing = new Landing(
      landingEl,
      list.list,
      (picked) => (picked.length === 1 ? openCiv(picked[0], { push: true }) : openView(picked, { push: true })),
      countries,
      (k, view) => openCountry(k, view, { push: true }),
      () => Civilizations.outlines(base),
    );
    const picker = new Picker($("picker"), list.list, applyPicked);
    $("add-civs").addEventListener("click", () => picker.open(new Set(highlighted)));
    timeline = new Timeline({
      track: $("track"),
      min: FIRST_YEAR,
      max: NOW,
      year,
      view: [year - 200, year + 200],
      featured: [],
      featuredLabel: "",
      colorOf: (name) => colors.get(name) ?? "#9aa1a9",
      onMark: (id) => {
        const e = shownEvents.find((x) => x.id === id);
        if (!e) return;
        if (travel?.active) {
          tooltip.hidden = true;
          return travel.seekTo(e as TravelEvent);
        }
        if (playing) setPlaying(false);
        tooltip.hidden = true;
        setYearEverywhere(e.year);
        flyToPoint(e.lonLat);
        openEvent(e);
      },
      onLink: (id) => {
        if (playing) setPlaying(false);
        hideTooltip();
        const c = list.get(id);
        if (c) openCiv(c, { push: true });
      },
      onLane: (name) => {
        if (playing) setPlaying(false);
        const c = highlighted.find((h) => h.name === name);
        if (c) focusCiv(c);
      },
      onYear: (next, settled) => {
        if (travel?.active) {
          travel.setPlaying(false);
          return travel.seek(next);
        }
        if (playing) setPlaying(false);
        setYear(next);
        if (settled) writeHash();
      },
    });
    const line = timeline;
    attachTimelineGrip($("timeline-grip"), footer, $("track"), line);
    $("view-focus").addEventListener("click", () => {
      if (!active) return;
      const list = chosen();
      line.setView(...focusView(list));
      if (!list.some((c) => year >= c.from && year <= c.to)) setYearEverywhere(list[0].peakYear);
    });
    $("view-all").addEventListener("click", () => line.setView(FIRST_YEAR, NOW));
    for (const id of ["travel-start", "travel-button"])
      $(id).addEventListener("click", () => {
        go({ travel: true }, true);
        startTravel();
      });
    $("zoom-in").addEventListener("click", () => line.zoom(0.5));
    $("zoom-out").addEventListener("click", () => line.zoom(2));
    if (stored(MAP_KEY) === "map") setMapMode(true, false);
    route();
  })
  .catch((error: unknown) => {
    statusEl.textContent = t("status.failed");
    console.error(error);
  });

// A hook for automated checks.
(window as unknown as { terraTempora: unknown }).terraTempora = {
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
  get travel() {
    return travel;
  },
  open: (id: string) => {
    const c = civs?.get(id);
    if (c) openCiv(c, { push: true });
  },
  scene,
};
