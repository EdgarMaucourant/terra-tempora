// The /stats page: the anonymous usage counts the Worker reads back from
// Analytics Engine (GET /api/stats), drawn as plain bars and columns. Names
// come from the site's own data files, so ids read as civilizations,
// countries and turning points.

import "@fontsource-variable/instrument-sans";
import "./stats.css";
import { el } from "./dom";
import { formatYear } from "./years";

type Row = Record<string, string | number>;

interface Stats {
  days: number;
  [query: string]: Row[] | null | number;
}

interface Names {
  civs: Map<string, string>;
  countries: Map<string, string>;
  /** Turning points of the history travel, in order. */
  turningPoints: { id: string; title: string }[];
  events: Map<string, string>;
}

const main = document.getElementById("stats")!;
const base = new URL("data/", document.baseURI).href;

const FEATURES: Record<string, string> = {
  play: "Play / pause",
  speed: "Speed",
  "context-toggle": "Other realms",
  "view-globe": "Globe button",
  "view-map": "Map button",
  "view-tab": "View tab (phone)",
  "axis-natural": "Natural axis",
  "axis-free": "Free axis",
  "explore-toggle": "Menu",
  "sources-button": "Sources",
  "about-button": "About",
  "panel-open": "Open side panel",
  "panel-close": "Close side panel",
  "add-civs": "Add civilizations",
  "view-focus": "Timeline: focus",
  "view-all": "Timeline: all",
  "zoom-in": "Timeline: zoom in",
  "zoom-out": "Timeline: zoom out",
  "here-report": "Report this spot",
  "feedback-send": "Send report",
  "multi-toggle": "Multi-select",
  "multi-open": "Open selected",
  "civ-sort": "Sort civilizations",
  language: "Language",
  back: "Back to today",
};
const LISTS: Record<string, string> = {
  civs: "Civilizations",
  countries: "Countries",
  nations: "Nations",
  travel: "History travel",
};
const PAUSES: Record<string, string> = {
  button: "Pause button",
  drag: "Dragged the globe",
  timeline: "Moved the timeline",
};
// Why /api/stats refused the sign-in (worker/index.js), and what to check.
const SIGN_IN: Record<string, string> = {
  "": "Sign in through Cloudflare Access to see the counts (reload the page).",
  "no-token": "No Cloudflare Access sign-in reached the counts: check that the Access application covers this domain, with the paths stats and api/stats, then reload.",
  team: "The sign-in comes from another Access team than the ACCESS_TEAM secret: set it to your team domain, e.g. yourteam.cloudflareaccess.com.",
  audience: "The sign-in is for another Access application than the ACCESS_AUD secret: set it to the AUD tag of the application that covers /stats.",
  expired: "The Access sign-in has expired: reload the page to sign in again.",
  key: "The Access sign-in could not be checked against the team's keys: check the ACCESS_TEAM secret.",
  signature: "The Access sign-in's signature is not valid: reload the page to sign in again.",
  algorithm: "The Access sign-in is of an unexpected kind: reload the page to sign in again.",
  unreadable: "The Access sign-in could not be read: reload the page to sign in again.",
};
const MODES: Record<string, string> = { home: "Today's world", view: "A civilization or country", travel: "History travel" };

