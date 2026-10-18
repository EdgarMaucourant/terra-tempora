// History travel: the globe plays through world history on its own. Time runs
// forward, and as each turning point comes the globe turns to put it in the
// middle of the screen, with a card telling what happened. Where turning points
// crowd together, time slows so each can be read; in long quiet stretches it
// speeds up. Hovering a card or its badge stops time and opens the full story.

import { Cartesian3, Ellipsoid, EllipsoidalOccluder, SceneTransforms, type Scene } from "cesium";
import { badgeSvg, eventArticle, eventLinks, KINDS, kindLabel, type HistoryEvent } from "./events";
import { t, withText } from "./i18n";
import { pictureCredit } from "./wikidata";
import { formatRange, formatYear } from "./years";

export interface TravelEvent extends HistoryEvent {
  /** The year is a scholarly estimate. */
  circa?: boolean;
  /** Part of the world, e.g. "Mesoamerica". */
  region: string;
  /** One or two lines for the card. */
  short: string;
  /** Why it mattered, then and now. */
  legacy: string;
}

export async function loadTravel(base: string): Promise<TravelEvent[]> {
  const response = await fetch(new URL("travel.json", base));
  if (!response.ok) throw new Error(`Could not load the history travel (${response.status})`);
  const { events } = (await response.json()) as { events: TravelEvent[] };
  const translated = await withText(base, "travel.json", events);
  return translated.map((e) => ({ ...e, civs: [] })).sort((a, b) => a.year - b.year);
}

export function travelWhen(e: TravelEvent): string {
  const when = e.to && e.to !== e.year ? formatRange(e.year, e.to) : formatYear(e.year);
  return e.circa ? t("travel.circa", { when }) : when;
}

export interface TravelHost {
  scene: Scene;
  /** Last year the travel runs to. */
  end: number;
  /** Moves the year on the readout, the borders and the timeline. */
  setYear(year: number): void;
  /** Cruising speed in years per second, as picked in the speed menu. */
  baseSpeed(): number;
  /** Badge opacity for each event; events left out are hidden. */
  showBadges(opacity: Map<TravelEvent, number>): void;
  /** The events on screen, newest first, to light up the realms they happened in. */
  showRealms(events: TravelEvent[]): void;
  onPlaying(on: boolean): void;
  /** Camera orientation, upright or tilted. */
  orientation(): { heading: number; pitch: number; roll: number };
  /** The point in the middle of the screen, [lon, lat]. */
  centre(): [number, number];
  /** Degrees to set the camera south of its target, so the target sits higher on small screens. */
  latOffset: number;
  /** Phones: the open card docks above the timeline instead of beside its badge. */
  narrow: boolean;
  /** Opens the report form about a turning point. */
  report(e: TravelEvent): void;
}

// Seconds before a turning point that the globe starts to turn towards it.
const LEAD = 1.6;
// Long empty stretches are crossed in about this many seconds.
const CROSSING = 3.5;
// Seconds a card stays as a small label after the next turning point arrives.
const LABEL_TIME = 7;
// Past turning points keep a faint badge until this many newer ones have come.
const KEEP = 10;
// Stiffness of the camera's spring (per second).
const OMEGA = 3;
// Badges float this high, as in the event layer.
const BADGE_HEIGHT = 40_000;

type Vec = [number, number, number];
const RAD = Math.PI / 180;
const toVec = ([lon, lat]: [number, number]): Vec => [
  Math.cos(lat * RAD) * Math.cos(lon * RAD),
  Math.cos(lat * RAD) * Math.sin(lon * RAD),
  Math.sin(lat * RAD),
];
const toLonLat = ([x, y, z]: Vec): [number, number] => [Math.atan2(y, x) / RAD, Math.asin(Math.max(-1, Math.min(1, z))) / RAD];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): Vec => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

interface Arrival {
  e: TravelEvent;
  /** Travel clock when it arrived. */
  at: number;
  /** Seconds it needs on screen to be read. */
  read: number;
}

/** The travel starts here, so the first turning point comes within seconds. */
const TRAVEL_START = -9550;

