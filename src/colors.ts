// Fill colors for the featured khanates. Each successor state keeps a hue
// distinct from its neighbours on the map.
const FEATURED: Record<string, string> = {
  "Mongol Empire": "#e2742f",
  "Yuan Dynasty": "#d2483c",
  "Golden Horde": "#e6bc3f",
  Ilkhanate: "#3fa7a4",
  "Chagatai Khanate": "#8bb158",
  "Northern Yuan": "#b9655a",
  "Mongol Khanate": "#c98a5a",
  "Eastern Chagatai Khanate": "#6f9a48",
};

// Quiet tones for the rest of the world, picked per polity name so a realm
// keeps its tone from one snapshot to the next.
const CONTEXT = ["#8a95a3", "#9b9284", "#7f9a93", "#9a8a9a", "#8d9a7f", "#a0948c"];

export function featuredColor(name: string): string {
  return FEATURED[name] ?? "#e2742f";
}

export function contextColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return CONTEXT[Math.abs(hash) % CONTEXT.length];
}
