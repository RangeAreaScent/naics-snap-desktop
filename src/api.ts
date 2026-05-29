import { invoke } from "@tauri-apps/api/core";
import type {
  CodeDetail,
  HierarchyNode,
  SearchResult,
  SectorEntry,
} from "./types";

export function searchCodes(query: string, limit = 50): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("search_codes", { query, limit });
}

export function getCodeDetail(code: string): Promise<CodeDetail | null> {
  return invoke<CodeDetail | null>("get_code_detail", { code });
}

export function getCodeActivities(code: string): Promise<string[]> {
  return invoke<string[]>("get_code_activities", { code });
}

export function listSectors(): Promise<SectorEntry[]> {
  return invoke<SectorEntry[]>("list_sectors");
}

export function listChildren(parent: string): Promise<HierarchyNode[]> {
  return invoke<HierarchyNode[]>("list_children", { parent });
}

export async function storeRead<T>(name: string): Promise<T | null> {
  const raw = await invoke<string | null>("store_read", { name });
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storeWrite(name: string, value: unknown): Promise<void> {
  return invoke<void>("store_write", {
    name,
    content: JSON.stringify(value),
  });
}
