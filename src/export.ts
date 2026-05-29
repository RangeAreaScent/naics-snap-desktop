import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getCodeDetail } from "./api";
import { formatSbaSize } from "./sectors";
import type { Collection, NoteMap } from "./types";

interface ExportEntry {
  code: string;
  title: string;
  note: string;
  sector: string;
  subsector: string;
  industryGroup: string;
  industry: string;
  sbaSize: string;
}

/** Enriches collection items with full hierarchy + SBA size + the saved note.
 *  Hierarchy and SBA are stored on the detail row, fetched fresh at export
 *  time so a future schema bump doesn't strand stale data. */
async function buildEntries(
  c: Collection,
  notes: NoteMap,
): Promise<ExportEntry[]> {
  const details = await Promise.all(
    c.items.map((i) => getCodeDetail(i.code).catch(() => null)),
  );
  return c.items.map((item, idx) => {
    const d = details[idx];
    const sba = d ? formatSbaSize(d.sbaSizeDollars, d.sbaSizeEmployees) : null;
    return {
      code: item.code,
      title: d?.title ?? item.title,
      note: notes[item.code]?.text ?? "",
      sector: d?.sectorTitle ?? item.sectorTitle,
      subsector: d?.subsectorTitle ?? "",
      industryGroup: d?.industryGroupTitle ?? "",
      industry: d?.industryTitle ?? "",
      sbaSize: sba ?? "",
    };
  });
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const CSV_HEADER = [
  "Code",
  "Title",
  "Note",
  "Sector",
  "Subsector",
  "Industry Group",
  "Industry",
  "SBA Size Standard",
];

export async function exportCollectionCSV(
  c: Collection,
  notes: NoteMap,
): Promise<boolean> {
  const path = await save({
    defaultPath: `${c.name}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return false;

  const entries = await buildEntries(c, notes);
  const rows = [
    CSV_HEADER,
    ...entries.map((e) => [
      e.code,
      e.title,
      e.note,
      e.sector,
      e.subsector,
      e.industryGroup,
      e.industry,
      e.sbaSize,
    ]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  await invoke("write_text_file", { path, content: csv });
  return true;
}

export async function exportCollectionPDF(
  c: Collection,
  notes: NoteMap,
): Promise<boolean> {
  const path = await save({
    defaultPath: `${c.name}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return false;

  const entries = await buildEntries(c, notes);
  // The Rust side uses snake_case field names; serde renames camelCase JS
  // keys for us via #[derive(Deserialize)] defaults, but printpdf's
  // ExportEntry uses snake_case in Rust, so we pass snake_case here.
  const payload = entries.map((e) => ({
    code: e.code,
    title: e.title,
    note: e.note,
    sector: e.sector,
    subsector: e.subsector,
    industry_group: e.industryGroup,
    industry: e.industry,
    sba_size: e.sbaSize,
  }));
  await invoke("export_pdf", { path, title: c.name, entries: payload });
  return true;
}
