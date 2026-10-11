# Terra Tempora

Prototype of Terra Tempora: pick a civilization from a landing page of
cards and see it on a 3D globe, highlighted with the realms related to it, set
in a timeline that runs from 10,000 BCE to today.

## What it does

- A landing page with a card for each of the 1,554 civilizations in the border
  data: a freely licensed picture on top (a photo of a monument, artwork or
  place, else its coat of arms or flag; maps are skipped), then its era, dates
  and one or two key figures, with the realm's outline at its largest drawn
  small in the corner. Search by name, filter by era, sort by age (oldest first
  by default), size or name.
- Every section on the landing page shows nine cards, then a "Show all …" card
  that lists the rest (and folds them back).
- Picking a card opens the globe on that civilization at its largest extent.
  It is coloured together with its related realms: the predecessors and
  successors Wikidata records, plus hand-picked families such as the Mongol
  khanates (`FAMILIES` in `scripts/build-civilizations.mjs`). Every other realm
  is grey; hovering one names it, clicking it makes it the highlighted one.
- Two sections at the top of the landing page, each with a card for each of
  the 183 present-day countries in the data (A to Z by default; search, or sort
  by size, oldest civilization or number of civilizations). Both are computed by `npm run countries` (`scripts/build-countries.mjs`).
  - "Countries" is about the land: a card centres the globe (or map) on the
    country, outlines today's border dashed, and shows every civilization whose
    borders ever crossed it, meaning the overlap was at least 3% of the
    country's present land or 10% of the civilization's own. Links look like
    `#t=france`.
  - "Nations" is about the nation: a card opens every civilization that
    led to the country, wherever it stood. A civilization belongs when it once
    covered at least a tenth of the country's present land, or when most of
    its own land lay inside it. France's lineage is hand-picked instead, to take
    in Rome from its start in Italy and the Franks from beyond the Rhine. Links
    look like `#k=france&y=470`.
