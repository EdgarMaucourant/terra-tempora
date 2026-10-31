// Small helpers for building the page's elements. Text always goes in as text,
// never as markup, and links to other sites only take web addresses.

/** An element with an optional class and text. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The address if it is a web page (https, or http), else "": addresses come
 * from our data files and from Wikimedia's answers, and a `javascript:` one
 * must never become a link.
 */
function webUrl(url: string | undefined): string {
  try {
    const parsed = new URL(url ?? "");
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch {
    return "";
  }
}

/** Points a link at another site, opened in a new tab. */
export function setHref(a: HTMLAnchorElement, url: string | undefined) {
  const href = webUrl(url);
  if (href) a.href = href;
  else a.removeAttribute("href");
}

/** A link to another site, opened in a new tab. */
export function externalLink(url: string | undefined, text: string, className?: string): HTMLAnchorElement {
  const a = el("a", className, text);
  a.target = "_blank";
  a.rel = "noopener";
  setHref(a, url);
  return a;
}

/** Says a short line to screen readers, through the page's polite live region. */
export function announce(text: string) {
  const region = document.getElementById("announce");
  if (!region) return;
  // Emptied first, so the same words said twice are still read out.
  region.textContent = "";
  requestAnimationFrame(() => (region.textContent = text));
}
