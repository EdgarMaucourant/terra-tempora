# History Globe

Prototype of the History Globe: pick a civilization from a landing page of
cards and see it on a 3D globe, highlighted with the realms related to it, set
in a timeline that runs from 10,000 BCE to today.

## What it does

- A landing page with a card for each of the 1,554 civilizations in the border
  data: its era, dates, one or two key figures and a picture. Search by name,
  filter by era, sort by size, age or name. Cards without a picture show the
  realm's outline at its largest.
- Picking a card opens the globe on that civilization at its largest extent.
  It is coloured together with its related realms: the predecessors and
  successors Wikidata records, plus hand-picked families such as the Mongol
  khanates (`FAMILIES` in `scripts/build-civilizations.mjs`). Every other realm
  is grey; hovering one names it, clicking it makes it the highlighted one.

- CesiumJS globe with the Natural Earth II imagery bundled in CesiumJS, served
  from our own files. No Cesium ion account or token.
- 13,408 time-stamped border shapes from Cliopatria, 3400 BCE to 2024 CE, split
  into time windows that download only when the year needs them. Consecutive
  borders crossfade during playback.
- A zoomable timeline from 10,000 BCE to the current year: drag to pan, scroll
  or pinch to zoom, tap to jump, drag the playhead to scrub. "Current
  Civilization Era" and "All history" reset the view.
- A band of the major eras of world history along the top of the timeline
  (prehistory, ancient, post-classical, early modern, late modern,
  contemporary). The boundaries are in `src/eras.ts`.
- Lanes showing the lifespan of each highlighted realm (tap a lane to jump to
  its first year); when they are out of view the lanes fold into a pointer
  toward them.
- Drag the grip on the top edge of the timeline to make it taller (the lanes
  grow to fill it); double-click the grip to reset. The height is remembered.
- Play and pause at 2 to 500 years per second.
- Tap or click a realm for its dates, area and Wikipedia and Wikidata links.
- Works on phones: the timeline stacks and the details card becomes a sheet.
- Links open a civilization on a year: `#c=mongol-empire&y=1241`, or `y=-500`
  for 500 BCE. An empty link opens the landing page; the older `#y1241` opens
  the Mongol Empire.

## Run it

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
```

The border data in `public/data/` is already committed, so the app runs without
rebuilding it. `npm run data` rebuilds it: the first run downloads the
Cliopatria borders (about 46 MB, unzipped with `unzip`) into `data-raw/`.
`npm run civs` rebuilds only the civilization list from the border files.

Pictures, key figures and the links between realms are read from Wikidata and
Wikimedia Commons in the browser as cards scroll into view, and cached in
`localStorage`. Where Wikimedia cannot be reached, cards show outlines only and
a civilization is highlighted with its hand-picked family alone.

`node scripts/make-artifact.mjs` turns `dist/` into the page and file list used
for the claude.ai preview.

## Layout

| Path | What it is |
| --- | --- |
| `scripts/build-data.mjs` | Simplifies Cliopatria borders, picks label points, splits them into time windows |
| `scripts/build-civilizations.mjs` | One entry per civilization: dates, largest extent, outline, family |
| `src/landing.ts` | The landing page of civilization cards |
| `src/civilizations.ts` | Loads the civilization list; era labels and outlines |
| `src/wikidata.ts` | Pictures, key figures and predecessor/successor links from Wikimedia |
| `src/data.ts` | Downloads and decodes the time windows on demand |
| `src/polityLayer.ts` | Builds, fades and frees the border shapes and labels on the globe |
| `src/timeline.ts` | The zoomable time axis: eras, lanes, ticks, playhead and gestures |
| `src/timelineGrip.ts` | Resizing the timeline panel from its top edge |
| `src/eras.ts` | The eras of world history and their boundary years |
| `src/main.ts` | Links, globe setup, highlighting, hover and click, playback, details card |
| `src/years.ts` | Year formatting (negative years are BCE) |
| `src/colors.ts` | Highlight colours and the grey for other realms |

## Sources and licenses

- Borders: Cliopatria, Seshat Global History Databank, CC BY 4.0. Attribution is
  shown in the Sources panel.
- Key figures and links between realms: Wikidata, CC0.
- Card pictures: Wikimedia Commons, each under its own free licence; the card
  names the author and licence and links to the file page.
- Imagery: Natural Earth II (public domain), as packaged with CesiumJS.
- CesiumJS: Apache 2.0. Build tools only: Vite (MIT),
  polylabel (ISC).
