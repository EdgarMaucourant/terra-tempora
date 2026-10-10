import { t } from "./i18n";

// Years are integers on one line, negative for BCE, as in Cliopatria. There is
// no year 0 in the calendar, so 0 is shown as 1 CE.
export function formatYear(year: number): string {
  const y = Math.round(year);
  return y < 0 ? t("year.bce", { year: String(-y) }) : t("year.ce", { year: String(Math.max(1, y)) });
}

export function yearNumber(year: number): string {
  const y = Math.round(year);
  return String(y < 0 ? -y : Math.max(1, y));
}

export function era(year: number): string {
  return Math.round(year) < 0 ? t("year.eraBce") : t("year.eraCe");
}

/** Compact label for a tick on the time axis. */
export function tickLabel(year: number): string {
  if (year === 0) return t("year.ce", { year: "1" });
  return year < 0 ? t("year.bce", { year: String(-year) }) : String(year);
}

export function formatRange(from: number, to: number): string {
  if (from === to) return formatYear(from);
  // Within one era the era is named once, at the end: "1206 to 1368 CE".
  if (from < 0 && to >= 0) return t("year.range", { from: formatYear(from), to: formatYear(to) });
  return t("year.range", { from: yearNumber(from), to: formatYear(to) });
}
