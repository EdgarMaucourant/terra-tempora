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
import { featuredLifespans, loadDataset, type Polity } from "./data";
import { featuredColor } from "./colors";
import { PolityLayer } from "./polityLayer";
import { era, formatRange, yearNumber } from "./years";

const START_YEAR = 1206;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const slider = $<HTMLInputElement>("year-slider");
const yearNumberEl = $("year-number");
const yearEraEl = $("year-era");
const playButton = $<HTMLButtonElement>("play");
const playIcon = document.getElementById("play-icon")!;
const speedSelect = $<HTMLSelectElement>("speed");
const contextToggle = $<HTMLInputElement>("context-toggle");
const statusEl = $("status");
const lanesEl = $("lanes");
const ticksEl = $("ticks");
const info = $("info");
const sources = $("sources");

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

let year = readYearFromHash() ?? START_YEAR;
let playing = false;
let layer: PolityLayer | undefined;
let polities: Polity[] = [];
let minYear = 1100;
let maxYear = 1500;

function readYearFromHash(): number | undefined {
  // Links can open on a year: …#y1241
  const match = /^#y(-?\d{1,4})$/.exec(location.hash);
  return match ? Number(match[1]) : undefined;
}

function setYear(next: number, { fromSlider = false } = {}) {
  year = Math.min(maxYear, Math.max(minYear, next));
  yearNumberEl.textContent = yearNumber(year);
  yearEraEl.textContent = era(year);
  if (!fromSlider) slider.value = String(year);
  updateNowLine();
  render();
}

let buildingFrames = 0;
function render() {
  if (!layer) return;
  const pending = layer.update(year);
  scene.requestRender();
  // Shapes are triangulated in the background; keep drawing until they are in.
  if (pending && buildingFrames === 0) {
    const tick = () => {
      buildingFrames++;
      const stillPending = layer!.update(year);
      scene.requestRender();
      if (stillPending && buildingFrames < 600) requestAnimationFrame(tick);
      else buildingFrames = 0;
    };
    requestAnimationFrame(tick);
  }
}

// Playback
let lastFrame = 0;
function frame(now: number) {
  if (!playing) return;
  const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  const next = year + dt * Number(speedSelect.value);
  if (next >= maxYear) {
    setYear(maxYear);
    setPlaying(false);
    return;
  }
  setYear(next);
  requestAnimationFrame(frame);
}

function setPlaying(on: boolean) {
  playing = on;
  playButton.setAttribute("aria-label", on ? "Pause" : "Play");
  playIcon.setAttribute("d", on ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5v14l11-7z");
  if (on) {
    if (year >= maxYear - 0.01) setYear(minYear);
    lastFrame = 0;
    requestAnimationFrame(frame);
  } else {
    setYear(Math.round(year));
    writeHash();
  }
}

function writeHash() {
  try {
    history.replaceState(null, "", `#y${Math.round(year)}`);
  } catch {
    // Some embedded viewers refuse history changes; the year still works.
  }
}

playButton.addEventListener("click", () => setPlaying(!playing));
slider.addEventListener("input", () => {
  if (playing) setPlaying(false);
  setYear(Number(slider.value), { fromSlider: true });
});
slider.addEventListener("change", () => {
  setYear(Math.round(Number(slider.value)));
  writeHash();
});
contextToggle.addEventListener("change", () => {
  if (layer) layer.showContext = contextToggle.checked;
  render();
});
document.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (e.code === "Space" && target.tagName !== "BUTTON" && target.tagName !== "SELECT") {
    e.preventDefault();
    setPlaying(!playing);
  }
  if (e.key === "Escape") {
    info.hidden = true;
    sources.hidden = true;
  }
});

// Timeline decorations
const pct = (y: number) => ((y - minYear) / (maxYear - minYear)) * 100;
let nowLine: HTMLDivElement | undefined;

function updateNowLine() {
  if (nowLine) nowLine.style.left = `${pct(year)}%`;
}

