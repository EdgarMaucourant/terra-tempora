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
import { BorderData, type Polity } from "./data";
import { eraAt, ERAS, NOW } from "./eras";
import { PolityLayer } from "./polityLayer";
import { Timeline } from "./timeline";
import { era, formatRange, formatYear, yearNumber } from "./years";

const START_YEAR = 1206;
const FIRST_YEAR = ERAS[0].from;
// The view the timeline opens on, and the "Mongol era" button returns to.
const FOCUS_VIEW: [number, number] = [1150, 1550];

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
let timeline: Timeline | undefined;
let year = readYearFromHash() ?? START_YEAR;
let playing = false;

function readYearFromHash(): number | undefined {
  // Links can open on a year: …#y1241, or #y-500 for 500 BCE
  const match = /^#y(-?\d{1,5})$/.exec(location.hash);
  return match ? Math.min(NOW, Math.max(FIRST_YEAR, Number(match[1]))) : undefined;
}

function writeHash() {
  try {
    history.replaceState(null, "", `#y${Math.round(year)}`);
  } catch {
    // Some embedded viewers refuse history changes; the year still works.
  }
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
  if (e.code === "Space" && !["BUTTON", "SELECT"].includes(target.tagName) && target.id !== "track") {
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
  $("info-kind").textContent = p.featured ? "Mongol realm" : "Realm";
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

// Cards on phones sit just above the timeline, whose height changes as lanes fold.
const footer = document.querySelector("footer")!;
new ResizeObserver(() => {
  document.documentElement.style.setProperty("--timeline-height", `${footer.offsetHeight}px`);
}).observe(footer);

showYear();

// Load the border index and start.
BorderData.open(new URL("data/", document.baseURI).href)
  .then((borders) => {
    data = borders;
    statusEl.textContent = "";
    const startView: [number, number] =
      year >= FOCUS_VIEW[0] && year <= FOCUS_VIEW[1] ? FOCUS_VIEW : [year - 200, year + 200];
    timeline = new Timeline({
      track: $("track"),
      min: FIRST_YEAR,
      max: NOW,
      year,
      view: startView,
      featured: borders.featured,
      onYear: (next, settled) => {
        if (playing) setPlaying(false);
        setYear(next);
        if (settled) writeHash();
      },
    });
    const t = timeline;
    $("view-focus").addEventListener("click", () => {
      t.setView(...FOCUS_VIEW);
      if (year < FOCUS_VIEW[0] || year > FOCUS_VIEW[1]) {
        setYear(START_YEAR);
        t.setYear(year);
        writeHash();
      }
    });
    $("view-all").addEventListener("click", () => t.setView(FIRST_YEAR, NOW));
    $("zoom-in").addEventListener("click", () => t.zoom(0.5));
    $("zoom-out").addEventListener("click", () => t.zoom(2));
    setYear(year);
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
  scene,
};
