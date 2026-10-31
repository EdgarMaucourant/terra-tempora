// Anonymous usage counts, so the maintainers can see what visitors use: the
// buttons they press, the civilizations and countries they open, how far they
// follow the history travel and which periods they spend time on. Events go in
// small batches to the site's own Worker (POST /api/track), which files them
// in Cloudflare Analytics Engine; the private /stats page reads them back.
//
// Nothing identifies a visitor: no cookie, nothing stored in the browser, no
// visitor id and no IP address. Browsers that ask sites not to track them (Do
// Not Track, Global Privacy Control) send nothing, and neither do automated
// browsers or local development.

declare const __APP_VERSION__: string;

export type EventName =
  | "visit"
  | "feature"
  | "list"
  | "open"
  | "realm"
  | "event"
  | "search"
  | "link"
  | "period"
  | "travel"
  | "travel-pause"
  | "travel-card";

export interface TrackedEvent {
  /** What it is about: a feature, a civilization id, a turning point… */
  subject?: string;
  /** More about it: the kind of view, a value picked, why travel stopped… */
  detail?: string;
  /** How it was reached: "click", or "link" for a shared link. */
  via?: string;
  /** Ties together the events of one history travel; random, never stored. */
  session?: string;
  year?: number;
  /** Seconds, for time spent. */
  value?: number;
  count?: number;
}

interface Sent extends TrackedEvent {
  name: EventName;
  view: string;
}

// A page sends at most this many events, so a stuck loop can't flood the counts.
const MAX_EVENTS = 400;
const BATCH = 25;
const FLUSH_EVERY = 30_000;
// Seconds without a key press, click, scroll or touch after which time spent no
// longer counts, unless the history travel is playing.
const IDLE = 120;

const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
const enabled =
  !import.meta.env.DEV && !navigator.webdriver && navigator.doNotTrack !== "1" && privacy.globalPrivacyControl !== true;

let queue: Sent[] = [];
let sent = 0;
let flushTimer = 0;
let view = "globe";
const leaving: (() => void)[] = [];

/** Where the visitor came from: the ?ref= or ?utm_source= of a shared link, else the referring site. */
const source = (() => {
  const params = new URLSearchParams(location.search);
  const asked = params.get("ref") ?? params.get("utm_source");
  if (asked) {
    // Out of the address, so a link copied from here doesn't carry it on.
    for (const key of [...params.keys()]) if (key === "ref" || key.startsWith("utm_")) params.delete(key);
    const search = params.toString();
    try {
      history.replaceState(history.state, "", `${location.pathname}${search ? `?${search}` : ""}${location.hash}`);
    } catch {
      // Some embedded viewers refuse history changes.
    }
    return asked.toLowerCase().slice(0, 40);
  }
  try {
    const from = new URL(document.referrer);
    return from.origin === location.origin ? "direct" : from.hostname.replace(/^www\./, "");
  } catch {
    return "direct";
  }
})();

function device(): string {
  if (window.matchMedia("(max-width: 640px)").matches) return "phone";
  return window.matchMedia("(pointer: coarse)").matches ? "tablet" : "desktop";
}

/** The globe or the map, sent with each event from now on. */
export function setView(name: "globe" | "map") {
  view = name;
}

/** Counts something the visitor did. */
export function track(name: EventName, event: TrackedEvent = {}) {
  if (!enabled || sent + queue.length >= MAX_EVENTS) return;
  queue.push({ name, view, ...event });
  if (queue.length >= BATCH) flush(false);
  else if (!flushTimer) flushTimer = window.setTimeout(() => flush(false), FLUSH_EVERY);
}

/** Runs just before the last events are sent as the visitor leaves or hides the page. */
export function onLeave(run: () => void) {
  leaving.push(run);
}

function flush(final: boolean) {
  clearTimeout(flushTimer);
  flushTimer = 0;
  if (!queue.length) return;
  const body = JSON.stringify({
    lang: document.documentElement.lang || "en",
    device: device(),
    source,
    version: __APP_VERSION__,
    events: queue,
  });
  sent += queue.length;
  queue = [];
  const url = new URL("api/track", document.baseURI);
  // A beacon still goes out while the page closes.
  if (final && navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return;
  void fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}

// Time spent on each century, counted each second the page is seen and in use.
const periods = new Map<string, number>();
let lastInput = performance.now();

function sendPeriods() {
  for (const [key, seconds] of periods) {
    const [mode, century] = key.split("|");
    track("period", { subject: mode, year: Number(century), value: seconds });
  }
  periods.clear();
}

/**
 * Starts counting the time spent on each century of the timeline. `mode` names
 * what the visitor is doing ("home", "view", "travel"), or "" while there is
 * nothing to count; `playing` keeps the
 * count going without input while time plays by itself.
 */
export function watchTime(year: () => number, mode: () => string, playing: () => boolean) {
  if (!enabled) return;
  for (const type of ["pointerdown", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(type, () => (lastInput = performance.now()), { passive: true, capture: true });
  }
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (!playing() && performance.now() - lastInput > IDLE * 1000) return;
    const doing = mode();
    if (!doing) return;
    const key = `${doing}|${Math.floor(year() / 100) * 100}`;
    periods.set(key, (periods.get(key) ?? 0) + 1);
    // A long visit sends its time now and then rather than all at the end.
    if (periods.size > 40) sendPeriods();
  }, 1000);
}

// Searches typed in the lists, sent once the visitor stops typing.
const searchTimers = new Map<string, number>();

/** A search in one of the lists: its words are kept only when nothing matched, to show what is missing. */
export function searched(section: string, query: string, results: number) {
  clearTimeout(searchTimers.get(section));
  if (!query) return;
  searchTimers.set(
    section,
    window.setTimeout(() => {
      track("search", { subject: section, detail: results ? "" : query.slice(0, 40), count: results });
    }, 1500),
  );
}

/** A random key for one history travel, so its events can be read together; never stored. */
export function sessionKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Hiding the page (switching tabs, closing it, locking a phone) is the last
// moment a page can be sure to send anything.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  for (const run of leaving) run();
  sendPeriods();
  flush(true);
});
