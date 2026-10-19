import { eraAt, eraLabel, type Era } from "./eras";
import { t, withText } from "./i18n";

export interface Civilization {
  /** Stable id used in links, e.g. "mongol-empire". */
  id: string;
  name: string;
  /** Cliopatria realm names drawn as this civilization, e.g. "(British Empire)". */
  names: string[];
  wikidata: string | null;
  wikipedia: string | null;
  from: number;
  to: number;
  /** Year of the realm's largest extent. */
  peakYear: number;
  /** Largest extent in km². */
  area: number;
  /** [longitude, latitude] of the realm at its largest. */
  center: [number, number] | null;
  /** [longitude, latitude] in the land it held longest, which the camera frames it around. */
  home: [number, number] | null;
  /** Hand-picked group of realms that belong together, e.g. "mongol". */
  family: string | null;
}

/** Outlines at their largest, by civilization id, as rings of [x, y, …] in a 100 × 100 box. */
export type Outlines = Record<string, number[][]>;

/** The eras a civilization lived through, first and last. */
export function civEras(c: Civilization): [Era, Era] {
  return [eraAt(c.from), eraAt(c.to)];
}

export function civEraText(c: Civilization): string {
  const [first, last] = civEras(c);
  return first === last ? eraLabel(first) : t("era.span", { from: eraLabel(first), to: eraLabel(last) });
}

/** SVG path of an outline in its 100 × 100 box. */
export function shapePath(rings: number[][]): string {
  return rings
    .map((ring) => {
      let d = "";
      for (let i = 0; i < ring.length; i += 2) d += `${i ? "L" : "M"}${ring[i]} ${ring[i + 1]}`;
      return `${d}Z`;
    })
    .join("");
}

let outlinesLoading: Promise<Outlines> | undefined;

export class Civilizations {
  readonly list: Civilization[];
  private byId = new Map<string, Civilization>();
  private byRealm = new Map<string, Civilization>();
  private byWikidata = new Map<string, Civilization>();

  constructor(list: Civilization[]) {
    this.list = list;
    for (const c of list) {
      this.byId.set(c.id, c);
      for (const n of c.names) this.byRealm.set(n, c);
      // The largest realm wins when several share a Wikidata item; the list is sorted by area.
      if (c.wikidata && !this.byWikidata.has(c.wikidata)) this.byWikidata.set(c.wikidata, c);
    }
  }

  static async load(base: string): Promise<Civilizations> {
    const response = await fetch(new URL("civilizations.json", base));
    if (!response.ok) throw new Error(`Could not load the civilizations (${response.status})`);
    const json = (await response.json()) as { civilizations: Civilization[] };
    // Names in the reader's language; the realm names in `names` stay as in the border data.
    return new Civilizations(await withText(base, "civilizations.json", json.civilizations));
  }

  /**
   * The outlines, downloaded the first time they are asked for: only the
   * landing page's cards draw them, so a link straight to the globe skips them.
   */
  static outlines(base: string): Promise<Outlines> {
    outlinesLoading ??= fetch(new URL("civilization-shapes.json", base))
      .then((r) => (r.ok ? (r.json() as Promise<Outlines>) : {}))
      .catch((error: unknown) => (console.error(error), {}));
    return outlinesLoading;
  }

  get(id: string): Civilization | undefined {
    return this.byId.get(id);
  }

  /** The civilization a Cliopatria realm name belongs to. */
  ofRealm(name: string): Civilization | undefined {
    return this.byRealm.get(name);
  }

  /** A Cliopatria realm's name as shown, in the reader's language; "(Name)" marks overseas parts. */
  realmName(realm: string): string {
    const c = this.byRealm.get(realm);
    if (!c) return realm;
    return realm.startsWith("(") ? `(${c.name})` : c.name;
  }

  ofWikidata(qid: string): Civilization | undefined {
    return this.byWikidata.get(qid);
  }

  /** Members of the same hand-picked family, the civilization included. */
  family(c: Civilization): Civilization[] {
    return c.family ? this.list.filter((o) => o.family === c.family) : [c];
  }
}
