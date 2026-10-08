// Years are integers on one line, negative for BCE, as in Cliopatria. There is
// no year 0 in the calendar, so 0 is shown as 1 CE.
export function formatYear(year: number): string {
  const y = Math.round(year);
  return y < 0 ? `${-y} BCE` : `${Math.max(1, y)} CE`;
}

export function yearNumber(year: number): string {
  const y = Math.round(year);
  return String(y < 0 ? -y : Math.max(1, y));
}

export function era(year: number): string {
  return Math.round(year) < 0 ? "BCE" : "CE";
}

/** Compact label for a tick on the time axis. */
export function tickLabel(year: number): string {
  if (year === 0) return "1 CE";
  return year < 0 ? `${-year} BCE` : String(year);
}

export function formatRange(from: number, to: number): string {
  if (from === to) return formatYear(from);
  if (from < 0 && to >= 0) return `${formatYear(from)} to ${formatYear(to)}`;
  return `${yearNumber(from)} to ${formatYear(to)}`;
}
