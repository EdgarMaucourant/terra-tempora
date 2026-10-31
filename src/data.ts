import { NOW } from "./eras";

export interface Polity {
  id: number;
  name: string;
  /** First year this shape applies to, inclusive. */
  from: number;
  /** Last year this shape applies to, inclusive. */
  to: number;
  wikipedia: string | null;
  wikidata: string | null;
  /** Area in km². */
  area: number;
  /**
   * Groups the realm belongs to in these years, largest first: the Kingdom of
   * Spain is part of the Spanish Empire until 1931, Bohemia of the Holy Roman Empire.
   */
  groups?: string[];
  /** [longitude, latitude] of the label. */
  label: [number, number] | null;
  /** Outer rings as flat [lon, lat, lon, lat, …] arrays in degrees. */
  rings: number[][];
  /** Drawn from the coarse window: simpler rings, for the globe seen from afar. */
  coarse?: boolean;
}

/**
 * A shape's highlight colour: its group's, when that is highlighted, so an
 * empire shows in one colour with its homeland, or else its own realm's.
 */
export function highlightOf(colors: Map<string, string>, p: Polity): string | undefined {
  return p.groups?.map((g) => colors.get(g)).find((c) => c !== undefined) ?? colors.get(p.name);
}

/** A realm's first and last year. */
export interface Span {
  name: string;
  from: number;
  to: number;
}

interface DataWindow {
  from: number;
  to: number;
  /** The shapes in full detail. */
  file: string;
  /** The same shapes with simpler rings (about 22 km rather than 5). */
  coarse: string;
  count: number;
}

interface Index {
  source: string;
  from: number;
  to: number;
  windows: DataWindow[];
  /** Every realm's first and last year in the whole dataset. */
  realms: Record<string, [number, number]>;
}

/**
 * A window file: each distinct ring once, as delta-encoded integers of 0.01°,
 * and the shapes pointing at their rings by position (scripts/border-files.mjs).
 */
interface WindowFile {
  rings: number[][];
  shapes: (Omit<Polity, "rings"> & { rings: number[] })[];
}

/** Turns a delta-encoded ring of 0.01° steps back into degrees. */
function decodeRing(encoded: number[]): number[] {
  const out = new Array<number>(encoded.length);
  let x = 0;
  let y = 0;
  for (let i = 0; i < encoded.length; i += 2) {
    x += encoded[i];
    y += encoded[i + 1];
    out[i] = x / 100;
    out[i + 1] = y / 100;
  }
  return out;
}

/**
 * Border data split into time windows, downloaded only when a year needs them.
 * Borders still standing in the data's last year are taken to stand until now.
 * Windows come coarse until the view comes close (see showDetail), then in full.
 */
export class BorderData {
  private loaded = new Map<string, Promise<Polity[]>>();
  private detailed = false;
  /** Windows that arrived before anyone listened for them. */
  private arrived: Polity[][] = [];
  private listener: ((shapes: Polity[]) => void) | null = null;

  private constructor(
    private base: string,
    readonly index: Index,
  ) {}

  /**
   * Opens the border index. With a year, its window starts downloading as soon
   * as the index is in, while the rest of the page is still being set up.
   */
  static async open(base: string, year?: number): Promise<BorderData> {
    const response = await fetch(new URL("index.json", base));
    if (!response.ok) throw new Error(`Could not load the border index (${response.status})`);
    const data = new BorderData(base, await response.json());
    if (year !== undefined) data.load(year, year).catch(() => {});
    return data;
  }

  /**
   * Called with each window's shapes as it arrives, whoever asked for it;
   * windows that arrived before it was set are handed over at once.
   */
  set onShapes(listener: (shapes: Polity[]) => void) {
    this.listener = listener;
    for (const shapes of this.arrived.splice(0)) listener(shapes);
  }

  private arrive(shapes: Polity[]) {
    if (this.listener) this.listener(shapes);
    else this.arrived.push(shapes);
  }

  get from() {
    return this.index.from;
  }

  get to() {
    return Math.max(this.index.to, NOW);
  }

  realmSpan(name: string): [number, number] | undefined {
    const span = this.index.realms[name];
    return span && [span[0], this.until(span[1])];
  }

  /** A last year, carried on to now when it is the data's last year. */
  private until(to: number): number {
    return to >= this.index.to ? this.to : to;
  }

  /** True when every window covering these years has arrived. */
  hasYears(from: number, to: number): boolean {
    return this.windowsFor(from, to).every((w) => this.loaded.has(this.fileOf(w)));
  }

  /**
   * From now on, windows come in full detail; those already here in coarse
   * form are downloaded again in full, and replace them as they arrive.
   */
  showDetail() {
    if (this.detailed) return;
    this.detailed = true;
    for (const w of this.index.windows) {
      if (this.loaded.has(w.coarse)) this.loadWindow(w).catch((error: unknown) => console.error(error));
    }
  }

  private fileOf(w: DataWindow): string {
    return this.detailed ? w.file : w.coarse;
  }

  /** Downloads the windows covering these years; resolves with their shapes. */
  async load(from: number, to: number): Promise<Polity[]> {
    const shapes = await Promise.all(this.windowsFor(from, to).map((w) => this.loadWindow(w)));
    return shapes.flat();
  }

  private windowsFor(from: number, to: number): DataWindow[] {
    // Years after the data's end are drawn from its last window.
    const last = this.index.to;
    return this.index.windows.filter((w) => w.from <= Math.min(to, last) && w.to >= Math.min(from, last));
  }

  private loadWindow(w: DataWindow): Promise<Polity[]> {
    const file = this.fileOf(w);
    const coarse = !this.detailed;
    let pending = this.loaded.get(file);
    if (!pending) {
      pending = fetch(new URL(file, this.base))
        .then((r) => {
          if (!r.ok) throw new Error(`Could not load ${file} (${r.status})`);
          return r.json() as Promise<WindowFile>;
        })
        .then((data) => {
          // Shapes that share a ring share its decoded copy too.
          const rings = data.rings.map(decodeRing);
          return data.shapes.map((p) => ({ ...p, to: this.until(p.to), rings: p.rings.map((i) => rings[i]), coarse }));
        })
        .then((shapes) => (this.arrive(shapes), shapes));
      // A failed download can be retried on the next request.
      pending.catch(() => this.loaded.delete(file));
      this.loaded.set(file, pending);
    }
    return pending;
  }
}
