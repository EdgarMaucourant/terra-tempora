// Countries of today, each with the civilizations in the border data that
// led to it: the states it grew out of, the realms it absorbed, and those
// that ruled its land, wherever they were centred. Hand-picked, oldest first.

export interface Country {
  id: string;
  name: string;
  /** One line on what the lineage covers. */
  blurb: string;
  /** Year the globe opens on: a moment when several of these realms meet. */
  startYear: number;
  /** Civilization the globe centres on when the country opens. */
  focus: string;
  /** Flag stripes, left to right, drawn on the card. */
  flag: string[];
  /** Civilization ids, oldest first. */
  lineage: string[];
}

export const COUNTRIES: Country[] = [
  {
    id: "france",
    name: "France",
    blurb: "From Rome and the Franks to the Fifth Republic, with the duchies, kingdoms and counties France absorbed.",
    startYear: 470,
    focus: "kingdom-of-france",
    flag: ["#002654", "#ffffff", "#ce1126"],
    lineage: [
      // Rome, which conquered Gaul, from its beginnings in Italy.
      "roman-kingdom",
      "roman-republic",
      "roman-empire",
      "gallic-empire",
      "western-roman-empire",
      // The peoples who settled Gaul as Rome fell.
      "salian-franks",
      "ripuarian-franks",
      "burgundians",
      "burgundian-kingdom",
      "visigothic-kingdom",
      // The Frankish realms.
      "kingdom-of-the-franks",
      "aquitaine",
      "breton-kingdoms",
      "merovingian-empire",
      "carolingian-empire",
      "kingdom-of-neustria",
      "kingdom-of-brittany",
      "west-franks",
      // Kingdom of France and the lands it brought in.
      "duchy-of-normandy",
      "kingdom-of-arles",
      "duchy-of-brittany",
      "kingdom-of-france",
      "duchy-of-aquitaine",
      "county-of-toulouse",
      "county-of-champagne",
      "county-of-anjou",
      "duchy-of-burgundy",
      "kingdom-of-navarre",
      "county-of-savoy",
      "house-of-bourbon",
      "duchy-of-lorraine",
      "corsican-republic",
      // Republics, empires and monarchies since the Revolution.
      "french-first-republic",
      "french-directory",
      "french-consulate",
      "first-french-empire",
      "bourbon-kingdom-of-france",
      "french-second-republic",
      "second-french-empire",
      "french-third-republic",
      "vichy-france",
      "free-french",
      "french-fourth-republic",
      "french-fifth-republic",
    ],
  },
];
