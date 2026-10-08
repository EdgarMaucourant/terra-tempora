// The broad periods of world history used along the top of the timeline.
// This is the division most world-history courses and references share:
// prehistory ends with the first writing, antiquity with the fall of the
// Western Roman Empire and the Gupta decline, the post-classical era (the
// Middle Ages in Europe) with the voyages of the 1490s, the early modern era
// with the age of revolutions, and the late modern era with the Second World
// War. Every boundary is a convention and varies by region.
export interface Era {
  name: string;
  /** Shorter name for tight spaces. */
  short: string;
  from: number;
  to: number;
}

export const NOW = new Date().getFullYear();

export const ERAS: Era[] = [
  { name: "Prehistory", short: "Prehistory", from: -10000, to: -3200 },
  { name: "Ancient history", short: "Ancient", from: -3200, to: 500 },
  { name: "Post-classical (Middle Ages)", short: "Post-classical", from: 500, to: 1500 },
  { name: "Early modern", short: "Early modern", from: 1500, to: 1800 },
  { name: "Late modern", short: "Late modern", from: 1800, to: 1945 },
  { name: "Contemporary", short: "Now", from: 1945, to: NOW },
];

export function eraAt(year: number): Era {
  return ERAS.find((e) => year < e.to) ?? ERAS[ERAS.length - 1];
}
