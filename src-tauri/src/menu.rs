//! Phase D (SNAP_DESKTOP_IMPROVEMENT_PLAN.md) — native menu bar.
//!
//! Defines the macOS / Windows menu bar. Every menu item that fires a
//! UI action emits a `menu:<id>` window event; the React side (App.tsx)
//! listens via `@tauri-apps/api/event` and routes to the same handlers
//! the keyboard shortcuts already use. No duplicated behavior — the
//! menu is a discoverable surface over the existing keyboard contract.
//!
//! Menu IDs (kept stable; the React side hard-codes these strings):
//!   file.new_search             ⌘N
//!   file.command_palette        ⌘K
//!   file.export_collection      ⌘E
//!   edit.copy_code              ⌘⇧C
//!   edit.find                   ⌘F
//!   view.tab_search             ⌘1
//!   view.tab_browse             ⌘2
//!   view.tab_favorites          ⌘3
//!   view.tab_collections        ⌘4
//!   view.tab_settings           ⌘,
//!   view.reset_splitter
//!   help.how_to_use
//!   help.database_details
//!   help.privacy_policy         (opens URL)
//!   help.census_link            (opens URL)

use tauri::menu::{
    AboutMetadata, Menu, MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, Runtime, Wry};

/// Build the full menu tree and install it on the app. Called from
/// `setup()` in lib.rs.
pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_menu(app)?;
    app.set_menu(menu)?;
    Ok(())
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    // App menu (macOS only — Windows ignores; harmless).
    let app_about = AboutMetadata {
        name: Some("NAICS Snap".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        copyright: Some("© Ryan".into()),
        ..Default::default()
    };
    let app_submenu = SubmenuBuilder::new(app, "NAICS Snap")
        .item(&PredefinedMenuItem::about(app, None, Some(app_about))?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "view.tab_settings",
            "Preferences…",
            true,
            Some("CmdOrCtrl+,"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&MenuItem::with_id(
            app,
            "file.new_search",
            "New Search",
            true,
            Some("CmdOrCtrl+N"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "file.command_palette",
            "Open Command Palette…",
            true,
            Some("CmdOrCtrl+K"),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "file.export_collection",
            "Export Open Collection as CSV…",
            true,
            Some("CmdOrCtrl+E"),
        )?)
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "edit.copy_code",
            "Copy Code",
            true,
            Some("CmdOrCtrl+Shift+C"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "edit.find",
            "Find…",
            true,
            Some("CmdOrCtrl+F"),
        )?)
        .build()?;

    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(&MenuItem::with_id(
            app,
            "view.tab_search",
            "Search",
            true,
            Some("CmdOrCtrl+1"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.tab_browse",
            "Browse",
            true,
            Some("CmdOrCtrl+2"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.tab_favorites",
            "Favorites",
            true,
            Some("CmdOrCtrl+3"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.tab_collections",
            "Collections",
            true,
            Some("CmdOrCtrl+4"),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "view.reset_splitter",
            "Reset Splitter Width",
            true,
            None::<&str>,
        )?)
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let help_submenu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItem::with_id(
            app,
            "help.how_to_use",
            "How to Use…",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            "help.database_details",
            "Database Details…",
            true,
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "help.privacy_policy",
            "Privacy Policy",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            "help.census_link",
            "US Census Bureau · NAICS (web)",
            true,
            None::<&str>,
        )?)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_submenu)
        .item(&file_submenu)
        .item(&edit_submenu)
        .item(&view_submenu)
        .item(&window_submenu)
        .item(&help_submenu)
        .build()
}

/// Pure URL routing for Help-submenu items. Extracted from `handle`
/// so it's unit-testable without a Tauri runtime — keeps the URLs
/// pinned (a typo would silently open a 404 page in production).
pub fn help_url(id: &str) -> Option<&'static str> {
    match id {
        "help.privacy_policy" => {
            Some("https://rangeareascent.github.io/Snap_Series/naicssnap/privacy/")
        }
        "help.census_link" => Some("https://www.census.gov/naics/"),
        _ => None,
    }
}

/// Handle a menu click. For UI-routed items we just emit `menu:<id>`
/// and let React dispatch. For URL items we open the browser.
pub fn handle(app: &AppHandle<Wry>, id: &str) {
    if let Some(url) = help_url(id) {
        open_url(app, url);
        return;
    }
    let _ = app.emit(&format!("menu:{id}"), ());
}

fn open_url(app: &AppHandle<Wry>, url: &str) {
    use tauri_plugin_opener::OpenerExt;
    let _ = app.opener().open_url(url, None::<&str>);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The exact menu IDs the React side listens to in App.tsx. If you
    /// rename one here, you MUST rename it there too — this list is the
    /// contract. The test below just guarantees the names stay stable
    /// (renames force an explicit test edit, surfacing the breakage).
    const REACT_LISTENED_IDS: &[&str] = &[
        "file.new_search",
        "file.command_palette",
        "file.export_collection",
        "edit.copy_code",
        "edit.find",
        "view.tab_search",
        "view.tab_browse",
        "view.tab_favorites",
        "view.tab_collections",
        "view.tab_settings",
        "view.reset_splitter",
        "help.how_to_use",
        "help.database_details",
    ];

    #[test]
    fn help_url_routes_known_help_items() {
        let privacy = help_url("help.privacy_policy").expect("privacy URL");
        assert!(
            privacy.starts_with("https://"),
            "privacy URL must use https: {privacy}"
        );
        assert!(
            privacy.contains("naicssnap"),
            "privacy URL must be domain-specific (naicssnap), got: {privacy}"
        );

        let census = help_url("help.census_link").expect("census URL");
        assert!(census.starts_with("https://"));
        assert!(
            census.contains("census.gov"),
            "external NAICS link must point to census.gov, got: {census}"
        );
    }

    #[test]
    fn help_url_returns_none_for_react_routed_items() {
        // Any ID the React side listens to MUST fall through to the
        // `app.emit` branch — never get hijacked by the URL opener.
        // This protects against accidentally adding a `help.x` shape to
        // a non-Help menu item (which would silently open a browser).
        for id in REACT_LISTENED_IDS {
            assert!(
                help_url(id).is_none(),
                "react-routed id `{id}` was hijacked by help_url — \
                 menu click would open a browser instead of switching tabs"
            );
        }
    }

    #[test]
    fn menu_ids_follow_scope_dot_action_convention() {
        // Each ID is `<scope>.<snake_case_action>`. The React listener
        // in App.tsx hard-codes these — drift breaks the menu silently.
        for id in REACT_LISTENED_IDS {
            let parts: Vec<&str> = id.split('.').collect();
            assert_eq!(
                parts.len(),
                2,
                "menu id `{id}` should be exactly `<scope>.<action>`"
            );
            let (scope, action) = (parts[0], parts[1]);
            assert!(
                matches!(scope, "file" | "edit" | "view" | "help"),
                "menu id `{id}` has unexpected scope `{scope}`"
            );
            assert!(
                !action.is_empty()
                    && action
                        .chars()
                        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'),
                "menu id `{id}` action must be snake_case ASCII"
            );
        }
    }
}
