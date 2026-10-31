# Development

How to build Terra Tempora, rebuild its data, translate it, and find your way around the code. For deploying it, see [deployment.md](deployment.md).

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

## Border overrides

Each `scripts/border-overrides/*.geojson` file holds hand-traced borders that
`npm run data` puts in place of Cliopatria's. Each feature has these properties:

- `Name`, `FromYear`, `ToYear`: the realm, under its Cliopatria name, and the
  years the shape applies to (negative for BCE). Cliopatria's shapes of that
  name are cut out of those years.
- `Replaces` (optional): other realms whose shapes are cut out of those years
  as well, such as a kingdom it conquered or the dynasty it overthrew.
- `Clips` (optional): neighbours that only lose the traced area for those
  years.
- `Wikipedia`, `Wikidata`: the realm's English Wikipedia article and Wikidata
  item. Needed for a realm Cliopatria doesn't have; one it has keeps its own.
  Give a new realm its French name in `scripts/name-fixes.json` and
  `public/data/i18n/fr/civilizations.json` too, as Wikidata may not be
  reachable when the data is built.

A top-level `credit` names the source map, its author and licence; it is
copied into `index.json`, and should also go in the Sources panel
(`sources.list` in `src/locales/`, and `index.html`). `magadha.geojson` was
traced from the 11 frames of the animated map
[Magadha Expansion](https://commons.wikimedia.org/wiki/File:Magadha_Expansion_1.gif)
(CC BY-SA 4.0), georeferenced with 14 of the cities it marks; each feature's
`Frame` says which frame it comes from. The African files each come from one
map, named in their `credit`, and each feature's `Map` names the area traced:
`west-africa.geojson` from a map of West Africa at the end of the 18th century
(georeferenced with 16 of its towns and its coastline, to within about 20 km),
`southern-savanna.geojson` from the Library of Congress's map of the savanna
states around 1850 after Vansina (with the present-day border of the Congo it
draws, to within about 5 km), and `pre-colonial-africa.geojson` from a map of
pre-colonial African civilizations (with its coastline, to within about 10 km;
the map gives no dates and calls itself an artistic interpretation). A map of
one moment stands for a span of years: Mossi and Hausa borders of about 1790
are shown from 1500, for instance.
The list (`civilizations.json`) carries no outlines: the Civilizations popup's card
outlines are in `civilization-shapes.json`, downloaded only once the landing
page shows, so a link straight to the globe skips them.

`npm run check` checks the data files and the translations (ids unique and
known, years and places in range, event kinds known, links https, translations
matching the English, and markup only in the messages shown as markup, limited
to simple tags and https links). It runs on every pull request with the build
(`.github/workflows/check.yml`).

Pictures, key figures and the links between realms are read from Wikidata and
Wikimedia Commons in the browser as cards scroll into view, and cached in
`localStorage`. Where Wikimedia cannot be reached, cards show their era colour and initial instead of a picture, and
a civilization is highlighted with its hand-picked family alone.


## Languages

The interface is in English and French. The language is, in order: `?lang=fr`
in the address, the reader's earlier choice from the language menu (top right),
the browser's languages, then English.

- Interface text is in `src/locales/<code>.json`, grouped in sections that
  follow the parts of the page (see `src/locales/README.md`); the code names a
  message by its path, e.g. `home.panel.welcome`. English
  (`en.json`) is bundled; another language's file is downloaded only by readers
  using it. `{name}` marks a value filled in by the app; a message that depends
  on a number gives its plural forms (`"one"`, `"other"`, and `"few"` or
  `"many"` where the language has them). A key missing from a translation shows
  in English. Fixed text in `index.html` names its key with `data-i18n` (text),
  `data-i18n-html` (markup), `data-i18n-label`, `-title` or `-placeholder`.
- Data text (events, turning points, country names) stays in English in the
  data files. A translation is a file of the same name under
  `public/data/i18n/<code>/`, holding only the text by item id, for example
  `public/data/i18n/fr/events.json`:
  `{"temujin-born": {"title": "Naissance de Temüjin", "summary": "…"}}`.
  Untranslated items stay in English. Translatable: `events.json`,
  `travel.json`, `countries.json`, `civilizations.json` (names) and `wd-events/<n>.json` (ids look like
  `wd:<Wikipedia article>:<kind>`). The `wd-events` translations are not
  written by hand: `scripts/fetch-translations.mjs` reads them from Wikidata
  for every language in `src/locales/` (run by the "Fetch event translations"
  workflow; run it again after fetching new events). Wikipedia links and
  article extracts open the reader's language edition when there is one.
  Civilization names (`civilizations.json`, by id) are fetched the same way,
  from the item of each civilization's English Wikipedia article; realms that
  share an article, or names that would clash, keep their English name. Check
  them after a fetch: Cliopatria sometimes links a realm to a neighbouring
  article. To correct a name, edit the file; the next fetch overwrites it, so
  fix the Wikidata label too.
- To add a language: copy `src/locales/en.json` to `<code>.json`, translate it,
  add the language to `LANGUAGES` in `src/i18n.ts`, translate the data files
  above, and run the "Fetch event translations" workflow.


## Layout

| Path | What it is |
| --- | --- |
| `scripts/build-data.mjs` | Simplifies Cliopatria borders, puts the border overrides in, picks label points, splits them into time windows |
| `scripts/border-files.mjs` | Reads and writes the border window files: each distinct ring once, file names hashed so browsers keep them for good, and a coarse copy of each window |
| `scripts/border-overrides/` | Hand-traced borders that replace Cliopatria's where it is wrong |
| `scripts/build-civilizations.mjs` | One entry per civilization: dates, largest extent, outline, family. Years corrected by hand where the borders don't span the realm's history are in `scripts/date-fixes.json` |
| `src/landing.ts` | The Civilizations, Countries and Nations popups, with multi-select |
| `scripts/build-countries.mjs` | Countries of today and the civilizations that led to each, from the borders |
| `src/countries.ts` | Loads the countries |
| `public/data/events.json` | Key events with places, dates, summaries and sources |
| `src/events.ts` | Event kinds and icons, links and pictures for the panel |
| `src/eventLayer.ts` | Event icons on the globe |
| `src/travel.ts` | The history travel: pacing, camera turns, cards |
| `public/data/travel.json` | Its turning points, with places, dates, stories and sources |
| `src/wikiEvents.ts` | Loads the saved Wikidata events of every other civilization |
| `scripts/fetch-events.mjs` | Fetches those events from Wikidata (run by `.github/workflows/fetch-events.yml`) |
| `scripts/fetch-pictures.mjs` | Picks each civilization's fallback card picture from its Wikipedia article and checks it on Commons; saves `scripts/civ-pictures.json`. Picks corrected by hand go in `scripts/picture-fixes.json` |
| `src/picker.ts` | The list for adding civilizations to the globe and removing them |
| `src/civilizations.ts` | Loads the civilization list; era labels and outlines |
| `src/wikidata.ts` | Pictures, key figures and predecessor/successor links from Wikimedia |
| `src/data.ts` | Downloads and decodes the time windows on demand |
| `src/polityLayer.ts` | Builds, fades and frees the border shapes and labels on the globe |
| `src/timeline.ts` | The zoomable time axis: eras, lanes, ticks, playhead and gestures |
| `src/timelineGrip.ts` | Resizing the timeline panel from its top edge |
| `src/mapView.ts` | The flat map: projections, drawing, pan, zoom and hit testing |
| `src/eras.ts` | The eras of world history and their boundary years |
| `src/main.ts` | Links, globe setup, highlighting, hover and click, playback, details card |
| `src/years.ts` | Year formatting (negative years are BCE) |
| `src/feedback.ts` | The report form and what it sends |
| `src/contactKey.ts` | The public key that encrypts the email of visitors who offer to help |
| `scripts/contact-key.mjs`, `scripts/read-contact.mjs` | Make that key pair; read an encrypted email from an issue |
| `worker/index.js` | The Cloudflare Worker: serves the site, files reports as GitHub issues, records and reads the usage counts |
| `src/analytics.ts` | The anonymous usage counts the page sends |
| `stats.html`, `src/stats.ts` | The private `/stats` page that shows them |
| `src/i18n.ts` | Languages: picks one, loads its text, fills in messages and translated data |
| `src/locales/` | Interface text, one file per language |
| `scripts/check-data.mjs` | Checks the data and translations (`npm run check`) |
| `src/colors.ts` | Highlight colours and the grey for other realms |

