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
- Lists the 183 present-day countries, either by the land ("Countries") or by
  the civilizations that led to the nation ("Nations").
- Places key events (battles, treaties, rulers, capitals) on the globe and the
  timeline, with pictures and links to Wikipedia, Britannica and World History
  Encyclopedia.
- Plays a "history travel" through 141 turning points, from Göbekli Tepe to
  today, turning the globe to each one.
- Plays time at 2 to 500 years a second, works on phones, and is available in
  English and French.

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
files in `public/data/` include CC BY-SA traces, so they are shared as a whole
under CC BY-SA 4.0.

- Borders: [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria),
  Seshat Global History Databank, CC BY 4.0.
- Hand-traced borders in `scripts/border-overrides/`, shared under the licence
  of the map they were traced from:
  - Magadha and its successors, 600 to 171 BCE: "Magadha Expansion" by
    Avantiputra7 on Wikimedia Commons (after Schwartzberg, 1992), CC BY-SA 4.0.
  - Ségou, Kaarta, Kong and the Mossi and Hausa kingdoms: "Africa de l'Oèst
    (fin sègle XVIII)" by Nicolas Eynaud on Wikimedia Commons, CC BY-SA 4.0.
  - Luba Empire: "Lunda Empire", Library of Congress, *Zaire: A Country Study*
    (1994), after Jan Vansina, public domain.
  - Great Zimbabwe: "African civilizations map (pre-colonial)" by Jeff Israel
    on Wikimedia Commons, CC BY-SA 3.0.
- Key figures, links between realms and most events: Wikidata, CC0, with
  Wikipedia's opening paragraphs (CC BY-SA).
- Pictures: Wikimedia Commons, each under its own free licence, credited with
  its author and licence where shown.
- Imagery: Natural Earth II (public domain), as packaged with CesiumJS. Map
  coastlines: Natural Earth 1:50m (public domain) via `world-atlas` (ISC).
- Libraries: CesiumJS (Apache 2.0), `d3-geo` and `d3-geo-projection` (ISC);
  build tools Vite (MIT) and polylabel (ISC).

Full attributions are in the Sources panel on the site.
