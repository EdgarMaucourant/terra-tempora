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
  /** Outer rings as flat [lon, lat, lon, lat, …] arrays. */
  rings: number[][];
}

export interface Dataset {
  source: string;
  from: number;
  to: number;
  polities: Polity[];
}

export async function loadDataset(url: string): Promise<Dataset> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return response.json();
}

/** Lifespan of each featured polity across all its shapes, in dataset order. */
export function featuredLifespans(polities: Polity[]): { name: string; from: number; to: number }[] {
  const spans = new Map<string, { name: string; from: number; to: number }>();
  for (const p of polities) {
    if (!p.featured) continue;
    const span = spans.get(p.name);
    if (!span) spans.set(p.name, { name: p.name, from: p.from, to: p.to });
    else {
      span.from = Math.min(span.from, p.from);
      span.to = Math.max(span.to, p.to);
    }
  }
  return [...spans.values()].sort((a, b) => a.from - b.from);
}
