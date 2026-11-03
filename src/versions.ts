// The versions page: every release in src/changelog.json, newest first, in
// the reader's language, each change linked to its pull requests or issues.

import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader/opsz.css";
import "./versions.css";
import { changeText, formatDate, linkUrl, loadReleases } from "./changelog";
import { el, externalLink } from "./dom";
import { initLanguage, lang, t } from "./i18n";
import { compareVersions, VERSION } from "./version";

const LANGUAGES: [string, string][] = [
  ["en", "English"],
  ["fr", "Français"],
  ["es", "Español"],
];

async function draw() {
  await initLanguage();
  document.title = t("versions.page.tab");
  document.querySelector("h1")!.textContent = t("versions.page.title");
  document.getElementById("versions-intro")!.textContent = t("versions.page.intro");

  // The globe, in this language, and the page in the other languages.
  const nav = document.querySelector(".versions-nav")!;
  const home = el("a", undefined, t("versions.page.back"));
  home.href = `./?lang=${lang}`;
  nav.append(home);
  for (const [code, name] of LANGUAGES) {
    if (code === lang) continue;
    const a = el("a", undefined, name);
    a.href = `versions.html?lang=${code}`;
    a.lang = a.hreflang = code;
    nav.append(a);
  }

  const list = document.getElementById("versions-list")!;
  try {
    const releases = await loadReleases();
    list.replaceChildren(
      ...releases.flatMap((r) => {
        const title = el("h2", undefined);
        title.id = `v${r.version}`;
        title.append(el("span", undefined, t("versions.release", { version: r.version })), el("span", "date", formatDate(r.date)));
        if (compareVersions(r.version, VERSION) === 0) title.append(el("span", "current", t("versions.page.current")));
        const changes = el("ul");
        for (const c of r.changes) {
          const item = el("li", undefined, changeText(c));
          if (c.links?.length) {
            const links = el("span", "links");
            links.title = t("versions.page.changes");
            links.append(" (");
            c.links.forEach((n, i) => {
              if (i) links.append(", ");
              links.append(externalLink(linkUrl(n), `#${n}`));
            });
            links.append(")");
            item.append(links);
          }
          changes.append(item);
        }
        return [title, changes];
      }),
    );
  } catch (error) {
    console.error(error);
    list.textContent = t("versions.page.failed");
  }
}

void draw();
