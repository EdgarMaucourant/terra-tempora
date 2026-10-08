// Cliopatria stores years as integers, negative for BCE. The UI shows the era.
export function formatYear(year: number): string {
  const y = Math.round(year);
  return y < 0 ? `${-y} BCE` : `${y} CE`;
}

export function yearNumber(year: number): string {
  return String(Math.abs(Math.round(year)));
}

export function era(year: number): string {
  return Math.round(year) < 0 ? "BCE" : "CE";
}

export function formatRange(from: number, to: number): string {
  if (from === to) return formatYear(from);
  if (from < 0 && to >= 0) return `${formatYear(from)} to ${formatYear(to)}`;
  return `${yearNumber(from)} to ${formatYear(to)}`;
}
