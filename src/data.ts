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
  /** Part of the featured subject (the Mongol Empire and its successors). */
  featured: boolean;
  /** [longitude, latitude] of the label. */
  label: [number, number] | null;
  /** Outer rings as flat [lon, lat, lon, lat, …] arrays in degrees. */
  rings: number[][];
}

export interface Span {
  name: string;
  from: number;
  to: number;
}

interface DataWindow {
  from: number;
  to: number;
  file: string;
  count: number;
}

interface Index {
  source: string;
  from: number;
  to: number;
  windows: DataWindow[];
  featured: Span[];
  /** Every realm's first and last year in the whole dataset. */
  realms: Record<string, [number, number]>;
}

/** Rings arrive as delta-encoded integers of 0.01°; turn them back into degrees. */
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

/** Border data split into time windows, downloaded only when a year needs them. */
export class BorderData {
  private loaded = new Map<string, Promise<Polity[]>>();

  private constructor(
    private base: string,
    readonly index: Index,
  ) {}

  static async open(base: string): Promise<BorderData> {
    const response = await fetch(new URL("index.json", base));
    if (!response.ok) throw new Error(`Could not load the border index (${response.status})`);
    return new BorderData(base, await response.json());
  }

  get from() {
    return this.index.from;
  }

  get to() {
    return this.index.to;
  }

  get featured(): Span[] {
    return this.index.featured;
  }

  realmSpan(name: string): [number, number] | undefined {
    return this.index.realms[name];
  }

  /** True when every window covering these years has arrived. */
  hasYears(from: number, to: number): boolean {
    return this.windowsFor(from, to).every((w) => this.loaded.has(w.file));
  }

  /** Downloads the windows covering these years; resolves with their shapes. */
  async load(from: number, to: number): Promise<Polity[]> {
    const shapes = await Promise.all(this.windowsFor(from, to).map((w) => this.loadWindow(w)));
    return shapes.flat();
  }

  private windowsFor(from: number, to: number): DataWindow[] {
    return this.index.windows.filter((w) => w.from <= to && w.to >= from);
  }

  private loadWindow(w: DataWindow): Promise<Polity[]> {
    let pending = this.loaded.get(w.file);
    if (!pending) {
      pending = fetch(new URL(w.file, this.base))
        .then((r) => {
          if (!r.ok) throw new Error(`Could not load ${w.file} (${r.status})`);
          return r.json() as Promise<(Omit<Polity, "rings"> & { rings: number[][] })[]>;
        })
        .then((list) => list.map((p) => ({ ...p, rings: p.rings.map(decodeRing) })));
      // A failed download can be retried on the next request.
      pending.catch(() => this.loaded.delete(w.file));
      this.loaded.set(w.file, pending);
    }
    return pending;
  }
}
