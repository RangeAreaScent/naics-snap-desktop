/** Per-sector color palette. Ported from the iOS app's SectorPalette.swift.
 *  Each of the 20 NAICS 2-digit sectors maps to one distinct hue used as the
 *  left color bar on every row and the icon background in Browse. Colors stay
 *  legible on both light and dark backgrounds and feel "business-domain
 *  appropriate" (warmer earth tones for primary industries, cooler tones for
 *  services). Members of grouped sectors share a color. */
const SECTOR_COLORS: Record<string, string> = {
  // Primary / resource
  "11": "#4C8C2B", // Agriculture, Forestry — leaf green
  "21": "#8C6239", // Mining, Quarrying — earth brown
  "22": "#C9A227", // Utilities — amber
  "23": "#D87C30", // Construction — safety orange

  // Manufacturing (31-33 grouped) — industrial slate
  "31": "#5A6470",
  "32": "#5A6470",
  "33": "#5A6470",

  // Trade
  "42": "#1F8A8F", // Wholesale — teal
  "44": "#C44569", // Retail (44-45) — magenta
  "45": "#C44569",

  // Movement (48-49) — transit blue
  "48": "#2A6FB0",
  "49": "#2A6FB0",

  // Services
  "51": "#7A4FC2", // Information — violet
  "52": "#3F51B5", // Finance — indigo
  "53": "#8D6E63", // Real Estate — taupe brown
  "54": "#0A66C2", // Professional Services — corporate blue
  "55": "#455A64", // Management — graphite slate
  "56": "#4FA8C7", // Admin Support — sky blue
  "61": "#2BB673", // Educational — mint green
  "62": "#E04E5C", // Health Care — coral red
  "71": "#B83BAE", // Arts, Entertainment — magenta
  "72": "#D63D3D", // Accommodation, Food — appetite red
  "81": "#85883E", // Other Services — olive
  "92": "#2C3E50", // Public Administration — navy charcoal
};

export function sectorColor(sectorCode: string): string {
  return SECTOR_COLORS[sectorCode] ?? "#7c8390";
}

/** Census-style display code: "31-33" / "44-45" / "48-49" or the raw 2-digit. */
export function sectorDisplayCode(sectorCode: string): string {
  switch (sectorCode) {
    case "31":
    case "32":
    case "33":
      return "31-33";
    case "44":
    case "45":
      return "44-45";
    case "48":
    case "49":
      return "48-49";
    default:
      return sectorCode;
  }
}

/** Display label for a NAICS level (sector / subsector / industry group / ...). */
export function levelLabel(level: number): string {
  switch (level) {
    case 2:
      return "Sector";
    case 3:
      return "Subsector";
    case 4:
      return "Industry Group";
    case 5:
      return "Industry";
    case 6:
      return "Industry";
    default:
      return "";
  }
}

/** Human-readable SBA size threshold, or null when no standard exists. */
export function formatSbaSize(
  dollars: number | null,
  employees: number | null,
): string | null {
  if (dollars != null) {
    const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
    return `$${fmt.format(dollars)}M annual receipts`;
  }
  if (employees != null) {
    const fmt = new Intl.NumberFormat("en-US");
    return `${fmt.format(employees)} employees`;
  }
  return null;
}
