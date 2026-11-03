// What each version brought, from src/changelog.json, in the reader's
// language. The list is downloaded only by the pages that show it: the
// What's new card (for returning visitors) and the versions page.

import { lang } from "./i18n";

export interface Change {
  en: string;
  fr?: string;
  es?: string;
  /** Pull requests or issues of the GitHub repository, by number. */
  links?: number[];
}

export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  changes: Change[];
}

export const REPO_URL = "https://github.com/EdgarMaucourant/terra-tempora";

/** Every release, newest first. */
export async function loadReleases(): Promise<Release[]> {
  return (await import("./changelog.json")).default.releases as Release[];
}

/** The change in the reader's language, or in English. */
export function changeText(change: Change): string {
  return (change as unknown as Record<string, string | undefined>)[lang] || change.en;
}

/** An issue or pull request: GitHub sends /issues/N on to the pull request when it is one. */
export function linkUrl(n: number): string {
  return `${REPO_URL}/issues/${n}`;
}

/** "3 November 2026", written the reader's way. */
export function formatDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}
