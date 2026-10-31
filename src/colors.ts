// Fill colours for the highlighted realms. The chosen realm takes the accent;
// the realms related to it take hues distinct from it and from each other.
const ACCENT = "#e2742f";
const RELATED = ["#e6bc3f", "#3fa7a4", "#d2483c", "#8bb158", "#6d9fd8", "#b07cc6", "#c98a5a", "#6f9a48", "#d0668f", "#b9655a"];

// The Mongol khanates keep the colours they had in the first prototype, by civilization id.
const NAMED: Record<string, string> = {
  "mongol-empire": "#e2742f",
  "yuan-dynasty": "#d2483c",
  "golden-horde": "#e6bc3f",
  ilkhanate: "#3fa7a4",
  "chagatai-khanate": "#8bb158",
  "northern-yuan": "#b9655a",
  "mongol-khanate": "#c98a5a",
  "eastern-chagatai-khanate": "#6f9a48",
};

interface Realm {
  id: string;
  name: string;
}

/** Realms not related to the highlighted one are drawn in this grey. */
export const MUTED = "#5d636b";

/** Colours by name for a highlighted realm (first) and the realms related to it. */
export function highlightColors(chosen: Realm, related: Realm[]): Map<string, string> {
  const colors = new Map<string, string>();
  const named = chosen.id in NAMED;
  colors.set(chosen.name, named ? NAMED[chosen.id] : ACCENT);
  let i = 0;
  for (const r of related) {
    if (colors.has(r.name)) continue;
    colors.set(r.name, named && NAMED[r.id] ? NAMED[r.id] : RELATED[i++ % RELATED.length]);
  }
  return colors;
}

/**
 * Colours for the countries of today on the home view, told apart from their
 * neighbours. The first goes to the largest country (Russia), so it is a soft
 * clay rather than the accent: across that much land a strong colour shouts.
 */
export const TODAY_COLOURS = ["#b59782", "#3fa7a4", "#e6bc3f", "#6d9fd8", "#b07cc6", "#8bb158", "#d0668f", "#c98a5a"];
