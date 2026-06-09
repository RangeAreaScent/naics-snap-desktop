//! Integration test: bundled NAICS SQLite is queryable end-to-end.
//!
//! HANDOFF §14 flagged this as the high-value next test addition. With
//! Phase A~D wired up (keyboard nav, command palette, native menu), the
//! data layer underneath all of it is the same single set of `naics.rs`
//! queries. Breaking any of them (typo in a SQL string, schema drift on a
//! year refresh, busted `business_terms` expansion) would brick Search,
//! Browse, ⌘K — basically the whole app. This test catches that on every
//! CI / pre-tag run without needing a running webview.
//!
//! Run:  cargo test --test naics_db_integration
//!
//! The bundled DB is at `src-tauri/resources/naics_2022.sqlite`. We open
//! it via `CARGO_MANIFEST_DIR` so the test works under both
//! `cargo test` from `src-tauri/` and from the workspace root.

use std::path::PathBuf;

use naicssnap_lib::naics;

fn db_path() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("resources");
    p.push("naics_2022.sqlite");
    assert!(
        p.exists(),
        "bundled NAICS SQLite missing at {} — Phase A~D data layer can't run",
        p.display()
    );
    p
}

#[test]
fn search_by_industry_term_returns_results() {
    // "software" is the canonical smoke-test query in HANDOFF §14.
    let hits = naics::search(&db_path(), "software", 10).expect("search ok");
    assert!(!hits.is_empty(), "search('software') returned 0 rows");
    // Must surface 5415 (Computer Systems Design) or a 5112 (Software
    // Publishers) descendant in the top results.
    assert!(
        hits.iter()
            .any(|h| h.code.starts_with("5415") || h.code.starts_with("5112")),
        "expected 5415/5112 family in top 'software' hits, got: {:?}",
        hits.iter().map(|h| &h.code).collect::<Vec<_>>()
    );
}

#[test]
fn search_by_code_prefix_returns_descendants() {
    // Code-prefix path: "5415" must surface its descendants (the LIKE
    // branch in naics::search, not the FTS branch).
    let hits = naics::search(&db_path(), "5415", 20).expect("search ok");
    assert!(!hits.is_empty(), "code-prefix search('5415') returned 0");
    assert!(
        hits.iter().all(|h| h.code.starts_with("5415")),
        "code-prefix search('5415') leaked unrelated codes: {:?}",
        hits.iter()
            .filter(|h| !h.code.starts_with("5415"))
            .map(|h| &h.code)
            .collect::<Vec<_>>()
    );
}

#[test]
fn search_via_business_shortcut_expands() {
    // "SaaS" is a HANDOFF-documented shortcut in business_terms.rs. The
    // FTS query path must rewrite it to a phrase that hits a NAICS row.
    let hits = naics::search(&db_path(), "SaaS", 10).expect("search ok");
    assert!(
        !hits.is_empty(),
        "business shortcut 'SaaS' didn't expand to anything queryable"
    );
}

#[test]
fn fetch_detail_for_known_code_carries_hierarchy_and_sba() {
    // 541512 (Computer Systems Design Services) is the canonical detail
    // smoke-test target — HANDOFF §14 names it explicitly because it
    // also exercises the SBA size standard ("$34M annual receipts") that
    // the React detail pane renders.
    let d = naics::fetch_detail(&db_path(), "541512")
        .expect("fetch_detail ok")
        .expect("541512 must exist");

    assert_eq!(d.code, "541512");
    assert_eq!(d.level, 6, "541512 is a 6-digit national industry");
    assert!(!d.title.is_empty(), "title empty for 541512");
    assert_eq!(d.sector_code, "54", "541512 belongs to sector 54");
    assert!(!d.sector_title.is_empty(), "sector title empty");
    assert!(!d.industry_title.is_empty(), "industry title empty");
    // SBA size standard must be populated (HANDOFF mentions "$34M annual
    // receipts"). The exact threshold can drift on SBA revisions; we
    // only assert *something* is set so a future SBA refresh that drops
    // a value silently doesn't slip past CI.
    assert!(
        d.sba_size_dollars.is_some() || d.sba_size_employees.is_some(),
        "541512 lost its SBA size threshold"
    );
}

#[test]
fn fetch_detail_for_unknown_code_returns_none() {
    // Defensive — a malformed code must NOT crash, must return Ok(None).
    // The ⌘K command palette can race a delete with a jump request.
    let result = naics::fetch_detail(&db_path(), "999999")
        .expect("fetch_detail must not error on missing code");
    assert!(
        result.is_none(),
        "unknown code 999999 unexpectedly returned a detail row"
    );
}

#[test]
fn list_sectors_returns_canonical_twenty() {
    // The 20-sector canonical list collapses 31-33 / 44-45 / 48-49.
    // HANDOFF §13 gotcha #7: the DB has 24 level-2 rows but the public
    // surface must be exactly 20.
    let sectors = naics::list_sectors(&db_path()).expect("list_sectors ok");
    assert_eq!(
        sectors.len(),
        20,
        "expected 20 canonical sectors (grouped), got {}",
        sectors.len()
    );

    // Grouped display codes must appear; "32" / "45" / "49" must NOT
    // surface as separate rows.
    let display: Vec<&str> = sectors.iter().map(|s| s.display_code.as_str()).collect();
    assert!(
        display.contains(&"31-33"),
        "manufacturing not collapsed to 31-33: {:?}",
        display
    );
    assert!(
        display.contains(&"44-45"),
        "retail not collapsed to 44-45: {:?}",
        display
    );
    assert!(
        display.contains(&"48-49"),
        "transportation not collapsed to 48-49: {:?}",
        display
    );
    assert!(
        !display.contains(&"32"),
        "32 leaked as a standalone sector (Browse drilldown will be wrong)"
    );
}

#[test]
fn list_children_widens_grouped_sectors() {
    // HANDOFF §13 gotcha #7: drilling into "31" must widen to {31,32,33}.
    // Browse's first drilldown depends on this — if it regresses, the
    // Manufacturing sector looks empty.
    let kids = naics::list_children(&db_path(), "31").expect("list_children ok");
    assert!(
        !kids.is_empty(),
        "list_children('31') empty — grouped-sector widening regressed"
    );

    let prefixes: std::collections::HashSet<&str> =
        kids.iter().map(|k| &k.code[..2]).collect();
    // Must touch all three grouped prefixes, not just "31".
    assert!(
        prefixes.contains("31") && prefixes.contains("32") && prefixes.contains("33"),
        "expected children spanning 31/32/33, got prefixes: {:?}",
        prefixes
    );
}

#[test]
fn list_children_for_ungrouped_sector_stays_narrow() {
    // Sector 54 (Professional Services) is not grouped — children must
    // stay under "54".
    let kids = naics::list_children(&db_path(), "54").expect("list_children ok");
    assert!(!kids.is_empty(), "list_children('54') empty");
    assert!(
        kids.iter().all(|k| k.code.starts_with("54")),
        "non-grouped sector 54 leaked codes outside its prefix"
    );
}
