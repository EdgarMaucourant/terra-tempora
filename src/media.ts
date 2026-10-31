// Photos and videos for the side panel: the files a Wikipedia article shows,
// in the reader's language when Wikipedia has the article, read in the
// browser. Only files kept on Wikimedia Commons are used, so every one is
// freely licensed; each keeps its author and licence for the credit line.

import { externalLink, setHref } from "./dom";
import { localPage, pageUrl } from "./events";
import { t } from "./i18n";
import { MAP_LIKE, pictureCredit, pictureTitle, stripHtml, type Picture } from "./wikidata";

interface Media extends Picture {
  type: "photo" | "video";
  /** The video file itself; photos have only the thumbnail. */
  src?: string;
}

interface ArticleMedia {
  /** The article's opening paragraph. */
  extract: string;
  /** The article, in the reader's language when Wikipedia has it. */
  url: string;
  /** The language of that article, so screen readers read it with the right voice. */
  lang: string;
  media: Media[];
}

const PHOTOS = 8;
const VIDEOS = 3;
const THUMB_WIDTH = 640;
// Logos, icons and the like are part of the page furniture, not pictures of the subject.
const FURNITURE = /\b(icon|logo|symbol|stub|signature|disambig|question book|wiktionary|wikisource|commons-logo|padlock|edit-clear|ambox|portal)\b/i;

interface ImageInfo {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  width?: number;
  height?: number;
  mime?: string;
  mediatype?: string;
  extmetadata?: { Artist?: { value: string }; LicenseShortName?: { value: string } };
}

function toMedia(title: string, info: ImageInfo): Media | null {
  // Files kept on Wikipedia itself may be non-free; only Commons files are used.
  if (!info.thumburl || !info.descriptionurl?.includes("commons.wikimedia.org")) return null;
  const file = title.replace(/^[^:]+:/, "");
  if (FURNITURE.test(file.replace(/[_.-]/g, " "))) return null;
  const video = info.mediatype === "VIDEO" || !!info.mime?.startsWith("video/");
  if (!video) {
    if (!/^image\/(jpeg|png|webp|tiff|gif)$/.test(info.mime ?? "")) return null;
    if ((info.width ?? 0) < 320 || (info.height ?? 0) < 200) return null;
  }
  const meta = info.extmetadata ?? {};
  return {
    type: video ? "video" : "photo",
    file,
    thumb: info.thumburl,
    src: video ? info.url : undefined,
    page: info.descriptionurl,
    artist: meta.Artist ? stripHtml(meta.Artist.value) : "",
    license: meta.LicenseShortName?.value ?? "",
  };
}

