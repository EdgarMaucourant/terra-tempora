// Picks a picture for every civilization from the pictures its English
// Wikipedia article shows, for the cards whose Wikidata item has no picture,
// coat of arms or flag. Only files kept on Wikimedia Commons are taken, so
// every one is freely licensed; the app reads the author and licence from
// Commons for the credit line. A photo, painting, coin or sculpture is
// preferred to a coat of arms or flag; maps, charts and family trees are left
// out, since every card already shows the realm's outline.
//
//   node scripts/fetch-pictures.mjs [--again]
//
// Each pick is then checked on Commons: a file that is missing, not freely
// licensed, too small, or filed under a maps category is set aside and the
// article's next best file tried.
//
// Each article's list of files is kept in data-raw/media-lists.json, and what
// Commons says of each file in data-raw/commons-files.json, so the choice can
// be tuned and run again without asking Wikimedia; --again asks afresh. scripts/picture-fixes.json overrides the choice by article (a file
// name, or null for none). Saves scripts/civ-pictures.json (article → file)
// and writes each civilization's "picture" into public/data/civilizations.json;
// build-civilizations.mjs reads the same file, so the pictures survive a rebuild.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const AGENT = "terra-tempora/0.1 (https://github.com/EdgarMaucourant/terra-tempora)";
const RAW = "data-raw/media-lists.json";
const RAW_FILES = "data-raw/commons-files.json";
const OUT = "scripts/civ-pictures.json";
const FIXES = JSON.parse(readFileSync("scripts/picture-fixes.json", "utf8"));
const PARALLEL = 2;
// Wikipedia limits busy clients; a pause between requests keeps clear of it.
const PAUSE = 250;

// Kept in step with MAP_LIKE in src/wikidata.ts, plus other drawings that say little on a card.
const MAP_LIKE = /\b(map|maps|locator|location|extent|territor|orthographic|borders?)\b|karte|carte|mapa/i;
const DIAGRAM =
  /\b(family tree|genealog\w*|chart|diagram|timeline|graph|population|ethnic\w*|languages?|linguistic|dialects?|distribution|expansion|campaigns?|routes?|plan|division|provinces|administrative|atlas|gazetteer|plate|coloni[sz]ation|migrations?|tribes|network|cronolog\w*|chronolog\w*|territor\w*|lineage|tabula|carta|descripcion|insulae|indiae|ptolem\w*|blaeu|delisle|visscher|van der aa|mercator|ortelius|homann|anciens|countries|stub|icon|logo|symbol|signature|disambig|question book|wiktionary|commons-logo|padlock|edit-clear|ambox|portal|wikisource)\b/i;
// "Ottoman Empire 1481", "Achaemenid Empire 500 BCE": the realm at a date is a map.
const REALM_AT_DATE =
  /\b(empire|caliphate|dynasty|dynasties|kingdoms?|khanate|khaganate|sultanate|republic|confederation|persia|africa|asia|europe|india|china)\b.*\b\d{3,4}\b|\b\d{2,4} ?(ad|bc|bce|ce)\b/i;
// "Bosnian Banate in 1354", "Almohads after 1212", "Corsica 1757", "Silesia 1249-1273": also maps.
const AT_DATE = /\b(in|after|before|around|circa)\s\d{3,4}\b|^[\p{L} ]{2,40} \d{3,4}( \d{3,4})?( \w{3,4})?$/iu;
// Pictures of the dead or of atrocities are no way to introduce a realm.
const GRIM = /\b(corpses?|mutilated|massacres?|execut\w*|behead\w*|lynch\w*|atrocit\w*|genocide|victims|prisoners|hanged|skulls?)\b/i;
const EMBLEM = /\b(flags?|coat|arms|emblem|seal|insignia|banner|standard|tamga|tamgha|coa|wappen|blason|escudo|bandeira|bandera)\b/i;

const words = (file) => file.replace(/[_.,()–-]/g, " ").replace(/\s+/g, " ").trim();

/** The best picture among an article's files, in article order, or null; `rejected` files are passed over. */
function choose(files, rejected) {
  const usable = files.filter((f) => !rejected.has(f.file) && ![MAP_LIKE, DIAGRAM, AT_DATE, GRIM].some((re) => re.test(words(f.file))));
  const emblem = (f) => EMBLEM.test(words(f.file));
  // Photos, paintings and scans are JPEGs; drawings (PNG, SVG, GIF) are mostly maps and flags.
  const photos = usable.filter((f) => !emblem(f) && /\.(jpe?g|tiff?|webp)$/i.test(f.file) && !REALM_AT_DATE.test(words(f.file)));
  // Only the infobox's flag or arms: those further down may be another realm's, or today's.
  const emblems = usable.filter((f) => emblem(f) && f.section === 0);
  // The lead section's picture is about the realm itself; later ones may be about its land's prehistory.
  const pick = (list) => list.find((f) => f.lead) ?? list.find((f) => f.section === 0) ?? list[0];
  return (pick(photos) ?? pick(emblems))?.file ?? null;
}

