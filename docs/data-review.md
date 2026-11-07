# Reviewing the map

How the borders, the realm names and links, and the predecessors and
successors are being reviewed, era by era and region by region: the rules for
disputed cases, the sources allowed, and how one review batch runs. For the
build itself, see [development.md](development.md).

Almost every mistake comes from Cliopatria, the source of the borders: a
realm's outline carried on under another realm's name (the Don Cossacks' land
named "Astrakhan Khanate" from 1642 to 1768, a century after Russia took
Astrakhan), a state left out for some years and folded into a neighbour, land
drawn as an occupier, a party or an army drawn as a country, or a wrong
Wikidata item, which brings the wrong picture, text and lineage with it. They
are fixed in the files `npm run data` reads (`scripts/border-overrides/`,
`scripts/link-fixes.json`, `scripts/name-fixes.json` and the others listed in
development.md), never in the built files.

## Tools

- `npm run audit` writes [audit/report.md](audit/report.md): leads sorted by
  era and region, each marked high, medium or low. A lead is a place to look,
  not a proven mistake; most relabels, for instance, are real changes of
  regime.
- The audit's Wikidata checks (what each realm's item is, its dates, its
  predecessors and successors, its article) need `scripts/wikidata-facts.json`.
  Make it with `node scripts/fetch-wikidata-facts.mjs` on a computer that can
  reach Wikidata, and commit it.
- `node scripts/who.mjs <lon>,<lat> <from> [<to>]` prints which realms the map
  draws at a place, year by year.
- `scripts/truth-points.json` lists places whose realm was checked against a
  source; `npm run check` fails when the map no longer draws it there. Every
  fix adds at least one, so a rebuild or a Cliopatria update can't quietly
  undo it.

## Sources

Only recognised sources whose licence allows sharing them alongside the
site's data (CC BY-SA 4.0), named in the Sources panel when they shape what is
drawn:

- Cliopatria (Seshat Global History Databank), CC BY 4.0: the borders.
- Wikidata, CC0: items, dates, predecessors and successors.
- Wikipedia, CC BY-SA: articles and their maps, to check who held what and
  when.
- Natural Earth, public domain: today's borders and outlines.
- The United Nations' list of member states and General Assembly
  resolutions: today's states and disputed land.
- Maps on Wikimedia Commons under a free licence, credited in the override
  file that traces them.

No dataset with a non-commercial licence, and none that is little known, even
just to check against.

## House rules

They settle the usual disputes, so each case needs no new decision. A case
none of them covers, and every civil-war faction or stateless people or host,
is put to the site's owner with the evidence before anything changes.

1. Today's borders are those the UN recognises, and each fix is carried back
   to the first year the border was the same.
2. Annexations stay with the annexing state. Peacetime occupations, and
   protectorates where the local ruler stayed, are drawn as the local state.
   Front lines during a war stay as Cliopatria draws them.
3. Allies, satellites and personal unions are drawn as their own states.
4. Before 1800 a vassal may overlap its overlord. From 1800, land two realms
   both draw goes to the smaller one.
5. A people or a host (the Cossacks, for instance) is a realm while it had a
   government of its own and answered to no state; after that it is drawn as
   the state it answered to. Each case is decided one by one, with how
   Wikipedia's maps show it.
6. Civil-war factions (the Kuomintang, the Spanish Nationalists) are decided
   one by one.
7. A predecessor or successor must have held some of the same land, close in
   time.

## A review batch

The map is reviewed in batches of one era and one region, starting from
today and going back in time. Each batch has a GitHub issue labelled `review`,
with its era and region, in the milestone of its phase.

1. Take the audit's leads for the era and region, and the visitors' reports
   (issues labelled `feedback`) that fall in it.
2. Step through the region every 10 years, and every year around known
   changes, to catch what no check flagged.
3. Check each realm against the sources above: who held the land, the first
   and last years, the name, the Wikidata item, the predecessors and
   successors.
4. Sort each finding: a clear mistake is fixed; a case a house rule covers
   follows the rule; anything else goes to the owner.
5. Fix it in the source file, with a note saying why and which source, from
   the first year the mistake appears.
6. Add truth points, rebuild (`npm run data`), and run `npm run check` and
   `npm run audit`.
7. Open one pull request with pictures of each fix before and after, and the
   list of what was left as it is, and why.

A batch that finds the same kind of mistake again and again turns it into a
new audit check, so later batches catch it for free. One minor version is
released when every batch of an era is done.

## Visitors' reports

A report arrives as a GitHub issue labelled `feedback` with the year, the
place and a link. It gets a label for its kind of mistake and a link to its
batch; a plain mistake in a realm many people open is fixed at once, the rest
in their batch. Its fix adds a truth point, and the issue is closed with a
short note on what changed. Reporters are never named in commits, pull
requests, code or data.