- When many civilizations share the timeline, the lanes scroll.
- Key events of the Mongol Empire and its khanates (40 of them, from
  Temüjin's birth in 1162 to the fall of Dadu in 1368): battles, sieges,
  wars, rulers, deaths, capitals, travellers, a treaty and the plague at
  Caffa. Each shows as an icon on the globe and the map in its year, fading
  over the next eight, and as a mark on the timeline (crowded marks group
  into a number; tapping it zooms in). Tapping an icon or mark opens a panel
  with what happened, the place, the lead picture of its Wikipedia article
  (only when the file is on Wikimedia Commons, with author and licence), and
  links to Wikipedia, Britannica and World History Encyclopedia. The events
  are hand-written in `public/data/events.json`; places marked approximate
  are best guesses (a traditional site, or a court for a treaty agreed
  between several).
- Every other civilization gets its events from Wikidata, fetched ahead of
  time by `scripts/fetch-events.mjs` and saved in `public/data/wd-events/`
  (the app makes no live Wikidata query for them): the battles, sieges,
  wars, campaigns and treaties it took part in or signed, the births and
  deaths of its rulers and founders, and the founding of its capitals. Only
  events with an English Wikipedia article, a date within the realm's years
  and a place are kept (a war without a place stands at the realm's heart),
  the 24 best-known per realm, ranked by how many Wikipedia editions cover
  them. Treaties signed by much of the world are left out. A realm is looked
  up under both its Cliopatria item and its Wikipedia article's item, as
  the two sometimes differ. About half the realms have events this way; the
  rest have nothing usable on Wikidata. The panel shows the Wikidata
  description, or the article's opening paragraph when Wikipedia can be
  reached. To refresh the events, run the "Fetch Wikidata events" workflow
  from the Actions tab (tick "again" to fetch every realm, not only new
  ones), or `node scripts/fetch-events.mjs` where Wikidata is reachable.
- "History travel", at the top of the landing page and by the globe (links
  look like `#travel`), plays world history on its own, starting just before
  Göbekli Tepe (9500 BCE). As each of 141 turning points comes, the globe turns
  smoothly to put it in the middle, with its icon, a one-line summary and the
  realm it happened in lit up. Time cruises at the chosen speed, crosses long
  quiet stretches quickly, and slows down where turning points crowd together
  so each card can be read, then speeds back up. Hovering a card or its badge
  (or tapping it) stops time and opens the full story: the place, what
  happened, why it matters then and now, and links to Wikipedia, Britannica
  and World History Encyclopedia. The turning points were chosen for their
  impact on how civilizations developed, from every continent (farming in New
  Guinea and Mexico as well as the Fertile Crescent; Caral, the Olmec and
  Cahokia alongside Rome), and are written in `public/data/travel.json`.
- "Select several" on the landing page ticks cards instead of opening them;
  "Show on the globe" then highlights exactly the ticked civilizations, each in
  its own colour, with a lane each on the timeline. On the globe, "+ Add
  civilizations" in the timeline opens a searchable list: tick civilizations
  to add them, untick one already shown to remove it.
- Where Wikidata records a civilization before or after a highlighted one, its
  timeline lane has an arrow icon at that end. Hovering the icon names that
  civilization and its years; clicking it opens it. When that civilization
  has its own lane on the timeline, a red line joins the end of one lane to
  the start of the other instead. When the two overlap in time, the line
  drops straight down (or up) from the earlier lane at the moment the later
  one begins, so lines never loop back. Rows are arranged by lineage: a
  realm that follows its predecessor without overlapping continues on the
  same row (Mongol Empire, Yuan, Ming, Qing read along one line), and other
  realms sit in the row nearest their relatives.
- The row of event marks under the lanes can be made taller by dragging its
  top edge: the marks grow up to twice their size, then spread over more
  rows. Double-click the edge to reset; the size is remembered.

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
- Lanes showing the lifespan of each highlighted realm; tapping one flies the
  globe to that realm and centres it (moving the year into its lifetime if
  needed). When they are out of view the lanes fold into a pointer toward them.
- A button on the left tilts the globe to Earth's axial tilt (23.5°, North Pole
  to the right) or stands it upright again. The choice is remembered.
- A Globe / Map switch on the left turns the globe into a flat map of the same
  borders, with a choice of projection: Equal Earth, Mercator, Gall–Peters,
  Eckert IV, Robinson, Winkel tripel, Mollweide, Natural Earth, Miller and
  equirectangular. Drag sideways to spin the world, up and down to pan, and
  scroll or pinch to zoom. The map opens where the globe was looking, and the
  choice of view and projection is remembered in this browser.
- Drag the grip on the top edge of the timeline to make it taller (the lanes
  grow to fill it); double-click the grip to reset. The height is remembered.
- Play and pause at 2 to 500 years per second.
- Tap or click a realm for its dates, area and Wikipedia and Wikidata links.
- Works on phones: the timeline stacks and the details card becomes a sheet.
- Links open a civilization on a year: `#c=mongol-empire&y=1241`, or `y=-500`
  for 500 BCE. Several civilizations: `#c=roman-empire,han-dynasty&y=100`. An empty link opens the landing page; the older `#y1241` opens
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
The list (`civilizations.json`) carries no outlines: the landing page's card
outlines are in `civilization-shapes.json`, downloaded only once the landing
page shows, so a link straight to the globe skips them.

`npm run check` checks the data files and the translations (ids unique and
known, years and places in range, event kinds known, translations matching the
English). It runs on every pull request with the build
(`.github/workflows/check.yml`).

Pictures, key figures and the links between realms are read from Wikidata and
Wikimedia Commons in the browser as cards scroll into view, and cached in
`localStorage`. Where Wikimedia cannot be reached, cards show their era colour and initial instead of a picture, and
a civilization is highlighted with its hand-picked family alone.

`node scripts/make-artifact.mjs` turns `dist/` into the page and file list used
for the claude.ai preview.

## Languages

The interface is in English and French. The language is, in order: `?lang=fr`
in the address, the reader's earlier choice from the language menu (top right),
the browser's languages, then English.

- Interface text is in `src/locales/<code>.json`, one message per key. English
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
  `travel.json`, `countries.json` and `wd-events/<n>.json` (ids look like
  `wd:<Wikipedia article>:<kind>`). Civilization and realm names come from
  Cliopatria and are English for now.
- To add a language: copy `src/locales/en.json` to `<code>.json`, translate it,
  and add the language to `LANGUAGES` in `src/i18n.ts`.

## Hosting

The site is static: `npm run build` writes it to `dist/` (about 170 files,
33 MB, none over 2 MB), and every data file downloads only when needed. It is
served by Cloudflare Workers as static files (`wrangler.jsonc`), which costs
nothing on the free plan:

1. In Cloudflare, Workers & Pages → Create → Import a repository, and pick
   this repository.
2. Build command: `npm run build`. Deploy command: `npx wrangler deploy`.
   Node is read from `.node-version`.
3. Every push to `main` publishes the site; other branches get a preview
   address to test before publishing.

`public/_headers` sets how long browsers keep files: built scripts forever
(their names change with their content), data files an hour.

To require a review before anything is published, in GitHub's Settings →
Branches, add a rule for `main`: require a pull request with one approval,
require review from Code Owners (`.github/CODEOWNERS`), and require the
"Check" status to pass.

## Feedback

Visitors can report an error, missing data or an idea from the "Report a
problem" links (on a realm, an event, a turning point, the sources panel and
the landing page) or by right-clicking any spot on the globe or map. Each
report becomes a GitHub issue labelled `feedback` plus its type, with the
year, place, language and a link back to what the visitor was looking at.

