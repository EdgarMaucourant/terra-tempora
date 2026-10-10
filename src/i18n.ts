// Interface text in several languages. English is bundled; another language's
// file (src/locales/<code>.json) is downloaded only when it is the one in use.
// Messages may hold {placeholders}; a message that depends on a count is an
// object of plural forms ("one", "other", …) picked with Intl.PluralRules.
// Translated data (events, turning points, …) sits in public/data/i18n/<code>/,
// see `withText`.

import en from "./locales/en.json";

export type MessageKey = keyof typeof en;
type Message = string | Partial<Record<Intl.LDMLPluralRule, string>>;
type Params = Record<string, string | number>;

export interface Language {
  code: string;
  /** The language's name in itself. */
  name: string;
}

export const LANGUAGES: Language[] = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
];

const LANGUAGE_KEY = "history-globe:language";
const others = import.meta.glob<{ default: Record<string, Message> }>(["./locales/*.json", "!./locales/en.json"]);

let messages: Record<string, Message> = en;
let plurals = new Intl.PluralRules("en");
let numbers = new Intl.NumberFormat("en");

/** The language in use, e.g. "fr". */
export let lang = "en";

function supported(code: string | null | undefined): string | undefined {
  const short = code?.toLowerCase().split("-")[0];
  return LANGUAGES.find((l) => l.code === short)?.code;
}

/**
 * Picks the language, first match wins: ?lang= in the address (handy for
 * testers and shared links), the reader's earlier choice, the browser's
 * languages, then English. Loads its messages before the page draws.
 */
export async function initLanguage(): Promise<void> {
  let chosen: string | null = null;
  try {
    chosen = localStorage.getItem(LANGUAGE_KEY);
  } catch {
    // Storage blocked; fall back to the browser's languages.
  }
  const asked = new URLSearchParams(location.search).get("lang");
  const code =
    supported(asked) ?? supported(chosen) ?? navigator.languages.map((l) => supported(l)).find(Boolean) ?? "en";
  if (code !== "en") {
    const load = others[`./locales/${code}.json`];
    try {
      const loaded = load ? (await load()).default : null;
      // Anything missing from a translation falls back to English.
      if (loaded) messages = { ...en, ...loaded };
      else return;
    } catch (error) {
      console.error(`The ${code} interface text could not load; showing English.`, error);
      return;
    }
  }
  lang = code;
  plurals = new Intl.PluralRules(code);
  numbers = new Intl.NumberFormat(code);
  document.documentElement.lang = code;
}

/** Remembers the reader's language and reloads the page in it. */
export function setLanguage(code: string) {
  try {
    localStorage.setItem(LANGUAGE_KEY, code);
  } catch {
    // Storage blocked; the address carries the choice instead.
  }
  const url = new URL(location.href);
  if (!url.searchParams.has("lang")) return location.reload();
  url.searchParams.set("lang", code);
  location.replace(url.href);
}

/** A number written the reader's way, e.g. 1,554 or 1 554. */
export function formatNumber(n: number): string {
  return numbers.format(n);
}

/** The message for `key` with its {placeholders} filled in. A `count` param picks the plural form. */
export function t(key: MessageKey, params: Params = {}): string {
  let message = messages[key] ?? en[key];
  if (typeof message === "object") {
    const count = Number(params.count ?? 0);
    message = message[plurals.select(count)] ?? message.other ?? "";
  }
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    return typeof value === "number" ? formatNumber(value) : value;
  });
}

/**
 * Fills the page's fixed text from attributes: data-i18n sets the text,
 * data-i18n-html the markup (our own reviewed locale files only), and
 * data-i18n-label, -title and -placeholder those attributes.
 */
export function translatePage(root: ParentNode = document) {
  for (const node of root.querySelectorAll<HTMLElement>("[data-i18n]")) node.textContent = t(node.dataset.i18n as MessageKey);
  for (const node of root.querySelectorAll<HTMLElement>("[data-i18n-html]")) node.innerHTML = t(node.dataset.i18nHtml as MessageKey);
  const attributes: [string, string][] = [
    ["i18nLabel", "aria-label"],
    ["i18nTitle", "title"],
    ["i18nPlaceholder", "placeholder"],
  ];
  for (const [data, attribute] of attributes) {
    const selector = `[data-${data.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`;
    for (const node of root.querySelectorAll<HTMLElement>(selector)) {
      node.setAttribute(attribute, t(node.dataset[data] as MessageKey));
    }
  }
}

/** A menu of the languages; picking one reloads the page in it. */
export function languageMenu(className: string): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = className;
  const hidden = document.createElement("span");
  hidden.className = "visually-hidden";
  hidden.textContent = t("language.label");
  const select = document.createElement("select");
  for (const l of LANGUAGES) select.append(new Option(l.name, l.code, false, l.code === lang));
  select.addEventListener("change", () => setLanguage(select.value));
  label.append(hidden, select);
  return label;
}

const texts = new Map<string, Promise<Record<string, Record<string, string>>>>();

/**
 * Translated text for a data file, by item id: public/data/i18n/<lang>/<file>.
 * English is the text in the data files themselves, so it needs no download.
 * A missing file or item leaves the English text in place.
 */
export function textFor(base: string, file: string): Promise<Record<string, Record<string, string>>> {
  if (lang === "en") return Promise.resolve({});
  let pending = texts.get(file);
  if (!pending) {
    pending = fetch(new URL(`i18n/${lang}/${file}`, base))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    texts.set(file, pending);
  }
  return pending;
}

/** Copies the translated fields onto each item with a translation; the rest stay in English. */
export async function withText<T extends { id: string }>(base: string, file: string, items: T[]): Promise<T[]> {
  const text = await textFor(base, file);
  return items.map((item) => (text[item.id] ? { ...item, ...text[item.id] } : item));
}
