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
  years. With `Adds`, the realms that lose the land added (needed before
  1800, when two realms may both draw the same land).
- `Adds` (optional): `true` when the traced area is added to the realm's
  own shapes for those years instead of replacing them. Cliopatria draws the
  United States only where it had settled, so `united-states.geojson` adds the
  land it owned after each treaty or purchase (`Acquisition` names it), from
  the Treaty of Paris (1783) to the Alaska Purchase (1867), until 1889. A
  smaller realm still keeps land it holds in those years, such as the
  Confederate States in 1861-1865.
  `claimed-land.geojson` does the same for Mexico's north (1822 to 1853),
  Russian America (1799 to 1866) and the whole of Greenland (from 1921), and
  `british-dominions.geojson` for Australia before 1901 (`Claim` says what
  each feature adds). Added land counts towards the realm's area as measured
  on the sphere.
- `Removes` (optional): `true` with no outline takes the realm off the map
  for those years (`russian-backed-regions.geojson`); with an outline, it only
  takes that land off the realm, leaving it blank where no other realm has it.
- `KeepSmall` (optional): `true` keeps every part of the shape, however
  small. Parts under 300 km² are otherwise dropped (all but the largest), so
  `french-india.geojson` needs it for French India's trading posts.
  The realm also keeps its small parts when a smaller neighbour's land is cut
  out of it (Kiribati's atolls).
- `Area` (optional): the shape's area in km². Give it for a large shape far
  from the equator: worked out from the shape, it can be off by tens of
  percent.
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
`french-india.geojson` replaces Cliopatria's French India, which lumps the
French East India Company's islands (Réunion, Mauritius, the Comoros, parts of
Madagascar) in with its Indian posts and then loses the posts to the size cut:
it draws the five posts only in the years France held them (`Held` names
them each time), Pondicherry, Karikal and Yanam from today's Puducherry in
Natural Earth 1:10m, Mahé and Chandernagore as squares of their area around
the town, and moves Réunion and Mauritius to a realm of their own, the French
Mascarene Islands, with Cliopatria's outlines.
`united-states.geojson` is drawn from Natural Earth's 1:10m states (without the
large lakes) and rivers, public domain, cut along the treaty lines: the
Mississippi, the 1819 Adams-Onís line (the Sabine and Red rivers, 100°W, the
Arkansas River and 42°N), the Continental Divide (followed through its passes
and peaks, to within about 20 km), the Isle of Orleans and the Gila River.
`british-dominions.geojson` draws the dominions Cliopatria leaves inside the
British Empire until 1932 (Canada, South Africa), 1948 (New Zealand) or for
good (Newfoundland), from Natural Earth's 1:10m countries and provinces (without
the large lakes), public domain. Canada grows with each province or territory
that joined it (`Joins` names it): Ontario and Quebec are cut back to their
1867 limits along the Hudson Bay watershed, followed roughly (to within about
100 km). From 1949 it also takes in Newfoundland and Labrador, which Cliopatria
leaves British until 1957. South Africa takes in South West Africa (Namibia)
from 1920, as Cliopatria does from 1932. `claimed-land.geojson` reuses the
Texas, Mexican Cession, Gadsden Purchase and Alaska Purchase areas of
`united-states.geojson`, and Natural Earth's Greenland. Both files were made
with a script outside the repository from those sources.
`crimea.geojson` adds Crimea (the Autonomous Republic of Crimea and
Sevastopol) to Ukraine in 2024, the year Cliopatria moves it to Russia, so it is
drawn as Ukraine, its internationally recognised border (UN General Assembly
resolution 68/262), from 2014 to today. Until 2023 Cliopatria has it in both
realms, and the build already gives it to Ukraine (from 1800, land two realms
both draw goes to the smaller one). The outline is
Cliopatria's own (the part Russia gains in 2024), so it fits its neighbours
exactly. The other Ukrainian land Russia has occupied since 2022 is in Ukraine
in Cliopatria too.
`independent-states.geojson` draws states that Cliopatria leaves out for some
years and folds into a larger neighbour: allies, satellites and personal unions
drawn as if they were its own land, such as Czechoslovakia inside the USSR
from 1969 to 1990, South Vietnam inside the United States from 1967 to 1972,
Scotland inside England between the Union of the Crowns (1603) and the Acts
of Union (1707), or Saxony inside Poland-Lithuania while its electors were
kings of Poland. It also fills years Cliopatria leaves blank (Mexico
1913-1919, El Salvador 1979-1991) and keeps San Marino from 1631 to today.
Each feature's `Note` says why, and `Outline` which of Cliopatria's own
outlines of the realm it reuses (the nearest year it does draw it); San
Marino, which Cliopatria places as a square about 15 km off, is drawn from
today's border, by hand. Before 1800 the neighbour that held the land is
listed in `Clips`. An enclave such as San Marino can't be cut out of the realm
around it (shapes have no holes), so it is drawn over it, as Lesotho is.
`russia-ussr.geojson` fixes land Cliopatria draws as Russian (Muscovy, the
Tsardom, the Russian Empire, the USSR) in years it was not: states that kept
their own rulers under a Russian occupation or protectorate (Moldavia and
Wallachia during the occupations of 1769-1856, Bulgaria in 1878-1879, Romania
in 1917-1918, Bukhara and Khiva, Uryankhay and the Tuvan People's Republic
until 1944), land Russia had handed back or not yet taken (Livonia after 1582,
Courland and Polish Livonia in 1713-1733, Gilan and Baku after 1732, Adjara
until 1878, Kraków in 1915, the Turkmen lands until 1881-1884, the Pamirs
until 1895), occupations that left the country in place (the Ili valley in
1871-1884, Manchuria in 1900-1904 and 1946-1947, northern Iran in 1942-1946,
Afghanistan in 1979-1989, extended in `independent-states.geojson`), and the
Allied occupation zones, drawn as Germany (1945-1948), West Germany (1949),
Austria (1945-1946) and Korea (1946-1947) instead of their occupiers. Each
feature's `Note` or `Claim` says why and `Outline` which shape it reuses:
Cliopatria's own outline of the nearest year it draws the state right,
Natural Earth's Turkmenistan and Tajikistan (public domain) for the Turkmen
lands and the Pamirs, and a hand-traced Khorezm oasis for Khiva (to within
about 50 km). Occupations during a war are left as Cliopatria draws them, as
for other countries, and so are annexations: the Baltic states from 1940,
Finland (1809-1917) and Congress Poland (1815-1915), which were part of the
Russian Empire with their own institutions. Cliopatria's Bessarabia of
1812-1813 is in fact Moldavia west of the Prut, so it is taken off the map and
drawn as Moldavia. The file was made with a script outside the repository
from those sources.
`un-borders.geojson` draws today's borders as the UN recognises them, and
carries each fix back to the first year the border was the same. Syria is one
state from 1967 on, within its Natural Earth border plus the Golan Heights
(Cliopatria's "Mujahideen" realm of 2014 on, rebel-held Syria named after the
Afghan mujahideen, is taken off the map). Palestine is drawn on the 1967 lines
(the West Bank, East Jerusalem and Gaza) from 1967, in place of Israel and
Cliopatria's small "Gaza/Hamas" realm. Western Sahara is a realm of its own
from 1976, left out of the home globe's countries as a non-self-governing
territory. Northern Cyprus goes back to Cyprus (1976 on), Nagorno-Karabakh
and the districts around it to Azerbaijan (1992 on), and Cabinda to Angola
(Cliopatria draws it as Portugal's Estado Novo from 1979). Taiwan is the
"Taiwan (Republic of China)" realm from 1950, so the Republic of China ends
in 1949. UN members Cliopatria leaves out or misplaces are added: the Comoros
(drawn inside Cabo Verde, with Mayotte, which goes to France), Saint Kitts and
Nevis (placed on St Croix), Liechtenstein (1721 on, as a sovereign state from
1806), the Maldives, Samoa, Nauru, Tonga, Tuvalu, Kiribati and the Marshall
Islands; atolls are widened by about 1 km so they survive the 0.01° grid. The
Netherlands Antilles end in 2010, their islands going to the Netherlands.
Outlines are Natural Earth 1:10m countries and disputed areas (public domain),
or Cliopatria's own for Taiwan and the Antilles. Each feature's `Claim` says
why. The file was made with a script outside the repository.
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

The interface is in English, French and Spanish. The language is, in order: `?lang=fr`
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


## Versions

The site has a version number, x.y.z, written in one place: `version` in
`package.json`. The build puts it in the page (`src/version.ts`), where it
shows at the end of the About pop-up and goes with every report (with the
commit, e.g. `1.2.0 (abc1234)`) and the usage counts.

- **x** moves for a big milestone, such as a redesign (2.0.0).
- **y** moves for new features or new content (1.3.0).
- **z** moves for bug fixes only (1.3.1).

Releasing a version means, in the pull request that ships it (or in a small
one after several have been merged):

1. Set the new number in `package.json` and run `npm install` so
   `package-lock.json` follows.
2. Add an entry at the top of `src/changelog.json`: the version, the date
   (YYYY-MM-DD) and the changes, each written in English, French and Spanish
   (`en`, `fr`, `es`), with the numbers of the pull requests or issues it
   comes from in `links`. Write for visitors, not developers.
3. Run `npm run check`: it fails when the newest changelog entry isn't the
   version in `package.json`, when versions are out of order, or when a change
   has no English text.

Publishing a release removes the previous one's border windows and script
chunks, whose names carry a hash. A page left open across a release asks for
them and gets a 404: it then reloads itself (`src/newRelease.ts`), at most
once a minute, when the border index no longer names the missing window or
when Vite reports a missing chunk (`vite:preloadError`). The view is in the
address, so the visitor stays where they were.

Every entry shows on the versions page (`versions.html`, linked from the About
pop-up). Returning visitors also get a "What's new" card (`src/whatsNew.ts`)
listing the releases since their last visit, at most the last two, skipping
bug-fix releases (z only); first visits get the "New here?" prompt instead.
The browser remembers the last version shown in `terra-tempora:version-seen`,
and `terra-tempora:whats-new-off` when the visitor asked not to see the card
again.

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
| `src/contactKey.ts` | The public key that encrypts the email visitors leave with a report |
| `scripts/contact-key.mjs`, `scripts/read-contact.mjs` | Make that key pair; read an encrypted email from an issue |
| `worker/index.js` | The Cloudflare Worker: serves the site, files reports as GitHub issues, records and reads the usage counts |
| `src/analytics.ts` | The anonymous usage counts the page sends |
| `stats.html`, `src/stats.ts` | The private `/stats` page that shows them |
| `src/i18n.ts` | Languages: picks one, loads its text, fills in messages and translated data |
| `src/locales/` | Interface text, one file per language |
| `scripts/check-data.mjs` | Checks the data and translations (`npm run check`) |
| `src/colors.ts` | Highlight colours and the grey for other realms |

