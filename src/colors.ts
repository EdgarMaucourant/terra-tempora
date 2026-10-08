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

// Muted, distinct tones for the rest of the world, picked per polity name so a
// realm keeps its tone from one snapshot to the next. They stay darker than the
// khanate colours so they read on pale deserts and steppe as well as on forest.
const CONTEXT = ["#5b7fa6", "#8a5e8f", "#4f8f86", "#7f8248", "#9a614a", "#5d65a6", "#a05d72", "#5f8a58"];

export function featuredColor(name: string): string {
  return FEATURED[name] ?? "#e2742f";
}

export function contextColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return CONTEXT[Math.abs(hash) % CONTEXT.length];
}
