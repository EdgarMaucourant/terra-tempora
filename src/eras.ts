// The broad periods of world history used along the top of the timeline.
// This is the division most world-history courses and references share:
// prehistory ends with the first writing, antiquity with the fall of the
// Western Roman Empire and the Gupta decline, the post-classical era (the
// Middle Ages in Europe) with the voyages of the 1490s, the early modern era
// with the age of revolutions, and the late modern era with the Second World
// War. Every boundary is a convention and varies by region.
import { t, type MessageKey } from "./i18n";

export interface Era {
  /** Names the era's messages: era.<id>.name, .short and .label. */
  id: string;
  from: number;
  to: number;
}

export const NOW = new Date().getFullYear();

export const ERAS: Era[] = [
  { id: "prehistory", from: -10000, to: -3200 },
  { id: "ancient", from: -3200, to: 500 },
  { id: "postclassical", from: 500, to: 1500 },
  { id: "earlyModern", from: 1500, to: 1800 },
  { id: "lateModern", from: 1800, to: 1945 },
  { id: "contemporary", from: 1945, to: NOW },
];

/** The era's full name, e.g. "Post-classical (Middle Ages)". */
export function eraName(e: Era): string {
  return t(`era.${e.id}.name` as MessageKey);
}

/** A shorter name for tight spaces on the timeline. */
export function eraShort(e: Era): string {
  return t(`era.${e.id}.short` as MessageKey);
}

/** The name on cards and filters, e.g. "Post-classical". */
export function eraLabel(e: Era): string {
  return t(`era.${e.id}.label` as MessageKey);
}

export function eraAt(year: number): Era {
  return ERAS.find((e) => year < e.to) ?? ERAS[ERAS.length - 1];
}