export class Travel {
  active = false;
  playing = false;
  year = 0;
  /** Years per second, eased. */
  speed = 0;
  /** Index of the next turning point to arrive. */
  private next = 0;
  /** Seconds of travel played, not counting pauses. */
  private clock = 0;
  /** Clock time when the latest card will have been read. */
  private readUntil = 0;
  private arrivals: Arrival[] = [];
  private cards = new Map<TravelEvent, HTMLElement>();
  /** Hovered card or badge, and the card held open by a tap or click. */
  private hoverCard: TravelEvent | null = null;
  private hoverBadge: TravelEvent | null = null;
  private pinned: TravelEvent | null = null;
  private opened: TravelEvent | null = null;
  private resumeTimer = 0;
  /** Invites the reader to press Play again after a drag stopped time. */
  private toast: HTMLElement;
  /** How visible each badge is now, so faint or hidden ones can't be touched. */
  private badgeOpacity = new Map<TravelEvent, number>();
  private frame = 0;
  private last = 0;
  // Camera: the point it looks at (P) eases on a spring after a guide (F)
  // that runs along the great circle to the target (T) at a steady pace.
  private steering = false;
  private P: Vec = [1, 0, 0];
  private V: Vec = [0, 0, 0];
  private F: Vec = [1, 0, 0];
  private T: Vec | null = null;
  private guideRate = 1;
  private occluder = new EllipsoidalOccluder(Ellipsoid.WGS84, Cartesian3.ZERO);

