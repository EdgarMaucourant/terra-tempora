// Fill colours for the highlighted realms. The chosen realm takes the accent;
// the realms related to it take hues distinct from it and from each other.
const ACCENT = "#e2742f";
const RELATED = ["#e6bc3f", "#3fa7a4", "#d2483c", "#8bb158", "#6d9fd8", "#b07cc6", "#c98a5a", "#6f9a48", "#d0668f", "#b9655a"];

// The Mongol khanates keep the colours they had in the first prototype.
const NAMED: Record<string, string> = {
  "Mongol Empire": "#e2742f",
  "Yuan Dynasty": "#d2483c",
  "Golden Horde": "#e6bc3f",
  Ilkhanate: "#3fa7a4",
  "Chagatai Khanate": "#8bb158",
  "Northern Yuan": "#b9655a",
  "Mongol Khanate": "#c98a5a",
  "Eastern Chagatai Khanate": "#6f9a48",
};

/** Realms not related to the highlighted one are drawn in this grey. */
export const MUTED = "#5d636b";

/** Colours for a highlighted realm (first) and the realms related to it. */
export function highlightColors(chosen: string, related: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  const named = chosen in NAMED;
  colors.set(chosen, named ? NAMED[chosen] : ACCENT);
  let i = 0;
  for (const name of related) {
    if (colors.has(name)) continue;
    colors.set(name, named && NAMED[name] ? NAMED[name] : RELATED[i++ % RELATED.length]);
  }
  return colors;
}
