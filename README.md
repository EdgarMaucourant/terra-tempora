# Terra Tempora

Explore world history on a 3D globe. Pick a civilization, a country or a year
and see the realms of that time drawn on the globe or a flat map, with a
timeline that runs from 10,000 BCE to today.

**Live site: [terra-tempora.com](https://terra-tempora.com)**

## What it does

- Shows the borders of 1,560 civilizations, from 3400 BCE to 2024, on a globe
  or on a map in ten projections.
- Opens a civilization at its largest extent, coloured together with its
  predecessors and successors, each with its own lane on the timeline.
- Lists the 184 present-day countries, either by the land ("Countries") or by
  the civilizations that led to the nation ("Nations").
- Places key events (battles, treaties, rulers, capitals) on the globe and the
  timeline, with pictures and links to Wikipedia, Britannica and World History
  Encyclopedia.
- Plays a "history travel" through 141 turning points, from Göbekli Tepe to
  today, turning the globe to each one.
- Plays time at 2 to 500 years a second, works on phones, and is available in
  English, French and Spanish.

Links open a view directly, for example `#c=mongol-empire&y=1241` (use a
negative year for BCE).

## Run it locally

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
npm run check     # checks the data files and translations
```

The border data in `public/data/` is committed, so nothing else is needed.
To rebuild the data, translate the interface, or find your way around the
code, see [docs/development.md](docs/development.md). Hosting and the
Cloudflare Worker setup are in [docs/deployment.md](docs/deployment.md).

## Use the borders elsewhere

The site loads its borders in a compact format of its own (`public/data/borders-*.json`).
To get them as GeoJSON, for QGIS, a web map or your own project:

```sh
npm install
npm run geojson -- 1914            # the map of 1914, as on 31 December: borders-1914.geojson
npm run geojson                    # every year: borders-all.geojson, one feature per realm and run of years
npm run geojson -- 1914 my.geojson # to another file
```

Each feature carries the realm's `name`, the years it covers (`from` and `to`, both
included), its `kind` when it isn't a realm's own land (`hatch` for land held or run by
another state, `group` for a group of territories, `blank` for land no state held),
its owner for a territory (`partOf`), Wikipedia and Wikidata links, and the `source` of
its border. Land whose history isn't reviewed yet is left out. Coordinates are rounded
to 0.01°. The data is shared under CC BY-SA 4.0 (see below).

## Contributing

Found a mistake, missing data or have an idea? Use "Report a problem" on the
site (or right-click a spot on the globe), or
[open an issue](https://github.com/EdgarMaucourant/terra-tempora/issues).
Pull requests are welcome; `npm run check` and the build run on each one.

## Support

If you enjoy Terra Tempora, you can leave a tip on
[Ko-fi](https://ko-fi.com/edgarmaucourant) or sponsor it on
[GitHub Sponsors](https://github.com/sponsors/EdgarMaucourant). The Support
button on the site also lets you send a kind word.

## Sources and licenses

The code is under the [MIT licence](LICENSE). The map data, texts and
pictures keep the licences of their sources, listed below; the built border
files in `public/data/` include lines traced from CC BY-SA maps, so they are
shared as a whole under CC BY-SA 4.0.

- Borders: today's provinces and countries from
  [Natural Earth 1:10m](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/)
  (public domain), regrouped by owner for each year. The history lives in
  `borders/`: each change names its date, its source (mostly Wikipedia) and how
  sure it is (exact, close or rough). Where a border no longer follows today's
  lines, the piece is cut along a line traced from an old map, named with each
  cut in `borders/cuts.geojson`. Some of those maps are on Wikimedia Commons
  under CC BY-SA, which is why the built border files are shared under CC BY-SA 4.0.
- Key figures, links between realms and most events: Wikidata, CC0, with
  Wikipedia's opening paragraphs (CC BY-SA).
- Pictures: Wikimedia Commons, each under its own free licence, credited with
  its author and licence where shown.
- Imagery: Natural Earth II (public domain), as packaged with CesiumJS. Map
  coastlines: Natural Earth 1:50m (public domain) via `world-atlas` (ISC).
- Libraries: CesiumJS (Apache 2.0), `d3-geo` and `d3-geo-projection` (ISC);
  build tools Vite (MIT) and polylabel (ISC).

Full attributions are in the Sources panel on the site.