  constructor(
    readonly events: TravelEvent[],
    private host: TravelHost,
    private overlay: HTMLElement,
  ) {
    this.toast = document.createElement("div");
    this.toast.className = "travel-toast";
    this.toast.setAttribute("role", "status");
    this.toast.hidden = true;
    const toastText = document.createElement("span");
    const toastClose = document.createElement("button");
    toastClose.type = "button";
    toastClose.className = "travel-toast-close";
    toastClose.textContent = "×";
    toastClose.addEventListener("click", () => this.showToast(false));
    this.toast.append(toastText, toastClose);
    overlay.append(this.toast);

    // Dragging the globe hands the camera to the reader and stops time; Play
    // carries on. A press without a drag (a tap on a badge) does neither.
    const canvas = host.scene.canvas;
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener("pointerdown", (e) => {
      down = this.active ? { x: e.clientX, y: e.clientY } : null;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) return;
      down = null;
      this.steering = false;
      if (!this.playing) return;
      this.setPlaying(false);
      this.showToast(true);
    });
    window.addEventListener("pointerup", () => (down = null));
  }

  /** Where the travel begins: shortly before the first turning point (Göbekli Tepe). */
  private get startYear(): number {
    return Math.min(TRAVEL_START, this.events[0].year - 50);
  }

  /** Starts shortly before the first turning point, or at `year`. */
  start(year?: number) {
    this.active = true;
    this.overlay.hidden = false;
    this.seek(year ?? this.startYear);
    this.setPlaying(true);
    this.last = 0;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.setPlaying(false);
    this.showToast(false);
    cancelAnimationFrame(this.frame);
    this.clearCards();
    this.overlay.hidden = true;
  }

  /** Jumps to a year: turning points from there on are still to come. */
  seek(year: number) {
    this.year = Math.min(this.host.end, year);
    this.next = this.events.findIndex((e) => e.year >= this.year);
    if (this.next < 0) this.next = this.events.length;
    this.arrivals = [];
    this.readUntil = this.clock;
    this.speed = 0;
    this.pinned = this.hoverCard = this.hoverBadge = null;
    this.clearCards();
    this.host.setYear(this.year);
    this.host.showRealms([]);
    this.badgeOpacity = new Map();
    this.host.showBadges(new Map());
  }

  /**
   * Jumps to a turning point and stops there with its card open, as a click on
   * its badge does; "Close" or Play carries on from it.
   */
  seekTo(e: TravelEvent) {
    this.seek(e.year);
    this.next = this.events.indexOf(e) + 1;
    this.arrive(e);
    this.refresh();
    this.pin(e);
  }

  /** Time is moving: playing, and no card is held open. */
  get running(): boolean {
    return this.playing && !this.opened;
  }

  setPlaying(on: boolean) {
    if (on && this.year >= this.host.end - 0.01) this.seek(this.startYear);
    this.playing = on;
    if (on) {
      this.showToast(false);
      // Play closes any card held open and lets time run again.
      clearTimeout(this.resumeTimer);
      this.pinned = this.hoverCard = this.hoverBadge = null;
      this.open(null);
    }
    this.host.onPlaying(this.running);
  }

  /** Shows the invitation to resume (until Play or ×), or hides it. */
  private showToast(on: boolean) {
    if (on) {
      const [text, close] = this.toast.children as unknown as [HTMLElement, HTMLElement];
      text.textContent = t("travel.paused");
      close.setAttribute("aria-label", t("travel.close"));
    }
    this.toast.hidden = !on;
  }

  /** The pointer is over a badge on the globe, or left it (null). */
  hoverOnBadge(e: TravelEvent | null) {
    if (e && !this.touchable(e)) e = null;
    if (e === this.hoverBadge) return;
    this.hoverBadge = e;
    this.hoverChanged();
  }

  /** A tap or click on a badge holds its card open until "Close". */
  pin(e: TravelEvent) {
    if (!this.touchable(e)) return;
    this.pinned = e;
    this.hoverChanged();
  }

  /**
   * A badge only stops time when it can be seen: faded in, and on this side of
   * the globe. Picking goes by screen position, so a badge behind the globe or
   * still invisible could otherwise catch the pointer.
   */
  private touchable(e: TravelEvent): boolean {
    if ((this.badgeOpacity.get(e) ?? 0) < 0.3) return false;
    this.occluder.cameraPosition = this.host.scene.camera.positionWC;
    return this.occluder.isPointVisible(Cartesian3.fromDegrees(e.lonLat[0], e.lonLat[1], BADGE_HEIGHT));
  }

  /** Lets time run again after a card was held open. */
  release() {
    this.pinned = this.hoverCard = this.hoverBadge = null;
    this.hoverChanged();
  }

  /** Time stands still while a card is open. */
  private get held(): boolean {
    return !!this.opened;
  }

  private hoverChanged() {
    clearTimeout(this.resumeTimer);
    const wanted = this.pinned ?? this.hoverCard ?? this.hoverBadge;
    if (wanted) return this.open(wanted);
    // A short grace lets the pointer cross from a badge to its card.
    this.resumeTimer = window.setTimeout(() => this.open(null), 350);
  }

  private open(e: TravelEvent | null) {
    if (this.opened === e) return;
    const was = this.opened;
    this.opened = e;
    if (was) this.cards.get(was)?.classList.remove("open");
    // The play button shows time as stopped while a card is open.
    this.host.onPlaying(this.running);
    if (e) this.cardFor(e).classList.add("open");
    // Time stands still while a card is open, so the labels are set here too:
    // an open card that kept its label styling would be squeezed into a pill.
    this.relabel();
    if (!e) return;
    const card = this.cards.get(e)!;
    this.fillDetails(e, card);
  }

  private readTime(e: TravelEvent): number {
    // Faster speeds give a little less time per card, slower ones a little more.
    const factor = Math.min(1.3, Math.max(0.5, Math.sqrt(25 / this.host.baseSpeed())));
    return (2.6 + e.short.length / 30) * factor;
  }

  /** Turns the globe towards a turning point, unless it is already on its way there. */
  private aim(e: TravelEvent) {
    const target = toVec(e.lonLat);
    const goal = this.T ?? (this.steering ? this.P : null);
    if (goal && dot(goal, target) > 1 - 1e-9) return;
    if (!this.steering || !this.T) {
      // Start from wherever the camera is now: the reader may have moved it.
      const [lon, lat] = this.host.centre();
      this.P = toVec([lon, lat + this.host.latOffset]);
      this.F = this.P;
      this.V = [0, 0, 0];
      this.steering = true;
    }
    this.T = target;
    // Short turns ease gently; long ones go faster so none takes much more than two seconds.
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(this.F, target))));
    this.guideRate = Math.max(0.35, angle / 1.7);
  }

  private tick(now: number) {
    if (!this.active) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.playing && !this.held) this.advance(dt);
    this.steer(dt);
    this.place();
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  private advance(dt: number) {
    this.clock += dt;
    const base = this.host.baseSpeed();
    const upcoming = this.events[this.next];
    const left = this.readUntil - this.clock;
    let target = base;
    if (upcoming) {
      const gap = Math.max(0, upcoming.year - this.year);
      // While a card is being read, arrive at the next one just as reading ends;
      // otherwise cruise, crossing long quiet stretches quickly.
      target = left > 0 ? Math.min(base, gap / left) : Math.max(base, gap / CROSSING);
      const eta = Math.max(left, gap / Math.max(this.speed, 1e-3));
      if (eta < LEAD) this.aim(upcoming);
    }
    // Slow down briskly, speed up gently.
    const tau = target < this.speed ? 0.3 : 1.1;
    this.speed += (target - this.speed) * (1 - Math.exp(-dt / tau));
    this.year = Math.min(this.host.end, this.year + this.speed * dt);
    // One arrival at a time, and only once the card before it has been read.
    const e = this.events[this.next];
    if (e && this.year >= e.year && this.clock >= this.readUntil - 0.05) {
      this.next++;
      this.arrive(e);
    }
    this.host.setYear(this.year);
    if (this.year >= this.host.end && this.next >= this.events.length && this.clock >= this.readUntil) {
      this.setPlaying(false);
    }
    this.refresh();
  }

  private arrive(e: TravelEvent) {
    const read = this.readTime(e);
    this.arrivals.unshift({ e, at: this.clock, read });
    this.readUntil = this.clock + read;
    this.aim(e);
    const card = this.cardFor(e);
    // Restart the entrance animation.
    card.classList.remove("enter");
    void card.offsetWidth;
    card.classList.add("enter");
  }

  /** Cards, labels, badges and lit realms for the current moment. */
  private refresh() {
    const keep = new Set<TravelEvent>();
    const badges = new Map<TravelEvent, number>();
    const onScreen: TravelEvent[] = [];
    this.arrivals.forEach((a, i) => {
      const age = this.clock - a.at;
      const labelled = i === 0 || age < a.read + LABEL_TIME;
      if (i < KEEP) badges.set(a.e, labelled ? 1 : 0.45);
      if (labelled) {
        keep.add(a.e);
        onScreen.push(a.e);
      }
    });
    this.arrivals.length = Math.min(this.arrivals.length, KEEP);
    if (this.opened) {
      keep.add(this.opened);
      badges.set(this.opened, 1);
    }
    for (const [e, card] of this.cards) {
      if (!keep.has(e)) {
        card.remove();
        this.cards.delete(e);
      }
    }
    this.relabel();
    this.badgeOpacity = badges;
    this.host.showBadges(badges);
    this.host.showRealms(onScreen);
  }

  private steer(dt: number) {
    if (!this.steering || !this.T || dt === 0) return;
    // The guide runs along the great circle towards the target.
    const T = this.T;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(this.F, T))));
    const step = this.guideRate * dt;
    if (angle <= step) this.F = T;
    else {
      let axis = cross(this.F, T);
      if (Math.hypot(...axis) < 1e-9) axis = cross(this.F, Math.abs(this.F[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]);
      axis = norm(axis);
      const k = cross(axis, this.F);
      const c = Math.cos(step);
      const s = Math.sin(step);
      this.F = norm([this.F[0] * c + k[0] * s, this.F[1] * c + k[1] * s, this.F[2] * c + k[2] * s]);
    }
    // The camera's point follows the guide on a critically damped spring.
    const w2 = OMEGA * OMEGA;
    const a: Vec = [0, 1, 2].map((i) => w2 * (this.F[i] - this.P[i]) - 2 * OMEGA * this.V[i]) as Vec;
    this.V = this.V.map((v, i) => v + a[i] * dt) as Vec;
    let P = norm(this.P.map((p, i) => p + this.V[i] * dt) as Vec);
    // Keep the velocity along the surface.
    const radial = dot(this.V, P);
    this.V = this.V.map((v, i) => v - radial * P[i]) as Vec;
    this.P = P;
    const settled = this.F === T && dot(P, T) > 1 - 1e-10 && Math.hypot(...this.V) < 1e-5;
    if (settled) {
      P = this.P = T;
      this.T = null;
    }
    const camera = this.host.scene.camera;
    const [lon, lat] = toLonLat(P);
    camera.setView({
      destination: Cartesian3.fromDegrees(lon, lat - this.host.latOffset, camera.positionCartographic.height),
      orientation: this.host.orientation(),
    });
    this.host.scene.requestRender();
  }

  /** Puts each card beside its badge, and hides those on the far side of the globe. */
  private place() {
    if (!this.cards.size) return;
    const scene = this.host.scene;
    this.occluder.cameraPosition = scene.camera.positionWC;
    const width = window.innerWidth;
    const bottom = window.innerHeight - (document.querySelector("footer")?.offsetHeight ?? 0) - 12;
    for (const [e, card] of this.cards) {
      const docked = this.host.narrow && !card.classList.contains("label");
      card.classList.toggle("docked", docked);
      if (docked) {
        card.style.transform = "";
        card.hidden = false;
        continue;
      }
      const position = Cartesian3.fromDegrees(e.lonLat[0], e.lonLat[1], BADGE_HEIGHT);
      const point = this.occluder.isPointVisible(position)
        ? SceneTransforms.worldToWindowCoordinates(scene, position)
        : undefined;
      card.hidden = !point;
      if (!point) continue;
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      const right = point.x + 22 + w <= width - 12 || point.x < width / 2;
      const x = right ? point.x + 22 : point.x - 22 - w;
      const y = Math.max(12, Math.min(bottom - h, point.y - Math.min(h / 2, 34)));
      card.classList.toggle("left", !right);
      card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }

  /** The latest card and the open one show in full; the others shrink to labels. */
  private relabel() {
    const focus = this.arrivals[0]?.e;
    for (const [e, card] of this.cards) card.classList.toggle("label", e !== focus && e !== this.opened);
  }

  private clearCards() {
    for (const card of this.cards.values()) card.remove();
    this.cards.clear();
    this.opened = null;
  }

  private cardFor(e: TravelEvent): HTMLElement {
    let card = this.cards.get(e);
    if (card) return card;
    card = el("article", "travel-card");
    card.style.setProperty("--kind", KINDS[e.kind].color);
    const head = el("header", "travel-head");
    const badge = el("span", "travel-badge");
    badge.innerHTML = badgeSvg(e.kind, 30);
    const meta = el("p", "travel-meta", `${kindLabel(e.kind)} · ${e.region}`);
    const when = el("p", "travel-when", travelWhen(e));
    const text = el("div", "travel-text");
    text.append(meta, el("h3", "travel-title", e.title), when);
    head.append(badge, text);
    const short = el("p", "travel-short", e.short);
    const hint = el("p", "travel-hint", t("travel.hint"));
    const more = el("div", "travel-more");
    card.append(head, short, hint, more);
    card.addEventListener("pointerenter", (ev) => {
      if (ev.pointerType !== "mouse") return;
      this.hoverCard = e;
      this.hoverChanged();
    });
    card.addEventListener("pointerleave", (ev) => {
      if (ev.pointerType !== "mouse" || this.hoverCard !== e) return;
      this.hoverCard = null;
      this.hoverChanged();
    });
    card.addEventListener("click", (ev) => {
      if ((ev.target as HTMLElement).closest("a, button")) return;
      if (this.pinned !== e) this.pin(e);
    });
    this.overlay.append(card);
    this.cards.set(e, card);
    return card;
  }

  /** The full story: place, what happened, why it matters, a picture and further reading. */
  private fillDetails(e: TravelEvent, card: HTMLElement) {
    const more = card.querySelector<HTMLElement>(".travel-more")!;
    if (more.childElementCount) return;
    const where = typeof e.approx === "string" ? e.approx : e.approx ? t("travel.approximate", { place: e.place }) : e.place;
    const figure = el("figure", "travel-figure");
    figure.hidden = true;
    const links = el("ul", "travel-links");
    for (const l of eventLinks(e)) {
      const item = el("li");
      item.append(Object.assign(el("a", undefined, l.label), { href: l.url, target: "_blank", rel: "noopener" }));
      if (l.note) item.append(el("small", undefined, l.note));
      links.append(item);
    }
    // Closing the card lets time run on.
    const resume = el("button", "travel-resume", t("travel.close"));
    resume.type = "button";
    resume.addEventListener("click", () => this.setPlaying(true));
    const report = el("button", "report-link", t("feedback.link"));
    report.type = "button";
    report.addEventListener("click", () => {
      // The card stays open while the form is.
      this.pin(e);
      this.host.report(e);
    });
    more.append(
      el("p", "travel-place", where),
      figure,
      el("p", "travel-summary", e.summary),
      el("h4", undefined, t("travel.whyItMatters")),
      el("p", "travel-legacy", e.legacy),
      el("h4", undefined, t("event.learnMore")),
      links,
      report,
      resume,
    );
    // The lead picture of its Wikipedia article, when Wikipedia can be reached.
    eventArticle(e).then((article) => {
      // The first link is the Wikipedia article; point it at the reader's language.
      if (article) links.querySelector("a")!.href = article.url;
      const picture = article?.picture;
      if (!picture) return;
      const image = Object.assign(el("img"), { alt: "", decoding: "async" as const, src: picture.thumb });
      const credit = Object.assign(el("a", undefined, pictureCredit(picture)), {
        href: picture.page,
        target: "_blank",
        rel: "noopener",
      });
      const caption = el("figcaption");
      caption.append(credit);
      figure.append(image, caption);
      image.onload = () => (figure.hidden = false);
    });
  }
}
