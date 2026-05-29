/** Lightweight row used by Search / Favorites / Recents. */
export interface SearchResult {
  code: string;
  title: string;
  /** 2 = sector, 3 = subsector, 4 = industry group, 5 = industry, 6 = national industry. */
  level: number;
  sectorCode: string;
  sectorTitle: string;
}

/** Full row loaded when a code's detail screen opens. */
export interface CodeDetail {
  code: string;
  title: string;
  description: string;
  level: number;
  sectorCode: string;
  sectorTitle: string;
  subsectorCode: string;
  subsectorTitle: string;
  industryGroupCode: string;
  industryGroupTitle: string;
  industryCode: string;
  industryTitle: string;
  /** SBA size threshold in millions of dollars (annual receipts). */
  sbaSizeDollars: number | null;
  /** SBA size threshold in number of employees. */
  sbaSizeEmployees: number | null;
  sbaFootnote: number | null;
}

export interface SectorEntry {
  code: string;
  /** "31-33" / "44-45" / "48-49" or the raw 2-digit code. */
  displayCode: string;
  title: string;
}

export interface HierarchyNode {
  code: string;
  title: string;
  level: number;
  childCount: number;
}

export interface Favorite {
  code: string;
  title: string;
  level: number;
  sectorCode: string;
  sectorTitle: string;
  addedAt: number;
}

export interface CollectionItem {
  code: string;
  title: string;
  level: number;
  sectorCode: string;
  sectorTitle: string;
  addedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
  items: CollectionItem[];
}

export interface Note {
  text: string;
  editedAt: number;
}

/** Map of NAICS code -> note. */
export type NoteMap = Record<string, Note>;
