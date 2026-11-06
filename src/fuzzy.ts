// Forgiving name matching for the search: a name that starts with the query
// comes first, then one that holds it, then one whose words match the query's
// words in any order, allowing a typo or two ("stalingard", "bataille
// marignan", "napoleon waterlo").

/** The words of some names, for `rank`. Names are expected folded (lower case, no accents). */
export function wordsOf(names: string[]): string[] {
  return [...new Set(names.flatMap((n) => n.split(/[^\p{L}\p{N}]+/u).filter(Boolean)))];
}

/** Typos allowed in a query word of this length. */
function allowed(length: number): number {
  return length < 4 ? 0 : length < 7 ? 1 : 2;
}

/**
 * Edit distance between a and b, counting a swap of two neighbours as one
 * edit; anything above `max` comes back as max + 1.
 */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before = new Array<number>(b.length + 1).fill(0);
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, before[j - 2] + 1);
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    before = previous;
    previous = row;
  }
  return previous[b.length];
}

/** Whether a query word matches a word of the name: its start, or close to it. */
function wordMatches(query: string, word: string): boolean {
  if (word.startsWith(query)) return true;
  const max = allowed(query.length);
  // Typos rarely touch the first letter; keeping it cuts most false matches.
  if (!max || query[0] !== word[0]) return false;
  // The whole word, or its start as long as the query ("constantinop" for "constantinople").
  return distance(query, word, max) <= max || (word.length > query.length && distance(query, word.slice(0, query.length), max) <= max);
}

/** The query's words, for `rank`. */
export function queryWords(query: string): string[] {
  return wordsOf([query]);
}

/**
 * How well names match a query (both folded): 0 when one starts with it, 1
 * when one holds it, 2 when every query word matches one of the names' words,
 * allowing typos; -1 when they don't match. An empty query matches all.
 */
export function rank(query: string, words: string[], names: string[], nameWords: string[]): number {
  if (!query) return 0;
  if (names.some((n) => n.startsWith(query))) return 0;
  if (names.some((n) => n.includes(query))) return 1;
  if (!words.length) return -1;
  return words.every((q) => nameWords.some((w) => wordMatches(q, w))) ? 2 : -1;
}
