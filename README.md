# History Globe

Phase 0 prototype of the History Globe: a 3D globe that shows the Mongol Empire
and its successor khanates growing, splitting and fading between 1100 and 1500,
with the rest of the world's realms as quiet context.

## What it does

- CesiumJS globe with the Natural Earth II imagery bundled in CesiumJS, served
  from our own files. No Cesium ion account or token.
- 2,908 time-stamped border shapes from Cliopatria (1100 to 1500), 58 of them
  Mongol realms. Consecutive borders crossfade during playback.
- Year slider, play and pause, three speeds, and lanes showing each khanate's
  lifespan (tap a lane to jump to its first year).
- Tap or click a realm for its dates, area and Wikipedia and Wikidata links.
- Works on phones: the timeline stacks and the details card becomes a sheet.
- A link can open on a year: `#y1241`.

## Run it

```sh
npm install
# Download cliopatria.geojson.zip from
# https://github.com/Seshat-Global-History-Databank/cliopatria, unzip it, and
# point data-raw/cliopatria.geojson at the .geojson file inside.
npm run data      # builds public/data/polities.json (already committed)
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
```

`node scripts/make-artifact.mjs` turns `dist/` into the page and file list used
for the claude.ai preview.

## Layout

| Path | What it is |
| --- | --- |
| `scripts/build-data.mjs` | Filters Cliopatria to 1100 to 1500, simplifies borders, picks label points |
| `src/polityLayer.ts` | Builds and fades the border shapes and labels on the globe |
| `src/main.ts` | Globe setup, timeline, playback, details card |
| `src/years.ts` | Year formatting (negative years are BCE) |
| `src/colors.ts` | Khanate colours and context tones |

## Sources and licenses

- Borders: Cliopatria, Seshat Global History Databank, CC BY 4.0. Attribution is
  shown in the Sources panel.
- Imagery: Natural Earth II (public domain), as packaged with CesiumJS.
- CesiumJS: Apache 2.0. Build tools only: Vite (MIT), mapshaper (MPL 2.0),
  polylabel (ISC).
