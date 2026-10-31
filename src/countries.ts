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
  /** [longitude, latitude] of the middle of the country's present land. */
  centre: [number, number];
  /** Present-day land, in km². */
  area: number;
  /** Civilizations that led to the nation, oldest first. */
  lineage: string[];
  /** Civilizations whose borders crossed the country's present land, oldest first. */
  territory: string[];
  /** Year the territory view opens on. */
  territoryYear: number;
}

/** A country seen as a nation (its lineage) or as land (everything that crossed it). */
export type CountryView = "nationality" | "territory";

export function countryCivIds(country: Country, view: CountryView): string[] {
  return view === "territory" ? country.territory : country.lineage;
}

export async function loadCountries(base: string): Promise<Country[]> {
  const response = await fetch(new URL("countries.json", base));
  if (!response.ok) throw new Error(`Could not load the countries (${response.status})`);
  return ((await response.json()) as { countries: Country[] }).countries;
}