`worker/index.js` receives the reports at `/api/feedback` and files them; it
limits each visitor to 5 reports a minute and ignores bots that fill a hidden
field. To turn it on, set its secrets with Wrangler from the project folder
(the dashboard may refuse, saying the Worker only has static assets):

1. `npx wrangler login`, then `npx wrangler secret put GITHUB_TOKEN` and paste
   a fine-grained GitHub token for this repository only, with "Issues: Read
   and write" permission. Deploys keep it; don't add it as a plain variable,
   which every deploy would wipe.
2. Optionally, against spam: create a Turnstile widget (Cloudflare →
   Turnstile) for the site's domain, `npx wrangler secret put TURNSTILE_SECRET`
   with its secret key, and add its site key as the build variable
   `VITE_TURNSTILE_SITE_KEY` (Settings → Build → Variables), then redeploy.

Branch previews don't get these secrets. Previews created after you set one
under Variables and Secrets → Previews Base get it; for an existing preview,
run `npx wrangler preview secret put GITHUB_TOKEN --name <branch>`.

Until `GITHUB_TOKEN` is set, sending a report shows an error. To try it
locally, run `npm run build` then `npx wrangler dev --var GITHUB_TOKEN:<token>`.

## Layout

| Path | What it is |
| --- | --- |
| `scripts/build-data.mjs` | Simplifies Cliopatria borders, picks label points, splits them into time windows |
| `scripts/build-civilizations.mjs` | One entry per civilization: dates, largest extent, outline, family |
| `src/landing.ts` | The landing page of civilization cards, with multi-select |
| `scripts/build-countries.mjs` | Countries of today and the civilizations that led to each, from the borders |
| `src/countries.ts` | Loads the countries |
| `public/data/events.json` | Key events with places, dates, summaries and sources |
| `src/events.ts` | Event kinds and icons, links and pictures for the panel |
| `src/eventLayer.ts` | Event icons on the globe |
| `src/travel.ts` | The history travel: pacing, camera turns, cards |
| `public/data/travel.json` | Its turning points, with places, dates, stories and sources |
| `src/wikiEvents.ts` | Loads the saved Wikidata events of every other civilization |
| `scripts/fetch-events.mjs` | Fetches those events from Wikidata (run by `.github/workflows/fetch-events.yml`) |
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
| `worker/index.js` | The Cloudflare Worker: serves the site and files reports as GitHub issues |
| `src/i18n.ts` | Languages: picks one, loads its text, fills in messages and translated data |
| `src/locales/` | Interface text, one file per language |
| `scripts/check-data.mjs` | Checks the data and translations (`npm run check`) |
| `src/colors.ts` | Highlight colours and the grey for other realms |

## Sources and licenses

- Borders: Cliopatria, Seshat Global History Databank, CC BY 4.0. Attribution is
  shown in the Sources panel.
- Key figures and links between realms: Wikidata, CC0.
- Card pictures: Wikimedia Commons, each under its own free licence; the card
  names the author and licence and links to the file page.
- Events: the Mongol ones written for this prototype from standard
  references, the rest from Wikidata (CC0) with Wikipedia's opening
  paragraphs (CC BY-SA). Event
  pictures come from Wikimedia Commons via the Wikipedia article, each under
  its own free licence, credited in the panel.
- Imagery: Natural Earth II (public domain), as packaged with CesiumJS.
- Map coastlines: Natural Earth 1:50m land (public domain), via the
  `world-atlas` package (ISC). Projections: `d3-geo` and `d3-geo-projection` (ISC).
- CesiumJS: Apache 2.0. Build tools only: Vite (MIT),
  polylabel (ISC).