function buildTimeline() {
  ticksEl.replaceChildren();
  for (let y = minYear; y <= maxYear; y += 50) {
    const tick = document.createElement("span");
    tick.style.left = `${pct(y)}%`;
    if (y % 100 !== 0) tick.className = "minor";
    tick.textContent = String(y);
    ticksEl.append(tick);
  }

  // One lane per featured realm, from its first to its last year here.
  lanesEl.replaceChildren();
  const spans = featuredLifespans(polities);
  const rows: { to: number; el: HTMLDivElement }[] = [];
  for (const span of spans) {
    // Pack realms into as few lanes as possible without overlap.
    let row = rows.find((r) => r.to < span.from - 4);
    if (!row) {
      const el = document.createElement("div");
      el.className = "lane";
      lanesEl.append(el);
      row = { to: -Infinity, el };
      rows.push(row);
    }
    row.to = span.to;
    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = "lane-bar";
    bar.style.left = `${pct(span.from)}%`;
    bar.style.width = `${pct(Math.min(span.to + 1, maxYear)) - pct(span.from)}%`;
    bar.style.background = featuredColor(span.name);
    bar.textContent = span.name;
    bar.title = `${span.name}, ${formatRange(span.from, span.to)}`;
    bar.addEventListener("click", () => {
      setPlaying(false);
      setYear(span.from);
      writeHash();
    });
    row.el.append(bar);
  }
  nowLine = document.createElement("div");
  nowLine.className = "now-line";
  lanesEl.append(nowLine);
  updateNowLine();
  document.documentElement.style.setProperty("--timeline-height", `${$("year-slider").closest("footer")!.offsetHeight}px`);
}

// Tap or click a realm for its details.
const nf = new Intl.NumberFormat("en");
function showInfo(p: Polity) {
  sources.hidden = true;
  $("info-kind").textContent = p.featured ? "Mongol realm" : "Realm";
  $("info-name").textContent = p.name;
  $("info-shape").textContent = formatRange(p.from, p.to);
  const all = polities.filter((q) => q.name === p.name);
  const from = Math.min(...all.map((q) => q.from));
  const to = Math.max(...all.map((q) => q.to));
  $("info-span").textContent = formatRange(from, to);
  $("info-area").textContent = `${nf.format(Math.round(p.area / 1000) * 1000)} km²`;
  const links = $("info-links");
  links.replaceChildren();
  if (p.wikipedia) {
    const a = document.createElement("a");
    a.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(p.wikipedia.replace(/ /g, "_"))}`;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Wikipedia";
    links.append(a);
  }
  if (p.wikidata) {
    const a = document.createElement("a");
    a.href = `https://www.wikidata.org/wiki/${encodeURIComponent(p.wikidata)}`;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Wikidata";
    links.append(a);
  }
  info.hidden = false;
}

const handler = new ScreenSpaceEventHandler(scene.canvas);
handler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
  const picked = scene.pick(event.position);
  const p = defined(picked) ? (picked.id as Polity | undefined) : undefined;
  if (p && typeof p === "object" && "rings" in p) showInfo(p);
  else info.hidden = true;
}, ScreenSpaceEventType.LEFT_CLICK);

$("info-close").addEventListener("click", () => (info.hidden = true));
$("sources-button").addEventListener("click", () => {
  info.hidden = true;
  sources.hidden = !sources.hidden;
});
$("sources-close").addEventListener("click", () => (sources.hidden = true));

window.addEventListener("resize", () => {
  document.documentElement.style.setProperty("--timeline-height", `${slider.closest("footer")!.offsetHeight}px`);
});

// Load the borders and start.
loadDataset(new URL("data/polities.json", document.baseURI).href)
  .then((dataset) => {
    polities = dataset.polities;
    minYear = dataset.from;
    maxYear = dataset.to;
    slider.min = String(minYear);
    slider.max = String(maxYear);
    layer = new PolityLayer(scene, polities);
    buildTimeline();
    statusEl.textContent = "";
    setYear(year);
  })
  .catch((error: unknown) => {
    statusEl.textContent = "The borders could not load. Reload the page to try again.";
    console.error(error);
  });

// Expose a hook for automated checks.
(window as unknown as { historyGlobe: unknown }).historyGlobe = {
  setYear: (y: number) => setYear(y),
  scene,
};
