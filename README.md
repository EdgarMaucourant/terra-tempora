# History Globe

Prototype of the History Globe: a 3D globe that shows the Mongol Empire and its
successor khanates growing, splitting and fading, set in a timeline that runs
from 10,000 BCE to today with the rest of the world's realms as context.

## What it does

- CesiumJS globe with the Natural Earth II imagery bundled in CesiumJS, served
  from our own files. No Cesium ion account or token.
- 13,408 time-stamped border shapes from Cliopatria, 3400 BCE to 2024 CE, split
  into time windows that download only when the year needs them. Consecutive
  borders crossfade during playback.
- A zoomable timeline from 10,000 BCE to the current year: drag to pan, scroll
  or pinch to zoom, tap to jump, drag the playhead to scrub. "Mongol era" and
  "All history" reset the view.
- A band of the major eras of world history along the top of the timeline
  (prehistory, ancient, post-classical, early modern, late modern,
  contemporary). The boundaries are in `src/eras.ts`.
- Lanes showing each khanate's lifespan (tap a lane to jump to its first year);
  when they are out of view the lanes fold into a pointer toward them.
- Play and pause at 2 to 500 years per second.
- Tap or click a realm for its dates, area and Wikipedia and Wikidata links.
- Works on phones: the timeline stacks and the details card becomes a sheet.
- A link can open on a year: `#y1241`, or `#y-500` for 500 BCE.

## Run it

```sh
npm install
# Download cliopatria.geojson.zip from
# https://github.com/Seshat-Global-History-Databank/cliopatria, unzip it, and
# point data-raw/cliopatria.geojson at the .geojson file inside.
npm run data      # builds public/data/ (already committed)
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
```

`node scripts/make-artifact.mjs` turns `dist/` into the page and file list used
for the claude.ai preview.

## Layout

| Path | What it is |
| --- | --- |
| `scripts/build-data.mjs` | Simplifies Cliopatria borders, picks label points, splits them into time windows |
| `src/data.ts` | Downloads and decodes the time windows on demand |
| `src/polityLayer.ts` | Builds, fades and frees the border shapes and labels on the globe |
| `src/timeline.ts` | The zoomable time axis: eras, lanes, ticks, playhead and gestures |
| `src/eras.ts` | The eras of world history and their boundary years |
| `src/main.ts` | Globe setup, playback, details card |
| `src/years.ts` | Year formatting (negative years are BCE) |
| `src/colors.ts` | Khanate colours and context tones |

## Sources and licenses

- Borders: Cliopatria, Seshat Global History Databank, CC BY 4.0. Attribution is
  shown in the Sources panel.
- Imagery: Natural Earth II (public domain), as packaged with CesiumJS.
- CesiumJS: Apache 2.0. Build tools only: Vite (MIT), mapshaper (MPL 2.0),
  polylabel (ISC).