async function loadJson<T>(file: string): Promise<T | null> {
  try {
    const response = await fetch(new URL(file, base));
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

async function loadNames(): Promise<Names> {
  const [civs, countries, travel, events] = await Promise.all([
    loadJson<{ civilizations: { id: string; name: string }[] }>("civilizations.json"),
    loadJson<{ countries: { id: string; name: string }[] }>("countries.json"),
    loadJson<{ events: { id: string; title: string; year: number }[] }>("travel.json"),
    loadJson<{ events: { id: string; title: string }[] }>("events.json"),
  ]);
  const turningPoints = [...(travel?.events ?? [])].sort((a, b) => a.year - b.year);
  return {
    civs: new Map(civs?.civilizations.map((c) => [c.id, c.name])),
    countries: new Map(countries?.countries.map((c) => [c.id, c.name])),
    turningPoints,
    events: new Map([...(events?.events ?? []), ...turningPoints].map((e) => [e.id, e.title])),
  };
}

const number = (n: number) => Math.round(n).toLocaleString("en");

function duration(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

function rows(stats: Stats, name: string): Row[] {
  const value = stats[name];
  return Array.isArray(value) ? value : [];
}

function card(title: string, note?: string, wide = false): HTMLElement {
  const section = el("section", wide ? "card wide" : "card");
  section.append(el("h2", undefined, title));
  if (note) section.append(el("p", "muted", note));
  return section;
}

/** Horizontal bars, longest first: a label, its bar and its count. */
function bars(items: { label: string; value: number; text?: string }[], empty = "Nothing yet."): HTMLElement {
  if (!items.length) return el("p", "muted", empty);
  const max = Math.max(...items.map((i) => i.value), 1);
  const list = el("ol", "bars");
  for (const item of items) {
    const row = el("li");
    const bar = el("span", "bar");
    bar.style.width = `${(item.value / max) * 100}%`;
    row.title = `${item.label}: ${item.text ?? number(item.value)}`;
    row.append(el("span", "bar-label", item.label), el("span", "bar-track"), el("span", "bar-value", item.text ?? number(item.value)));
    row.children[1].append(bar);
    list.append(row);
  }
  return list;
}

const SVG = "http://www.w3.org/2000/svg";
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Vertical columns along an axis, each with its own tooltip. */
function columns(items: { label: string; value: number; tip: string }[], axis: (i: number) => string | null): SVGSVGElement {
  const width = 720;
  const height = 180;
  const bottom = 22;
  const top = 14;
  const max = Math.max(...items.map((i) => i.value), 1);
  const step = width / Math.max(items.length, 1);
  const chart = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "columns", role: "img" });
  chart.append(svg("line", { x1: 0, x2: width, y1: height - bottom, y2: height - bottom, class: "axis" }));
  const peak = svg("text", { x: 0, y: 10, class: "tick" });
  peak.textContent = `max ${number(max)}`;
  chart.append(peak);
  items.forEach((item, i) => {
    const h = ((height - bottom - top) * item.value) / max;
    const group = svg("g");
    const title = svg("title");
    title.textContent = item.tip;
    // The hover target is the whole column, taller than the bar itself.
    group.append(
      title,
      svg("rect", { x: i * step, y: top, width: step, height: height - bottom - top, class: "hit" }),
      svg("rect", { x: i * step + Math.min(1, step * 0.1), y: height - bottom - h, width: Math.max(1, step - 2), height: h, rx: Math.min(3, step / 3), class: "column" }),
    );
    chart.append(group);
    const label = axis(i);
    if (label) {
      // The first and last labels line up with the chart's edges rather than spill past them.
      const first = i === 0;
      const last = i === items.length - 1 && !first;
      const text = svg("text", {
        x: first ? 0 : last ? width : i * step + step / 2,
        y: height - 6,
        class: "tick",
        "text-anchor": first ? "start" : last ? "end" : "middle",
      });
      text.textContent = label;
      chart.append(text);
    }
  });
  return chart;
}

/** Share of playthroughs that reached at least each turning point. */
function dropOff(sessions: Row[], names: Names): HTMLElement {
  const box = el("div");
  if (!sessions.length) {
    box.append(el("p", "muted", "No history travel yet."));
    return box;
  }
  const total = sessions.reduce((sum, s) => sum + Number(s.weight || 1), 0);
  const count = names.turningPoints.length || Math.max(...sessions.map((s) => Number(s.reached)));
  const reachedAtLeast = Array.from({ length: count }, (_, i) =>
    sessions.reduce((sum, s) => sum + (Number(s.reached) > i ? Number(s.weight || 1) : 0), 0),
  );
  const width = 720;
  const height = 200;
  const left = 34;
  const bottom = 22;
  const x = (i: number) => left + ((width - left - 8) * i) / Math.max(count - 1, 1);
  const y = (share: number) => 8 + (height - bottom - 8) * (1 - share);
  const chart = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "dropoff", role: "img" });
  for (const share of [0, 0.5, 1]) {
    chart.append(svg("line", { x1: left, x2: width - 8, y1: y(share), y2: y(share), class: share ? "grid" : "axis" }));
    const tick = svg("text", { x: left - 6, y: y(share) + 4, class: "tick", "text-anchor": "end" });
    tick.textContent = `${share * 100}%`;
    chart.append(tick);
  }
  const points = reachedAtLeast.map((n, i) => `${x(i)},${y(n / total)}`);
  chart.append(
    svg("path", { d: `M${x(0)},${y(0)} L${points.join(" L")} L${x(count - 1)},${y(0)} Z`, class: "area" }),
    svg("path", { d: `M${points.join(" L")}`, class: "line" }),
  );
  reachedAtLeast.forEach((n, i) => {
    const point = names.turningPoints[i];
    const group = svg("g");
    const title = svg("title");
    title.textContent = `#${i + 1} ${point?.title ?? ""}: ${Math.round((n / total) * 100)}% of playthroughs got here`;
    group.append(title, svg("rect", { x: x(i) - (x(1) - x(0)) / 2, y: 0, width: x(1) - x(0), height: height - bottom, class: "hit" }));
    chart.append(group);
  });
  for (const i of [0, Math.floor(count / 4), Math.floor(count / 2), Math.floor((3 * count) / 4), count - 1]) {
    const tick = svg("text", { x: x(i), y: height - 6, class: "tick", "text-anchor": "middle" });
    tick.textContent = `#${i + 1}`;
    chart.append(tick);
  }
  const sorted = sessions.map((s) => Number(s.reached)).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const seconds = sessions.map((s) => Number(s.seconds)).sort((a, b) => a - b);
  box.append(
    chart,
    el(
      "p",
      "muted",
      `${number(total)} playthroughs. Half stopped before turning point #${median + 1}${
        names.turningPoints[median] ? ` (${names.turningPoints[median].title})` : ""
      }; the median playthrough lasted ${duration(seconds[Math.floor(seconds.length / 2)])}. Hover the curve for each turning point.`,
    ),
  );
  return box;
}