/** An article's files on Commons, in article order. */
async function mediaList(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`;
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { headers: { "User-Agent": AGENT, "Api-User-Agent": AGENT } });
    if (response.ok) {
      return ((await response.json()).items ?? [])
        .filter((i) => i.type === "image" && i.srcset?.some((s) => s.src.includes("/wikipedia/commons/")))
        .map((i) => ({ file: i.title.replace(/^File:/, "").replace(/_/g, " "), lead: !!i.leadImage, section: i.section_id }));
    }
    if (response.status === 404) return [];
    if (attempt === 6) throw new Error(`${title}: Wikipedia answered ${response.status}`);
    const wait = Math.max(Number(response.headers.get("retry-after") ?? 0) * 1000, 2000 * 2 ** attempt);
    console.warn(`${title}: Wikipedia answered ${response.status}, trying again in ${wait / 1000} s`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

/** Asks Wikimedia, waiting as long as it says when it is busy. */
async function getJson(url, what) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { headers: { "User-Agent": AGENT, "Api-User-Agent": AGENT } });
    if (response.ok) return response.json();
    if (attempt === 8) throw new Error(`${what}: Wikimedia answered ${response.status}`);
    const wait = Math.min(120_000, Math.max(Number(response.headers.get("retry-after") ?? 0) * 1000, 2000 * 2 ** attempt));
    console.warn(`${what}: Wikimedia answered ${response.status}, trying again in ${wait / 1000} s`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

/** Licence, size and (visible) categories of these Commons files, 50 to a request. */
async function commonsFiles(files, into) {
  for (let i = 0; i < files.length; i += 50) {
    const params = {
      action: "query",
      titles: files.slice(i, i + 50).map((f) => `File:${f}`).join("|"),
      prop: "imageinfo|categories",
      iiprop: "extmetadata|size",
      iiextmetadatafilter: "LicenseShortName|NonFree",
      cllimit: "max",
      clshow: "!hidden",
      format: "json",
      formatversion: "2",
    };
    let more = {};
    while (more) {
      const json = await getJson(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ ...params, ...more })}`, "Commons");
      // Kept under the name asked for, which Commons may have normalized.
      const asked = new Map((json.query.normalized ?? []).map((n) => [n.to, n.from]));
      for (const page of json.query.pages) {
        const file = (into[asked.get(page.title) ?? page.title] ??= { license: "", cats: [] });
        const info = page.imageinfo?.[0];
        if (page.missing) file.missing = true;
        if (info) {
          file.license = info.extmetadata?.LicenseShortName?.value ?? "";
          if (info.extmetadata?.NonFree?.value) file.nonfree = true;
          [file.w, file.h] = [info.width, info.height];
        }
        for (const c of page.categories ?? []) {
          const cat = c.title.replace(/^Category:/, "");
          if (!file.cats.includes(cat)) file.cats.push(cat);
        }
      }
      more = json.continue ?? null;
    }
    writeFileSync(RAW_FILES, JSON.stringify(into));
    await new Promise((r) => setTimeout(r, PAUSE * 4));
  }
}

const MAP_CATEGORY = /\bmaps?\b|atlases|cartograph/i;
/** Whether Commons says the file is fit for a card: there, free, big enough and not a map. */
const fit = (f) =>
  !f.missing && !f.nonfree && !!f.license && (f.w ?? 0) >= 320 && (f.h ?? 0) >= 200 && !f.cats.some((c) => MAP_CATEGORY.test(c));

const again = process.argv.includes("--again");
const lists = existsSync(RAW) && !again ? JSON.parse(readFileSync(RAW, "utf8")) : {};
const data = JSON.parse(readFileSync("public/data/civilizations.json", "utf8"));
const titles = [...new Set(data.civilizations.map((c) => c.wikipedia).filter(Boolean))].sort();
const missing = titles.filter((t) => !(t in lists));

mkdirSync("data-raw", { recursive: true });
const saveLists = () => writeFileSync(RAW, JSON.stringify(lists));
let done = 0;
const queue = [...missing];
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    while (queue.length) {
      const title = queue.shift();
      try {
        lists[title] = await mediaList(title);
        await new Promise((r) => setTimeout(r, PAUSE));
      } catch (error) {
        console.warn(error.message);
      }
      if (++done % 100 === 0) {
        console.log(`${done} / ${missing.length}`);
        saveLists();
      }
    }
  }),
);
saveLists();

const known = existsSync(RAW_FILES) && !again ? JSON.parse(readFileSync(RAW_FILES, "utf8")) : {};
const rejected = new Set();
let pictures = {};
// Each round checks the new picks; a rejected pick makes way for the article's next best file.
for (let round = 0; round < 6; round++) {
  pictures = {};
  for (const title of titles) {
    if (!(title in lists)) continue;
    const file = title in FIXES ? FIXES[title] : choose(lists[title], rejected);
    if (file) pictures[title] = file;
  }
  const unchecked = [...new Set(Object.values(pictures))].filter((f) => !known[`File:${f}`]);
  if (unchecked.length) {
    console.log(`Checking ${unchecked.length} files on Commons`);
    await commonsFiles(unchecked, known);
  }
  let fresh = 0;
  for (const [title, file] of Object.entries(pictures)) {
    const info = known[`File:${file}`];
    if (title in FIXES || !info || fit(info) || rejected.has(file)) continue;
    rejected.add(file);
    fresh++;
  }
  if (!fresh) break;
}
for (const [title, file] of Object.entries(pictures)) if (!(title in FIXES) && rejected.has(file)) delete pictures[title];
for (const title of Object.keys(FIXES)) if (!titles.includes(title)) console.warn(`picture-fixes.json: no article "${title}"`);
writeFileSync(OUT, `${JSON.stringify(pictures, null, 1)}\n`);
for (const c of data.civilizations) {
  if (pictures[c.wikipedia]) c.picture = pictures[c.wikipedia];
  else delete c.picture;
}
writeFileSync("public/data/civilizations.json", JSON.stringify(data));
const found = data.civilizations.filter((c) => c.picture).length;
console.log(`${found} of ${data.civilizations.length} civilizations have a picture from Wikipedia`);
