// Asks English Wikipedia which Wikidata item each realm's article belongs to,
// and saves it in scripts/article-items.json, so the audit (audit.mjs) can
// tell a realm linked to the wrong item (an article on South Vietnam with the
// item of North Vietnam). Unlike Wikidata, Wikipedia can be reached from the
// cloud machines this project is often built on.
//
//   node scripts/fetch-article-items.mjs
//
// Run it again after `npm run data` when realms or their links changed.
import { readFileSync, writeFileSync } from "node:fs";

const API = "https://en.wikipedia.org/w/api.php";
const AGENT = "terra-tempora/0.1 (https://github.com/EdgarMaucourant/terra-tempora)";
const OUT = "scripts/article-items.json";
const BATCH = 50;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A realm's article as a page title ("Tuvan People's Republic", not its link). */
export function articleTitle(article) {
  const m = /^https?:\/\/en\.wikipedia\.org\/wiki\/(.+)$/.exec(article);
  return (m ? decodeURIComponent(m[1]) : article).replace(/_/g, " ").trim();
}

async function get(titles) {
  const url = `${API}?${new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "pageprops",
    ppprop: "wikibase_item|disambiguation",
    redirects: "1",
    titles: titles.join("|"),
  })}`;
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { headers: { "User-Agent": AGENT } }).catch(() => null);
    if (response?.ok) return (await response.json()).query;
    if (attempt >= 6) throw new Error(`Wikipedia answered ${response?.status ?? "nothing"}`);
    const retryAfter = Number(response?.headers.get("retry-after")) || 0;
    await sleep(Math.max(retryAfter * 1000, 5000 * 2 ** attempt));
  }
}

const civs = JSON.parse(readFileSync("public/data/civilizations.json", "utf8")).civilizations;
const titles = [...new Set(civs.filter((c) => c.wikipedia).map((c) => articleTitle(c.wikipedia)))].sort();

const items = {};
for (let i = 0; i < titles.length; i += BATCH) {
  const batch = titles.slice(i, i + BATCH);
  const q = await get(batch);
  // Titles Wikipedia spells another way, then redirects, followed in order.
  const normalized = Object.fromEntries((q.normalized ?? []).map((n) => [n.from, n.to]));
  const redirects = Object.fromEntries((q.redirects ?? []).map((r) => [r.from, r]));
  const pages = Object.fromEntries((q.pages ?? []).map((p) => [p.title, p]));
  for (const title of batch) {
    let page = normalized[title] ?? title;
    const redirect = redirects[page];
    if (redirect) page = redirect.to;
    const p = pages[page];
    items[title] = {
      item: p?.pageprops?.wikibase_item ?? null,
      // The article it lands on, when that is another one.
      ...(page !== title && { page }),
      // A redirect to a section, or to a list of meanings: its item is not the realm's.
      ...(redirect?.tofragment && { section: redirect.tofragment }),
      ...(p?.pageprops && "disambiguation" in p.pageprops && { disambiguation: true }),
      ...((!p || p.missing) && { missing: true }),
    };
  }
  process.stdout.write(`\r${Math.min(i + BATCH, titles.length)} of ${titles.length} articles`);
  await sleep(1000);
}
console.log();
writeFileSync(OUT, `${JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), articles: items }, null, 1)}\n`);
console.log(`Saved ${OUT}`);