function tile(label: string, value: string): HTMLElement {
  const box = el("div", "tile");
  box.append(el("span", "tile-value", value), el("span", "tile-label", label));
  return box;
}

function render(stats: Stats, names: Names) {
  const sum = (name: string) => rows(stats, name).reduce((total, r) => total + Number(r.n), 0);
  const periodRows = rows(stats, "periods");
  const seconds = periodRows.reduce((total, r) => total + Number(r.seconds), 0);
  const sessions = rows(stats, "travel");
  const tiles = el("div", "tiles");
  tiles.append(
    tile("visits", number(sum("visits"))),
    tile("history travels started", number(Number(rows(stats, "travelStarts")[0]?.n ?? 0))),
    tile("time spent on the timeline", duration(seconds)),
    tile("civilizations & countries opened", number(sum("opened"))),
  );

  const visits = card("Visits per day", "Each page load counts once.", true);
  const days = rows(stats, "visits");
  visits.append(
    days.length
      ? columns(
          days.map((d) => ({ label: String(d.day), value: Number(d.n), tip: `${String(d.day).slice(0, 10)}: ${number(Number(d.n))} visits` })),
          (i) =>
            i === 0 || i === days.length - 1 || (i % 7 === 0 && days.length - 1 - i > 3) ? String(days[i].day).slice(5, 10) : null,
        )
      : el("p", "muted", "No visits yet."),
  );

  const periods = card("Time spent per century", "Seconds the timeline sat in each century while the page was seen and in use (or the history travel played).", true);
  const byCentury = new Map<number, Map<string, number>>();
  for (const r of periodRows) {
    const c = Number(r.century);
    const modes = byCentury.get(c) ?? new Map<string, number>();
    modes.set(String(r.mode), (modes.get(String(r.mode)) ?? 0) + Number(r.seconds));
    byCentury.set(c, modes);
  }
  const centuries = [...byCentury.keys()].sort((a, b) => a - b);
  const periodItems = centuries.map((c) => {
    const modes = byCentury.get(c)!;
    const total = [...modes.values()].reduce((a, b) => a + b, 0);
    const split = [...modes].map(([m, s]) => `${MODES[m] ?? m} ${duration(s)}`).join(", ");
    return { label: String(c), value: total, tip: `${formatYear(c)} to ${formatYear(c + 99)}: ${duration(total)} (${split})` };
  });
  periods.append(
    periodItems.length
      ? columns(periodItems, (i) => {
          const every = Math.max(1, Math.ceil(periodItems.length / 8));
          return i % every === 0 ? formatYear(centuries[i]) : null;
        })
      : el("p", "muted", "Nothing yet."),
  );
  const topPeriods = [...periodItems].sort((a, b) => b.value - a.value).slice(0, 10);
  periods.append(
    el("h3", undefined, "Most-viewed centuries"),
    bars(topPeriods.map((p) => ({ label: p.tip.split(":")[0], value: p.value, text: duration(p.value) }))),
  );

  const travel = card("History travel: where people stop", "Share of playthroughs that reached each turning point (counted when they leave it or hide the page).", true);
  travel.append(dropOff(sessions, names), el("h3", undefined, "Why time was stopped"));
  travel.append(bars(rows(stats, "pauses").map((r) => ({ label: PAUSES[String(r.reason)] ?? String(r.reason), value: Number(r.n) }))));

  const opened = rows(stats, "opened");
  const openedOf = (kinds: string[], namesOf: Map<string, string>) =>
    bars(
      opened
        .filter((r) => kinds.includes(String(r.kind)))
        .reduce((list, r) => {
          const label = namesOf.get(String(r.id)) ?? String(r.id);
          const found = list.find((x) => x.label === label);
          if (found) found.value += Number(r.n);
          else list.push({ label, value: Number(r.n) });
          return list;
        }, [] as { label: string; value: number }[])
        .sort((a, b) => b.value - a.value)
        .slice(0, 25),
    );
  const civCard = card("Most-opened civilizations", "From a card, a link, the globe or the timeline.");
  civCard.append(openedOf(["civ", "multi"], names.civs));
  const countryCard = card("Most-opened countries", "Countries (land) and Nations (lineage).");
  countryCard.append(el("h3", undefined, "Countries"), openedOf(["territory"], names.countries));
  countryCard.append(el("h3", undefined, "Nations"), openedOf(["nationality"], names.countries));

  const features = card("Most-used controls");
  features.append(bars(rows(stats, "features").map((r) => ({ label: FEATURES[String(r.name)] ?? String(r.name), value: Number(r.n) }))));
  features.append(
    el("h3", undefined, "Choices made"),
    bars(rows(stats, "choices").map((r) => ({ label: `${FEATURES[String(r.name)] ?? r.name}: ${r.value}`, value: Number(r.n) }))),
  );

  const lists = card("Menus and views");
  lists.append(
    el("h3", undefined, "Lists opened"),
    bars(rows(stats, "lists").map((r) => ({ label: LISTS[String(r.name)] ?? String(r.name), value: Number(r.n) }))),
    el("h3", undefined, "Globe or map (events seen in each)"),
    bars(rows(stats, "views").map((r) => ({ label: String(r.name), value: Number(r.n) }))),
  );

  const clicks = card("Realms and events clicked");
  clicks.append(
    el("h3", undefined, "Realms clicked for details"),
    bars(rows(stats, "realms").map((r) => ({ label: String(r.name), value: Number(r.n) }))),
    el("h3", undefined, "Events opened"),
    bars(rows(stats, "events").filter((r) => r.kind === "event").slice(0, 15).map((r) => ({ label: names.events.get(String(r.id)) ?? String(r.id), value: Number(r.n) }))),
    el("h3", undefined, "Turning-point cards opened in the history travel"),
    bars(rows(stats, "events").filter((r) => r.kind === "travel-card").slice(0, 15).map((r) => ({ label: names.events.get(String(r.id)) ?? String(r.id), value: Number(r.n) }))),
  );

  const searches = card("Searches that found nothing", "What visitors looked for and the lists don't have.");
  searches.append(
    bars(
      rows(stats, "searches").map((r) => ({ label: `${r.query} (${LISTS[String(r.section)] ?? r.section})`, value: Number(r.n) })),
      "No empty searches yet.",
    ),
  );

  const audience = card("Where visitors come from", "Sources come from ?ref= links, else the referring site.");
  audience.append(
    el("h3", undefined, "Sources"),
    bars(rows(stats, "sources").map((r) => ({ label: String(r.name), value: Number(r.n) }))),
    el("h3", undefined, "Countries"),
    bars(rows(stats, "countries").map((r) => ({ label: String(r.name) || "unknown", value: Number(r.n) }))),
  );
  const people = card("Languages and devices");
  people.append(
    el("h3", undefined, "Languages"),
    bars(rows(stats, "languages").map((r) => ({ label: String(r.name), value: Number(r.n) }))),
    el("h3", undefined, "Devices"),
    bars(rows(stats, "devices").map((r) => ({ label: String(r.name), value: Number(r.n) }))),
    el("h3", undefined, "Links followed out"),
    bars(rows(stats, "links").map((r) => ({ label: String(r.name), value: Number(r.n) }))),
  );

  const arrivals = card("First view", "What each visit opened on: a shared link or today's world.");
  arrivals.append(bars(rows(stats, "arrivals").map((r) => ({ label: String(r.kind), value: Number(r.n) }))));

  const failed = Object.entries(stats).filter(([, v]) => v === null).map(([k]) => k);
  main.replaceChildren(tiles, visits, periods, travel, civCard, countryCard, features, lists, clicks, searches, audience, people, arrivals);
  if (failed.length) main.prepend(el("p", "notice", `Some counts could not be read (${failed.join(", ")}); see the Worker's logs.`));
}

let names: Promise<Names> | null = null;

async function show(days: number) {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-days]")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.days) === days));
  }
  main.setAttribute("aria-busy", "true");
  names ??= loadNames();
  try {
    const response = await fetch(new URL(`api/stats?days=${days}`, document.baseURI), { credentials: "same-origin" });
    const body = (await response.json().catch(() => ({}))) as Stats & { error?: string; missing?: string[]; problem?: string };
    if (response.status === 401) throw new Error(SIGN_IN[body.problem ?? ""] ?? SIGN_IN[""]);
    if (response.status === 503) throw new Error(`The Worker is missing these settings: ${(body.missing ?? []).join(", ")}. The README says how to set them.`);
    if (!response.ok) throw new Error(`The counts could not be read (${response.status}).`);
    render(body, await names);
  } catch (error) {
    main.replaceChildren(el("p", "notice", error instanceof Error ? error.message : String(error)));
  } finally {
    main.removeAttribute("aria-busy");
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-days]")) {
  button.addEventListener("click", () => void show(Number(button.dataset.days)));
}
void show(30);
