// The "What's new" card: shortly after the site opens, tells a returning
// visitor what changed since their last visit. First visits get the "New
// here?" prompt instead, and bug-fix releases (only z moved) are left out.
// At most the last two releases are shown; the versions page has them all.

import { changeText, formatDate, loadReleases, type Release } from "./changelog";
import { el } from "./dom";
import { t } from "./i18n";
import { store, stored } from "./storage";
import { compareVersions, isFixOnly, VERSION } from "./version";

/** The last version this browser was shown. None means a first visit. */
const SEEN_KEY = "terra-tempora:version-seen";
/** Set when the visitor asked never to see the card again. */
const OFF_KEY = "terra-tempora:whats-new-off";
const DELAY = 1500;
const MAX_RELEASES = 2;

/** The releases to tell this visitor about, newest first, or none. */
async function news(): Promise<Release[]> {
  const seen = stored(SEEN_KEY);
  if (seen !== null && compareVersions(seen, VERSION) >= 0) return [];
  let releases: Release[] = [];
  if (seen !== null && !stored(OFF_KEY)) {
    try {
      releases = (await loadReleases())
        .filter((r) => compareVersions(r.version, seen) > 0 && compareVersions(r.version, VERSION) <= 0 && !isFixOnly(r.version))
        .slice(0, MAX_RELEASES);
    } catch {
      // Not this time, then.
    }
  }
  // Nothing to tell: this browser is up to date. Otherwise it is once the card shows.
  if (!releases.length) markSeen(VERSION);
  return releases;
}

function markSeen(version: string) {
  store(SEEN_KEY, version);
}

function render(list: HTMLElement, releases: Release[]) {
  list.replaceChildren(
    ...releases.flatMap((r) => {
      const title = el("h3", undefined, t("versions.release", { version: r.version }));
      title.append(" ", el("span", "whats-new-date", formatDate(r.date)));
      const changes = el("ul");
      for (const c of r.changes) changes.append(el("li", undefined, changeText(c)));
      return [title, changes];
    }),
  );
}

/**
 * Shows the card shortly after the site opens when there is news for this
 * visitor and `busy` says nothing else is on screen. Resolves to whether it
 * was shown, so the "New here?" prompt can keep quiet.
 */
export function setupWhatsNew(card: HTMLElement, busy: () => boolean): Promise<boolean> {
  const off = card.querySelector<HTMLInputElement>("input[type=checkbox]")!;
  off.addEventListener("change", () => store(OFF_KEY, off.checked ? "1" : null));
  const close = () => (card.hidden = true);
  for (const b of card.querySelectorAll("[data-close]")) b.addEventListener("click", close);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  const pending = news();
  return new Promise((resolve) => {
    setTimeout(async () => {
      const releases = await pending;
      if (!releases.length || busy()) return resolve(false);
      render(card.querySelector(".whats-new-list")!, releases);
      card.hidden = false;
      markSeen(VERSION);
      resolve(true);
    }, DELAY);
  });
}