interface Summary {
  extract?: string;
  originalimage?: { source: string };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The article's opening and lead picture. Wikipedia's summary service turns
 * busy readers away for a moment (429) when many cards ask at once; it is
 * asked again after a pause, and if it still says no, the opening is read
 * from the article itself through the other API.
 */
async function articleSummary(host: string, title: string): Promise<Summary | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${host}/api/rest_v1/page/summary/${encodeURIComponent(title)}`).catch(() => null);
    if (response?.ok) return (await response.json()) as Summary;
    if (response && response.status !== 429 && response.status < 500) break;
    if (attempt < 2) await wait(1000 * 2 ** attempt);
  }
  const api = new URL(`${host}/w/api.php`);
  api.search = new URLSearchParams({
    action: "query",
    titles: title,
    redirects: "1",
    prop: "extracts|pageimages",
    exintro: "1",
    explaintext: "1",
    piprop: "original",
    format: "json",
    formatversion: "2",
    origin: "*",
  }).toString();
  const found = await fetch(api)
    .then((r) => (r.ok ? (r.json() as Promise<{ query?: { pages?: { extract?: string; original?: { source: string } }[] } }>) : null))
    .catch(() => null);
  const article = found?.query?.pages?.[0];
  if (!article?.extract) return null;
  // The summary service gives the first paragraph; so does this.
  const extract = article.extract.split(/\n+/).find((line) => line.trim().length > 40) ?? article.extract;
  return { extract: extract.trim(), originalimage: article.original };
}

const cache = new Map<string, Promise<ArticleMedia | null>>();

/**
 * The opening paragraph, photos and videos of an English Wikipedia article
 * (or its edition in the reader's language): the lead picture first, then
 * pictures of the subject before maps, then up to three videos.
 */
export function articleMedia(english: string): Promise<ArticleMedia | null> {
  const key = english.replace(/ /g, "_");
  let pending = cache.get(key);
  if (!pending) {
    pending = localPage(key)
      .then(async (page) => {
        const host = `https://${page.wiki}.wikipedia.org`;
        const files = new URL(`${host}/w/api.php`);
        files.search = new URLSearchParams({
          action: "query",
          titles: page.title,
          redirects: "1",
          generator: "images",
          gimlimit: "80",
          prop: "imageinfo",
          iiprop: "url|size|mime|mediatype|extmetadata",
          iiextmetadatafilter: "Artist|LicenseShortName",
          iiurlwidth: String(THUMB_WIDTH),
          format: "json",
          formatversion: "2",
          origin: "*",
        }).toString();
        const [summary, list] = await Promise.all([
          articleSummary(host, page.title),
          fetch(files)
            .then((r) => (r.ok ? (r.json() as Promise<{ query?: { pages?: { title: string; imageinfo?: ImageInfo[] }[] } }>) : null))
            .catch(() => null),
        ]);
        if (!summary && !list) return null;
        const all = (list?.query?.pages ?? [])
          .map((p) => (p.imageinfo?.[0] ? toMedia(p.title, p.imageinfo[0]) : null))
          .filter((m): m is Media => !!m);
        const leadFile = summary?.originalimage?.source
          ? decodeURIComponent(summary.originalimage.source.split("/").pop()!).replace(/_/g, " ")
          : "";
        const isLead = (m: Media) => m.file.replace(/_/g, " ") === leadFile;
        const isMap = (m: Media) => MAP_LIKE.test(m.file.replace(/[_.-]/g, " "));
        const photos = all
          .filter((m) => m.type === "photo")
          .sort((a, b) => Number(isLead(b)) - Number(isLead(a)) || Number(isMap(a)) - Number(isMap(b)))
          .slice(0, PHOTOS);
        const videos = all.filter((m) => m.type === "video").slice(0, VIDEOS);
        return { extract: summary?.extract ?? "", url: pageUrl(page), lang: page.wiki, media: [...photos, ...videos] };
      })
      .catch(() => null)
      .then((found) => {
        // A failed answer (Wikipedia busy, a network hiccup) is asked again next time.
        if (!found) cache.delete(key);
        return found;
      });
    cache.set(key, pending);
  }
  return pending;
}

/**
 * A gallery: the chosen photo or video large, with its credit, and a row of
 * thumbnails to pick another. Hidden while there is nothing to show.
 */
export function renderGallery(container: HTMLElement, media: Media[]) {
  container.replaceChildren();
  container.hidden = !media.length;
  if (!media.length) return;
  const stage = document.createElement("figure");
  stage.className = "gallery-stage";
  const caption = document.createElement("figcaption");
  const credit = externalLink(undefined, "");
  caption.append(credit);

  const show = (m: Media) => {
    let view: HTMLElement;
    if (m.type === "video" && m.src) {
      const video = Object.assign(document.createElement("video"), { controls: true, preload: "none", poster: m.thumb, src: m.src });
      video.setAttribute("playsinline", "");
      view = video;
    } else {
      view = Object.assign(document.createElement("img"), { src: m.thumb, alt: "", decoding: "async" });
    }
    stage.replaceChildren(view, caption);
    setHref(credit, m.page);
    credit.textContent = pictureCredit(m);
    credit.title = pictureTitle(m);
    for (const b of thumbs.children) b.setAttribute("aria-pressed", String((b as HTMLElement).dataset.file === m.file));
  };

  const thumbs = document.createElement("div");
  thumbs.className = "gallery-thumbs";
  for (const m of media) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.file = m.file;
    button.className = m.type === "video" ? "gallery-thumb video" : "gallery-thumb";
    button.setAttribute("aria-label", m.type === "video" ? t("media.video", { file: m.file }) : t("media.photo", { file: m.file }));
    button.append(Object.assign(document.createElement("img"), { src: m.thumb, alt: "", loading: "lazy", decoding: "async" }));
    // A photo that fails to load leaves the gallery.
    button.querySelector("img")!.addEventListener("error", () => button.remove(), { once: true });
    button.addEventListener("click", () => show(m));
    thumbs.append(button);
  }
  container.append(stage);
  if (media.length > 1) container.append(thumbs);
  show(media[0]);
}
