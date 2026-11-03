// A page opened before a new release keeps asking for the files of its own
// release, and those are gone once the new one is published: border windows
// and script chunks have a hash in their names. Reloading brings the new
// release, and the visitor stays where they were: the view lives in the
// address (#…).

const KEY = "terra-tempora:reloaded-at";
// At most one reload a minute, so a file that is really missing can't loop.
const MIN_GAP = 60_000;

/** Reloads the page for the new release; false when it just did. */
export function reloadForNewRelease(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < MIN_GAP) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Without storage there is no way to tell a loop: leave the page as it is.
    return false;
  }
  location.reload();
  return true;
}

/** Reloads when a script chunk of this release is gone (Vite's preload error). */
export function reloadOnMissingChunks() {
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForNewRelease()) event.preventDefault();
  });
}
