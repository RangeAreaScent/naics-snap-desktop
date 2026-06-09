mod business_terms;
mod license;
mod menu;
// `pub` so tests/naics_db_integration.rs can drive the data layer
// end-to-end against the bundled SQLite — see HANDOFF §14.
pub mod naics;
mod pdf;
mod store;

use std::path::PathBuf;
use tauri::Manager;

/// Resolved at startup so commands never have to re-resolve paths.
struct AppState {
    db_path: PathBuf,
    data_dir: PathBuf,
}

#[tauri::command]
fn search_codes(
    state: tauri::State<'_, AppState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<naics::SearchResult>, String> {
    naics::search(&state.db_path, &query, limit.unwrap_or(50))
}

#[tauri::command]
fn get_code_detail(
    state: tauri::State<'_, AppState>,
    code: String,
) -> Result<Option<naics::CodeDetail>, String> {
    naics::fetch_detail(&state.db_path, &code)
}

#[tauri::command]
fn get_code_activities(
    state: tauri::State<'_, AppState>,
    code: String,
) -> Result<Vec<String>, String> {
    naics::fetch_activities(&state.db_path, &code)
}

#[tauri::command]
fn list_sectors(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<naics::SectorEntry>, String> {
    naics::list_sectors(&state.db_path)
}

#[tauri::command]
fn list_children(
    state: tauri::State<'_, AppState>,
    parent: String,
) -> Result<Vec<naics::HierarchyNode>, String> {
    naics::list_children(&state.db_path, &parent)
}

#[tauri::command]
fn store_read(state: tauri::State<'_, AppState>, name: String) -> Result<Option<String>, String> {
    store::read(&state.data_dir, &name)
}

#[tauri::command]
fn store_write(
    state: tauri::State<'_, AppState>,
    name: String,
    content: String,
) -> Result<(), String> {
    store::write(&state.data_dir, &name, &content)
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("failed to write file: {e}"))
}

#[tauri::command]
fn export_pdf(
    path: String,
    title: String,
    entries: Vec<pdf::ExportEntry>,
) -> Result<(), String> {
    pdf::export(&path, &title, &entries)
}

#[tauri::command]
fn license_status(state: tauri::State<'_, AppState>) -> license::LicenseState {
    license::status(&state.data_dir)
}

#[tauri::command]
fn license_activate(
    state: tauri::State<'_, AppState>,
    key: String,
) -> Result<license::LicenseState, String> {
    license::activate(&state.data_dir, &key)
}

#[tauri::command]
fn license_validate(state: tauri::State<'_, AppState>) -> license::LicenseState {
    license::validate(&state.data_dir)
}

#[tauri::command]
fn license_deactivate(
    state: tauri::State<'_, AppState>,
) -> Result<license::LicenseState, String> {
    license::deactivate(&state.data_dir)
}

#[tauri::command]
fn license_toggle_override(
    state: tauri::State<'_, AppState>,
) -> Result<license::LicenseState, String> {
    license::toggle_override(&state.data_dir)
}

/// Best-effort crash log. On Windows the release build runs with
/// `windows_subsystem = "windows"` so panics and `eprintln!` are invisible —
/// without this, a startup failure looks to the user like "the app just
/// doesn't launch". We append to a stable path under the OS temp dir so
/// the user can read the failure even if normal app data dirs can't be
/// resolved.
fn write_crash_log(stage: &str, err: &str) {
    let mut path = std::env::temp_dir();
    path.push("naicssnap-startup.log");
    let line = format!(
        "[{}] {stage}: {err}\n",
        chrono_like_timestamp()
    );
    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .and_then(|mut f| std::io::Write::write_all(&mut f, line.as_bytes()));
}

/// Minimal ISO-8601-ish timestamp without pulling chrono into the dep tree.
/// "2026-05-24T00:21:08Z"-shape strings are enough for a crash log.
fn chrono_like_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("epoch-{secs}")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Catch and log any panic from anywhere in the app — including the Tauri
    // builder, the setup closure, and command handlers. The default hook
    // writes to stderr which is invisible on Windows release builds; this
    // hook also writes to a temp-dir log file the user can find.
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let msg = info
            .payload()
            .downcast_ref::<&str>()
            .copied()
            .or_else(|| info.payload().downcast_ref::<String>().map(|s| s.as_str()))
            .unwrap_or("(unknown panic payload)");
        let loc = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown location".into());
        write_crash_log("panic", &format!("{msg} @ {loc}"));
        prev(info);
    }));

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let db_path = app
                .path()
                .resolve(
                    "resources/naics_2022.sqlite",
                    tauri::path::BaseDirectory::Resource,
                )
                .map_err(|e| {
                    write_crash_log("resolve_db", &e.to_string());
                    e
                })?;
            let data_dir = app.path().app_data_dir().map_err(|e| {
                write_crash_log("app_data_dir", &e.to_string());
                e
            })?;
            app.manage(AppState { db_path, data_dir });
            if let Err(e) = menu::install(app.handle()) {
                write_crash_log("install_menu", &e.to_string());
                return Err(e.into());
            }
            Ok(())
        })
        .on_menu_event(|app, event| menu::handle(app, event.id().as_ref()))
        .invoke_handler(tauri::generate_handler![
            search_codes,
            get_code_detail,
            get_code_activities,
            list_sectors,
            list_children,
            store_read,
            store_write,
            write_text_file,
            export_pdf,
            license_status,
            license_activate,
            license_validate,
            license_deactivate,
            license_toggle_override
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        write_crash_log("tauri_run", &e.to_string());
        // Re-raise so the process exits with a non-zero code (helpful on CI
        // and from a terminal launch).
        panic!("tauri runtime error: {e}");
    }
}
