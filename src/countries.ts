// Countries of today, each with the civilizations that led to it. The list is
// built by scripts/build-countries.mjs into public/data/countries.json.

export interface Country {
  id: string;
  name: string;
  /** The present-day state's civilization id. */
  civ: string;
  /** One line on what the lineage covers, for hand-picked lineages. */
  blurb: string | null;
  /** Year the globe opens on: when the most of these realms stood at once. */
  startYear: number;
  /** Civilization the globe centres on when the country opens. */
  focus: string;
  /** Present-day land, in km². */
  area: number;
  /** Civilization ids, oldest first. */
  lineage: string[];
}

export async function loadCountries(base: string): Promise<Country[]> {
  const response = await fetch(new URL("countries.json", base));
  if (!response.ok) throw new Error(`Could not load the countries (${response.status})`);
  return ((await response.json()) as { countries: Country[] }).countries;
}
