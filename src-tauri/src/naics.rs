//! Read-only access to the bundled NAICS 2022 SQLite database.
//!
//! Mirrors the actor-style pattern from the iOS app's `NAICSRepository`:
//! each call opens a fresh read-only connection, runs the query, and drops it
//! — cheap (just a file handle) and contention-free.

use crate::business_terms;
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;

/// Census-style grouped sectors: each member shares the same theme color and
/// the group is shown as a single row in Browse. Keep in sync with
/// `src/sectors.ts` on the frontend.
const SECTOR_CODES: &[&str] = &[
    "11", "21", "22", "23", "31", // Manufacturing (31-33)
    "42", "44", // Retail Trade (44-45)
    "48", // Transportation (48-49)
    "51", "52", "53", "54", "55", "56", "61", "62", "71", "72", "81", "92",
];

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub code: String,
    pub title: String,
    pub level: i64,
    pub sector_code: String,
    pub sector_title: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CodeDetail {
    pub code: String,
    pub title: String,
    pub description: String,
    pub level: i64,
    pub sector_code: String,
    pub sector_title: String,
    pub subsector_code: String,
    pub subsector_title: String,
    pub industry_group_code: String,
    pub industry_group_title: String,
    pub industry_code: String,
    pub industry_title: String,
    /// SBA size threshold in millions of dollars (annual receipts), if any.
    pub sba_size_dollars: Option<f64>,
    /// SBA size threshold in number of employees, if any.
    pub sba_size_employees: Option<i64>,
    pub sba_footnote: Option<i64>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SectorEntry {
    pub code: String,
    /// Display code: "31-33" / "44-45" / "48-49" or the bare 2-digit code.
    pub display_code: String,
    pub title: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HierarchyNode {
    pub code: String,
    pub title: String,
    pub level: i64,
    pub child_count: i64,
}

fn open(db_path: &Path) -> Result<Connection, String> {
    Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("failed to open NAICS database: {e}"))
}

fn display_code(sector: &str) -> &str {
    match sector {
        "31" | "32" | "33" => "31-33",
        "44" | "45" => "44-45",
        "48" | "49" => "48-49",
        s => s,
    }
}

/// Browsing into a grouped sector ("31") should pull children for the whole
/// group ("31x", "32x", "33x"). Non-grouped codes use themselves.
fn child_prefixes(parent: &str) -> Vec<&str> {
    match parent {
        "31" => vec!["31", "32", "33"],
        "44" => vec!["44", "45"],
        "48" => vec!["48", "49"],
        _ => vec![parent],
    }
}

/// FTS5-safe MATCH builder. Tokens of length >= 2, each wrapped as a quoted
/// prefix term, ANDed together. Neutralizes user-supplied `*` / `:` / `"`.
fn make_fts_query(expanded: &str) -> String {
    expanded
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.chars().count() >= 2)
        .map(|t| format!("\"{t}\"*"))
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn search(db_path: &Path, query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let conn = open(db_path)?;
    let expanded = business_terms::expand(trimmed);
    let fts_query = make_fts_query(&expanded);
    let code_prefix = format!("{trimmed}%");
    let code_budget = limit.min(20) as i64;
    let fts_budget = limit.max(50) as i64;

    let mut seen: HashSet<String> = HashSet::new();
    let mut results: Vec<SearchResult> = Vec::with_capacity(limit);

    // 1. Code prefix matches. Shortest-first so parents appear before children.
    {
        let mut stmt = conn
            .prepare(
                "SELECT code, title, level, sector_code, sector_title \
                 FROM naics_codes \
                 WHERE code LIKE ?1 \
                 ORDER BY level, code \
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![code_prefix, code_budget], map_search_row)
            .map_err(|e| e.to_string())?;
        for row in rows {
            let r = row.map_err(|e| e.to_string())?;
            if seen.insert(r.code.clone()) {
                results.push(r);
            }
        }
    }

    // 2. FTS5 matches on title + description + activities.
    if !fts_query.is_empty() && results.len() < limit {
        let mut stmt = conn
            .prepare(
                "SELECT c.code, c.title, c.level, c.sector_code, c.sector_title \
                 FROM naics_fts f \
                 JOIN naics_codes c ON c.code = f.code \
                 WHERE naics_fts MATCH ?1 \
                 ORDER BY rank, c.level DESC, c.code \
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![fts_query, fts_budget], map_search_row)
            .map_err(|e| e.to_string())?;
        for row in rows {
            let r = row.map_err(|e| e.to_string())?;
            if seen.insert(r.code.clone()) {
                results.push(r);
                if results.len() >= limit {
                    break;
                }
            }
        }
    }

    Ok(results)
}

pub fn fetch_detail(db_path: &Path, code: &str) -> Result<Option<CodeDetail>, String> {
    let conn = open(db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT code, title, description, level, sector_code, sector_title, \
             subsector_code, subsector_title, industry_group_code, industry_group_title, \
             industry_code, industry_title, sba_size_dollars, sba_size_employees, sba_footnote \
             FROM naics_codes WHERE code = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(rusqlite::params![code], |row| {
            Ok(CodeDetail {
                code: row.get(0)?,
                title: row.get(1)?,
                description: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                level: row.get(3)?,
                sector_code: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                sector_title: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                subsector_code: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
                subsector_title: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                industry_group_code: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
                industry_group_title: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
                industry_code: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                industry_title: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
                sba_size_dollars: row.get::<_, Option<f64>>(12)?,
                sba_size_employees: row.get::<_, Option<i64>>(13)?,
                sba_footnote: row.get::<_, Option<i64>>(14)?,
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn fetch_activities(db_path: &Path, code: &str) -> Result<Vec<String>, String> {
    let conn = open(db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT activity FROM naics_index WHERE naics_code = ?1 ORDER BY activity",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![code], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn list_sectors(db_path: &Path) -> Result<Vec<SectorEntry>, String> {
    let conn = open(db_path)?;
    let mut stmt = conn
        .prepare("SELECT title FROM naics_codes WHERE code = ?1")
        .map_err(|e| e.to_string())?;
    let mut out: Vec<SectorEntry> = Vec::with_capacity(SECTOR_CODES.len());
    for code in SECTOR_CODES {
        let title: Option<String> = stmt
            .query_row(rusqlite::params![code], |row| row.get(0))
            .ok();
        if let Some(title) = title {
            out.push(SectorEntry {
                code: (*code).into(),
                display_code: display_code(code).into(),
                title,
            });
        }
    }
    Ok(out)
}

pub fn list_children(db_path: &Path, parent: &str) -> Result<Vec<HierarchyNode>, String> {
    let parent = parent.trim();
    if parent.is_empty() {
        return Ok(Vec::new());
    }
    let conn = open(db_path)?;
    let prefixes = child_prefixes(parent);
    let child_level = parent.chars().count() as i64 + 1;
    if !(3..=6).contains(&child_level) {
        return Ok(Vec::new());
    }

    let mut out: Vec<HierarchyNode> = Vec::new();
    let mut child_stmt = conn
        .prepare(
            "SELECT code, title, level FROM naics_codes \
             WHERE level = ?1 AND code LIKE ?2 ORDER BY code",
        )
        .map_err(|e| e.to_string())?;
    let mut count_stmt = conn
        .prepare("SELECT COUNT(*) FROM naics_codes WHERE level = ?1 AND code LIKE ?2")
        .map_err(|e| e.to_string())?;

    for prefix in prefixes {
        let fill = (child_level as usize).saturating_sub(prefix.chars().count());
        let like_pattern = format!("{prefix}{}", "_".repeat(fill));
        let rows = child_stmt
            .query_map(
                rusqlite::params![child_level, like_pattern],
                |row| -> rusqlite::Result<(String, String, i64)> {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
                },
            )
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (code, title, level) = row.map_err(|e| e.to_string())?;
            let child_count: i64 = if level >= 6 {
                0
            } else {
                count_stmt
                    .query_row(
                        rusqlite::params![level + 1, format!("{code}_")],
                        |row| row.get::<_, i64>(0),
                    )
                    .unwrap_or(0)
            };
            out.push(HierarchyNode {
                code,
                title,
                level,
                child_count,
            });
        }
    }
    Ok(out)
}

fn map_search_row(row: &rusqlite::Row) -> rusqlite::Result<SearchResult> {
    Ok(SearchResult {
        code: row.get(0)?,
        title: row.get(1)?,
        level: row.get(2)?,
        sector_code: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
        sector_title: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
    })
}
