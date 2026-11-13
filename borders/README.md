# Borders

The borders, rebuilt one country at a time from 2026 backward. `npm run data`
builds the globe's border files from these files and from nothing else
(`scripts/build-borders.mjs`); `npm run check` checks them.

## How a map is made

The land is cut once into **pieces**: Natural Earth's 1:10m provinces and
states (public domain, about 4,600 of them), downloaded into `data-raw/` on the
first build. Each year's map only says who owns each piece, so two neighbours
always share the same line and the coastline is the same in every year.

A year shows the map as it stood on **31 December** of that year.

Every piece has one **owner**, the state that held sovereignty over it, or
none. On top of the owner a piece can belong to a **territory** (Portuguese
Angola, Greenland), drawn under its own name as part of its owner and
labelled with the owner's name, "Greenland (Denmark)", unless its name already
says it (`"withOwner": false` in realms.json, for Portuguese Angola), and be
**hatched** in the colour of another state that holds it (Crimea, held by
Russia).

## Files

- `2026.json`: today's owner of every piece, by Natural Earth unit
  (`units`, keyed by `adm0_a3`), ground unit (`groundUnits`, `gu_a3`) or piece
  (`pieces`, `adm1_code` or a cut's id), the most precise one winning. `null`
  is land no state owns (Antarctica). An entry is
  `{ "owner", "territory"?, "hatch"? }`; a hatch is
  `{ "by", "since", "note", "source": { "title", "url" } }`.
- `cuts.geojson`: pieces cut out of a province along an older line. Each
  feature's `id` is the new piece, `from` the province it is cut from, and
  `source` where the line comes from. The rest of the province keeps its id.
- `families/<country>.json`: one country with the land it held, walked back
  from 2026. `reviewed` lists the pieces it covers and the first year they are
  reviewed for; `changes` lists what happened, newest first:

  ```json
  {
    "date": "1975-11-11",
    "what": "Angola, with Cabinda, becomes independent",
    "source": { "title": "Angola (Wikipedia)", "url": "https://…" },
    "map": "https://commons.wikimedia.org/wiki/File:…",
    "confidence": "exact",
    "before": [
      {
        "pieces": ["AGO"],
        "owner": "Portugal",
        "territory": "Portuguese Angola",
        "source": { "title": "Portuguese Angola (Wikipedia)", "url": "https://…" },
        "map": "https://commons.wikimedia.org/wiki/File:…"
      }
    ]
  }
  ```

  `before` says who owned the pieces just before the change (the build walks
  back from today). `confidence` is `exact` (a treaty or official line),
  `close` (traced from a map) or `rough` (an estimate). `map` is the map the
  line was drawn from, when there is one.

  **A border's source is about the realm drawn.** The change's `source` and
  `map` are about the land as it is after the change (Angola, from 1975); each
  `before` entry has its own `source` and `map` about the land as it was
  (Portuguese Angola, until 1975). A change that only starts or ends a
  hatching (Indonesia invading Portuguese Timor) leaves the land's own border
  as it was: its source is about the occupation, as the hatch's is.
- `realms.json`: every owner, territory and holder by its English name, with
  its Wikipedia article, Wikidata item and French and Spanish names.
  `periods` name a realm differently from a date (one realm per state, its
  name following the period). `notACountry` keeps it off the list of
  countries (Western Sahara).
- `truth-points.json`: places whose owner was checked against a source, for
  a span of years, and the years they are drawn hatched. Each change adds at
  least one.

Land no family has reviewed for a year is drawn dark and named "Not yet
reviewed".
