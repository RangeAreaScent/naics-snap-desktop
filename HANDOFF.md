# NAICS Snap Desktop — Handoff Document

<!-- snap-series:manager-block:start -->
- **App:** NAICS Snap
- **Platform:** desktop
- **Wave:** 1
- **Stage:** 3 release
- **Last updated:** 2026-05-31
- **Repo:** https://github.com/RangeAreaScent/naics-snap-desktop
- **Latest release:** v1.0.0-beta.1 (pre-release, published 2026-05-31)
- **Latest CI:** success on v1.0.0-beta.1
- **Bundle id:** com.ryan.naicssnap
- **Dataset:** `naics_2022.sqlite` (NAICS 2022, US Census Bureau), 2,129 rows, 6.7 MB, license: public domain (US Census)
- **Deviations from playbook:** none
- **Active blockers:**
  - Apple Developer cert not acquired → Mac DMG unsigned, Gatekeeper warning on other Macs
  - Windows code-signing cert not acquired → SmartScreen warning on install
  - Lemon Squeezy `product_id` check wired (Appendix B applied) but `EXPECTED_PRODUCT_ID = 0` → still a no-op until the real LS product id is filled in
- **Next 3 steps:**
  1. Run beta smoke test on Mac + Windows against the published v1.0.0-beta.1 pre-release
  2. Set `EXPECTED_PRODUCT_ID` in `src-tauri/src/license.rs` to the real Lemon Squeezy product id before cutting v1.0.0
  3. Promote to v1.0.0 (bump three version locations, tag, push, watch CI; build Mac DMG locally via `snap-release-mac`)
- **Report-back trigger:** any `v*` tag push, any commit touching `license.rs` / `tauri.conf.json` / `.github/workflows/`, any Lemon Squeezy milestone, any dataset swap, any SPEC change
<!-- snap-series:manager-block:end -->

> Last updated 2026-05-24. App version 1.0.0.
>
> Single-entry reference for picking up, maintaining, shipping, and extending
> NAICS Snap Desktop. Sections 1–6 first, then dip into the rest as needed.

---

## Table of contents

1. [What this is](#1-what-this-is)
2. [Tech stack](#2-tech-stack)
3. [Repository layout](#3-repository-layout)
4. [Prerequisites](#4-prerequisites)
5. [Running in development](#5-running-in-development)
6. [Building for distribution](#6-building-for-distribution)
7. [Architecture](#7-architecture)
8. [Feature map](#8-feature-map)
9. [Configuration](#9-configuration)
10. [Lemon Squeezy setup](#10-lemon-squeezy-setup)
11. [Updating the NAICS data (2027 and beyond)](#11-updating-the-naics-data)
12. [Maintenance recipes](#12-maintenance-recipes)
13. [Known gotchas](#13-known-gotchas)
14. [Testing](#14-testing)
15. [Command cheatsheet](#15-command-cheatsheet)
16. [Appendix A — Sample GitHub Actions CI](#appendix-a--sample-github-actions-ci)
17. [Appendix B — Hardening Lemon Squeezy (product_id check)](#appendix-b--hardening-lemon-squeezy)

---

## 1. What this is

NAICS Snap Desktop is a Mac + Windows desktop port of the existing **NAICS Snap**
iOS app — a fast, offline NAICS 2022 industry-code lookup tool. It shares no
code with the iOS app; the iOS source (sibling folder `NAICS-Snap/`) is the
product reference only. The port follows the exact same recipe as **ICD Snap
Desktop** (sibling folder `ICD Snap_mac_win_app/`), so most maintenance recipes
and gotchas carry over identically.

**Status as of handoff:** feature-complete. macOS (Apple Silicon) and Windows
build paths are wired up; PDF/CSV export, license activation, theme + font
settings, and the 5-tab shell all compile and the unit tests pass. Windows
packaging requires a Windows machine or CI (steps below).

**Core promise:** "Find any NAICS code in 2 seconds. No ads, no subscription,
works offline."

**Differentiation from the iOS app:**
- 5 tabs (Search · Browse · Favorites · Collections · Settings) instead of 5
  with the iOS layout — the desktop adds a sector-color browse experience
  optimized for a wider window.
- No alternate app icons (desktop icons are fixed at install time).
- Premium = 4 themes **plus** unlimited favorites/collections (the iOS app's
  premium was cosmetic-only; we add freemium capacity limits so premium is an
  honest productivity upsell).
- Monetization via **Lemon Squeezy license keys** with online activation, not
  App Store IAP. Same model as ICD Snap Desktop.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (Rust backend, system webview frontend) |
| UI | React 19 + TypeScript + Vite |
| Backend lang | Rust (stable, edition 2021) |
| Read-only NAICS data | `naics_2022.sqlite` (~6.7 MB), bundled as a Tauri resource; FTS5 full-text + a prefix index. Accessed from Rust via `rusqlite` with the `bundled` feature (compiles SQLite + FTS5 in-tree). |
| User data | Plain JSON files in the app data directory, written atomically (`store.rs`). |
| Search shortcuts | Static dictionary (~110 entries) in `business_terms.rs`, ported verbatim from the iOS app's `BusinessTerms.swift`. |
| Premium license | Lemon Squeezy license API (HTTP) via `ureq`. Online activate / validate / deactivate. Per-key device limit enforced by LS server-side. |
| Hidden override | Separate stored flag; toggled by the secret version-tap rhythm. Effective unlock = real license OR override. Mirrors the iOS `SecretTapDetector`. |
| PDF export | Native generation in Rust via `printpdf 0.8` (font subsetting). Bundled NanumGothic (SIL OFL 1.1) so Korean notes render correctly while keeping output small. |
| CSV export | Built in JS, written to a user-chosen path via Tauri's dialog plugin + a Rust `write_text_file` command. |
| Window zoom | `webview.setZoom()` for the text-size setting. |

---

## 3. Repository layout

```
NAICS Snap_Mac_Win_app/
├── HANDOFF.md                       ← this file
├── package.json                     ← npm scripts + frontend deps
├── tsconfig.json
├── vite.config.ts
├── index.html
├── app-icon-source.png              ← original NAICS Snap logo
├── app-icon-rounded.png             ← macOS-style rounded version (icon source)
├── public/fonts/                    ← woff2 web fonts (iA Writer Quattro)
├── src/                             ← React/TS frontend
│   ├── main.tsx                     ← React root + bundled font imports
│   ├── App.tsx                      ← Providers + 5-tab shell + premium modal
│   ├── state.tsx                    ← AppDataProvider (favorites, collections,
│   │                                    notes, freemium limits, prompt)
│   ├── settings.tsx                 ← SettingsProvider (theme, font, size, license)
│   ├── api.ts                       ← Tauri invoke wrappers
│   ├── export.ts                    ← CSV / PDF export drivers
│   ├── sectors.ts                   ← 20-sector palette + display-code + SBA format
│   ├── types.ts
│   ├── styles.css                   ← Theme variable blocks + all UI styles
│   └── components/
│       ├── SearchView.tsx
│       ├── BrowseView.tsx           ← 20 sectors → drilldown to 6-digit
│       ├── FavoritesView.tsx
│       ├── CollectionsView.tsx      ← list + detail + menu + export wiring
│       ├── CodeRow.tsx              ← (incl. left sector color bar)
│       ├── CodeDetailView.tsx       ← detail pane, copy buttons, activities, SBA, notes
│       ├── SettingsView.tsx         ← appearance, premium, data, about
│       ├── Modal.tsx
│       ├── AddToCollectionModal.tsx
│       ├── AddCodeModal.tsx
│       ├── CollectionFormModal.tsx  ← new / rename
│       └── PremiumPromptModal.tsx
└── src-tauri/                       ← Rust backend
    ├── Cargo.toml
    ├── tauri.conf.json              ← productName, identifier, bundle config
    ├── build.rs                     ← tauri-build
    ├── capabilities/default.json    ← webview permissions (dialog, opener, zoom)
    ├── icons/                       ← generated by `tauri icon`
    │   ├── icon.icns                ← macOS
    │   ├── icon.ico                 ← Windows
    │   └── *.png                    ← various sizes
    ├── resources/
    │   ├── naics_2022.sqlite        ← 6.7 MB bundled dataset
    │   └── fonts/
    │       ├── NanumGothic-Regular.ttf  ← embedded for CJK in PDF export
    │       ├── NanumGothic-Bold.ttf
    │       └── OFL.txt                  ← font license
    └── src/
        ├── main.rs                  ← thin entry; calls naicssnap_lib::run()
        ├── lib.rs                   ← Tauri builder, AppState, command list
        ├── naics.rs                 ← SQLite + FTS5 search / detail / activities / hierarchy
        ├── business_terms.rs        ← 110+ business-vocabulary shortcut expansions
        ├── store.rs                 ← atomic JSON document store
        ├── license.rs               ← Lemon Squeezy + hidden override layer
        └── pdf.rs                   ← collection → PDF (subsetting + CJK)
```

---

## 4. Prerequisites

### Common (all platforms)
- **Node.js 18+** (developed/tested on 24.15)
- **Rust stable** via [rustup](https://rustup.rs) (tested 1.95)
- **npm 9+**

### macOS
- **Xcode Command Line Tools** — `xcode-select --install`
- That's it. WebView (WKWebView) is part of the OS.

### Windows
- **Microsoft Visual Studio 2022 Build Tools** with the "Desktop development
  with C++" workload — provides the MSVC linker and C runtime that the Rust
  `x86_64-pc-windows-msvc` toolchain links against.
- **rustup** — the Windows installer defaults to the
  `x86_64-pc-windows-msvc` toolchain (what you want).
- **Node.js 18+** for Windows.
- **WebView2 Runtime** — preinstalled on Windows 11. On Windows 10 the
  Tauri installer will download it during install.

> **Cross-compiling Mac → Windows is not supported in practice.** Use a
> Windows machine, a VM, or GitHub Actions CI (Appendix A).

---

## 5. Running in development

```bash
# one-time
npm install

# every session
npm run tauri dev
```

Vite serves on `http://localhost:1420`, Rust compiles in dev mode, the
window opens. Frontend changes hot-reload; Rust changes trigger
recompile-and-relaunch on save.

**Devtools.** Right-click in the app → "Inspect Element".

**Logs.** Frontend: browser console. Rust: stdout of the
`npm run tauri dev` process.

**Stale port 1420.**
```bash
lsof -ti:1420 | xargs kill -9      # macOS / Linux
```
On Windows kill the node process via Task Manager.

---

## 6. Building for distribution

### 6.1 macOS — Apple Silicon

```bash
npm run tauri build
```

Output (`src-tauri/target/release/bundle/`):
- `macos/NAICS Snap.app` (~15 MB with the 6.7 MB DB inside)
- `dmg/NAICS Snap_1.0.0_aarch64.dmg`

### 6.2 macOS — Universal (Intel + Apple Silicon)

```bash
rustup target add x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

Output: `NAICS Snap_1.0.0_universal.dmg`. Fat Mach-O containing both
architectures. Use this for public distribution.

### 6.3 Windows

On a Windows machine that satisfies §4:

```cmd
git clone <repo>            REM or copy the project folder
cd "NAICS Snap_Mac_Win_app"
npm install
npm run tauri build
```

Output (`src-tauri\target\release\bundle\`):
- `msi\NAICS Snap_1.0.0_x64_en-US.msi`   ← MSI installer (recommended)
- `nsis\NAICS Snap_1.0.0_x64-setup.exe`  ← NSIS setup wizard

### 6.4 GitHub Actions CI (recommended for Windows)

See [Appendix A](#appendix-a--sample-github-actions-ci) for a ready-to-paste
`.github/workflows/build.yml`.

### 6.5 Code signing & notarization

Identical to ICD Snap Desktop. Set the standard env vars before
`npm run tauri build` on macOS:
```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
```
Windows code-signing certificate config goes in `tauri.conf.json` under
`bundle.windows.certificateThumbprint`.

---

## 7. Architecture

### 7.1 Backend (Rust)

The Rust crate is named `naicssnap`, with a `_lib` suffix on the library
(`naicssnap_lib`) — required for Windows lib/bin coexistence.

Modules in `src-tauri/src/`:

- **`main.rs`** — 4-line entry: `fn main() { naicssnap_lib::run() }`.
- **`lib.rs`** — Tauri `Builder`, `AppState` (resolved db_path + data_dir),
  command registration. Plugins: `tauri-plugin-opener`,
  `tauri-plugin-dialog`. Capability: `core:webview:allow-set-webview-zoom`
  so `setZoom()` works from JS.
- **`naics.rs`** — actor-style read-only SQLite access. Each command opens a
  fresh `Connection` with `SQLITE_OPEN_READ_ONLY | SQLITE_OPEN_NO_MUTEX`.
  Search is two-stage: code-prefix `LIKE` first, then FTS5 `MATCH` on
  `naics_fts(code, title, description, activities)`, deduped. Also exposes
  `fetch_detail`, `fetch_activities`, `list_sectors` (the 20 canonical
  sectors with grouped 31-33 / 44-45 / 48-49 collapsed), and `list_children`
  (hierarchy drilldown for Browse — handles grouped sectors by widening the
  child prefix set).
- **`business_terms.rs`** — `&[(&str, &str)]` constant + an `expand(query)`
  that tokenizes on non-alphanumerics and replaces uppercase tokens with
  the expansion phrase. Mirrors the iOS dictionary 1:1 — each value
  matches verbatim in at least one 2022 NAICS title/description/index entry.
- **`store.rs`** — `read(dir, name)` / `write(dir, name, content)`. Atomic
  write = write `<name>.json.tmp` → `rename` to `<name>.json`. Validates
  JSON before persisting so a crash can never leave a half-written file.
  (Identical to ICD Snap.)
- **`license.rs`** — Lemon Squeezy API client + override layer:
  - `status(dir)` — instant, no network. Stored license OR override.
  - `validate(dir)` — calls LS `/validate`. Network failure → grace period.
    Explicit invalid → lock. Then ORs override.
  - `activate(dir, key)` — LS `/activate`. Stores `{unlocked, key, instance_id}`.
  - `deactivate(dir)` — LS `/deactivate` + clears local license file.
  - `toggle_override(dir)` — flips `premium_override.json`.
  - Instance name reported to LS: `"NAICS Snap Desktop"`.
- **`pdf.rs`** — collection → PDF via `printpdf 0.8` (subsetted NanumGothic).
  Layout exports each entry as code (bold), title, optional note, and a
  pipe-separated meta line (Sector | Subsector | Group | Industry | SBA).
  CJK-aware text wrapping. Three unit tests guard format + subsetting.

### 7.2 Frontend (React / TypeScript)

- **`main.tsx`** — boots React, imports the bundled fonts:
  ```ts
  import "@fontsource-variable/inter";
  import "@fontsource/atkinson-hyperlegible/400.css";
  import "@fontsource/atkinson-hyperlegible/700.css";
  ```
- **`App.tsx`** — `<SettingsProvider><AppDataProvider>` →
  `<AppShell>` (5-tab rail + content + PremiumPromptModal). ⌘F / Ctrl+F
  jumps to Search.
- **`state.tsx` — AppDataProvider** — favorites, collections, notes, freemium
  limits (`favoritesMax`, `collectionsMax`), pending `premiumPrompt`.
  Internally uses `usePersistentState` (load once, persist on every change).
  Favorite/CollectionItem records carry `sectorCode`/`sectorTitle` so rows
  can render the colored bar offline without a DB round-trip.
- **`settings.tsx` — SettingsProvider** — theme, fontFamily, fontSize, and
  the license state. Settings persist together as one `settings.json`.
  Theme = `data-theme` attribute on `<html>`. Font family sets the
  `--ui-font` CSS variable. Text size calls `getCurrentWebview().setZoom()`.
- **`sectors.ts`** — port of `SectorPalette.swift`: per-sector hex colors,
  `sectorDisplayCode()` (31-33 / 44-45 / 48-49), `levelLabel()`,
  `formatSbaSize()` (dollars vs employees).
- **`api.ts`** — `searchCodes`, `getCodeDetail`, `getCodeActivities`,
  `listSectors`, `listChildren`, `storeRead`, `storeWrite`.
- **`export.ts`** — collection → CSV (built in JS, written via the dialog
  plugin + the `write_text_file` Rust command) or PDF (calls `export_pdf`).
  Both enrich items with fresh detail + the saved note before exporting.
  PDF payload uses snake_case field keys to match the Rust `ExportEntry`
  struct (no `#[serde(rename_all)]` on that struct).

### 7.3 IPC commands

| Command | Direction | Purpose | Inputs | Output |
|---|---|---|---|---|
| `search_codes` | JS → Rust | FTS5 + prefix search | `query`, `limit?` | `SearchResult[]` |
| `get_code_detail` | JS → Rust | Fetch full row by code | `code` | `CodeDetail \| null` |
| `get_code_activities` | JS → Rust | Index-file activity rows | `code` | `string[]` |
| `list_sectors` | JS → Rust | 20 canonical sectors | — | `SectorEntry[]` |
| `list_children` | JS → Rust | Hierarchy drilldown | `parent` | `HierarchyNode[]` |
| `store_read` | JS → Rust | Read a JSON doc | `name` | `string \| null` |
| `store_write` | JS → Rust | Atomically write a JSON doc | `name`, `content` | `()` |
| `write_text_file` | JS → Rust | Write text to a user-picked path | `path`, `content` | `()` |
| `export_pdf` | JS → Rust | Render a PDF from entries | `path`, `title`, `entries` | `()` |
| `license_status` | JS → Rust | Instant load (no network) | — | `LicenseState` |
| `license_activate` | JS → Rust | LS activate (online) | `key` | `LicenseState` |
| `license_validate` | JS → Rust | LS validate (online + grace) | — | `LicenseState` |
| `license_deactivate` | JS → Rust | LS deactivate + clear local | — | `LicenseState` |
| `license_toggle_override` | JS → Rust | Flip the hidden override | — | `LicenseState` |

### 7.4 Data persistence

User data lives in the OS-standard app data directory under
`com.ryan.naicssnap`:

- **macOS:** `~/Library/Application Support/com.ryan.naicssnap/`
- **Windows:** `%APPDATA%\com.ryan.naicssnap\`
- **Linux:** `~/.config/com.ryan.naicssnap/`

Files written:
- `favorites.json` — `Favorite[]`
- `collections.json` — `Collection[]` (each with `items[]`)
- `notes.json` — `Record<code, {text, editedAt}>`
- `settings.json` — `{theme, fontFamily, fontSize}`
- `license.json` — `{unlocked, key, instanceId}`
- `premium_override.json` — JSON bool (`true` / `false`)

The bundled SQLite DB is read-only at the Resource path; it never moves to
the user's data dir.

---

## 8. Feature map

| Feature | Frontend | Backend |
|---|---|---|
| Search | `components/SearchView.tsx` | `naics.rs::search` + `business_terms.rs` |
| Browse (sectors → drilldown) | `components/BrowseView.tsx` | `naics.rs::list_sectors`, `list_children` |
| Sector color bar / chip | `components/CodeRow.tsx`, `sectors.ts` | — |
| Code detail | `components/CodeDetailView.tsx` | `naics.rs::fetch_detail` + `fetch_activities` |
| SBA size standard | `CodeDetailView.tsx`, `sectors.ts::formatSbaSize` | `naics.rs` (in `CodeDetail`) |
| Copy buttons | `CodeDetailView.tsx` (`navigator.clipboard`) | — |
| Favorites | `components/FavoritesView.tsx`, `state.tsx` | `store.rs` (`favorites`) |
| Collections | `components/CollectionsView.tsx`, `state.tsx` | `store.rs` (`collections`) |
| Add code to collection | `AddToCollectionModal.tsx`, `AddCodeModal.tsx` | — |
| Notes | `CodeDetailView.tsx` (`NoteSection`), `state.tsx` | `store.rs` (`notes`) |
| CSV export | `export.ts`, `CollectionsView.tsx` menu | `write_text_file` |
| PDF export | `export.ts` | `pdf.rs` (`export_pdf`) |
| Themes | `settings.tsx`, `styles.css` `[data-theme]` blocks | — |
| Font family | `main.tsx` imports, `settings.tsx` `FONT_STACKS` | — |
| Text size | `settings.tsx` `ZOOM_FACTORS` (`webview.setZoom`) | — |
| Lemon Squeezy license | `SettingsView.tsx` `PremiumSection`, `settings.tsx` | `license.rs` |
| Freemium limits | `state.tsx` `FREE_FAVORITES_MAX`, `FREE_COLLECTIONS_MAX` | — |
| Premium prompt modal | `components/PremiumPromptModal.tsx`, `App.tsx` | — |
| Hidden rhythm | `SettingsView.tsx` `useSecretRhythm` + Version row | `license::toggle_override` |
| App icon | `src-tauri/icons/`, `app-icon-*.png` | — |

---

## 9. Configuration

Version is in three places — bump them together on a release:
- `src-tauri/Cargo.toml` — `version = "1.0.0"`
- `src-tauri/tauri.conf.json` — `"version": "1.0.0"`
- `package.json` — `"version": "1.0.0"`

Bundle identifier (`com.ryan.naicssnap`) and product name (`NAICS Snap`)
live in `src-tauri/tauri.conf.json`. **Don't change the identifier
post-launch** — it determines the app data directory path; changing it
would orphan existing users' favorites/collections/notes.

No secrets in the repo. The Lemon Squeezy license API endpoints are
unauthenticated (public, by design).

---

## 10. Lemon Squeezy setup

Identical recipe to ICD Snap Desktop. Once you create the LS product:

1. **Sign up** at <https://lemonsqueezy.com>.
2. **Create a Store** in the dashboard.
3. **Create a Product:**
   - Name: e.g. "NAICS Snap Premium"
   - Pricing: one-time, e.g. $4.99
   - **License Keys: enabled.** Activation limit: **2**.
4. **Test** with a test license key (Settings → Premium → paste → Activate).
   Each machine appears as an instance named "NAICS Snap Desktop" in the LS
   dashboard.
5. **Tighten validation** with a `product_id` check —
   see [Appendix B](#appendix-b--hardening-lemon-squeezy).
6. **Point users at the LS checkout URL** from the About section or
   marketing site.

API endpoints used (anonymous, no API key):
- `POST https://api.lemonsqueezy.com/v1/licenses/activate`
- `POST https://api.lemonsqueezy.com/v1/licenses/validate`
- `POST https://api.lemonsqueezy.com/v1/licenses/deactivate`

Offline / LS-down → grace period (stored state kept). Only an explicit
`valid: false` from LS locks premium.

---

## 11. Updating the NAICS data

NAICS revisions happen every 5 years. **Next revision: 2027.** When that
ships:

1. Run the iOS project's `data-pipeline/` to produce
   `naics_2027.sqlite`:
   ```bash
   cd ../NAICS-Snap/NAICS-Snap/data-pipeline
   # bump the 5 URLs in download.sh to the 2027 source files
   ./download.sh
   python3 build.py
   ```
2. Copy the new DB into `src-tauri/resources/naics_2027.sqlite`.
3. Update two paths:
   - `src-tauri/src/lib.rs` — the `app.path().resolve("resources/naics_2022.sqlite", ...)` call.
   - `src-tauri/tauri.conf.json` — `bundle.resources`.
4. Update copy in `src/components/SettingsView.tsx` (Data section: "NAICS
   Version" → "2027") and `src-tauri/src/pdf.rs` (the export header line:
   `NAICS 2022` → `NAICS 2027`).
5. Bump the app version (§9) and rebuild.

The current schema (`naics_codes` + `naics_index` + `naics_concordance` +
`naics_fts`) is what `naics.rs` expects. If the pipeline ever changes
column names, update the SELECTs in `naics.rs::fetch_detail` /
`map_search_row` to match — they're verbose on purpose for exactly this
reason.

Existing users' favorites/collections/notes survive a NAICS year bump —
they're keyed by NAICS code string. Codes that change between revisions
will still display (a future polish task: surface the concordance
mapping for changed codes; the iOS app already ships the `naics_concordance`
table, ready for a UI).

**SBA size standards** also drift independently (SBA publishes new
thresholds occasionally). Same flow: update `data-pipeline/download.sh`
to point at the new SBA XLSX, rebuild, copy DB, update the date label
in `SettingsView.tsx` ("SBA Size Standards · Effective …").

---

## 12. Maintenance recipes

### Change the free-tier limits
`src/state.tsx` — edit `FREE_FAVORITES_MAX` / `FREE_COLLECTIONS_MAX`.
Frontend-only; HMR picks it up. Also update the user-facing copy in
`src/components/SettingsView.tsx` ("Free plan: X / 15 favorites…") and
the prompt messages inside `state.tsx`.

### Add a new theme
1. `src/settings.tsx` — add to the `Theme` union, the `PREMIUM_THEMES` or
   `FREE_THEMES` array, and `THEME_LABELS`.
2. `src/styles.css` — add a `[data-theme="newname"] { --bg: ...; ... }`
   block. Keep all 18 CSS variables defined (`--bg`, `--pane`, `--pane-2`,
   `--border`, `--text`, `--text-dim`, `--text-faint`, `--accent`,
   `--accent-soft`, `--selected`, `--hover`, `--positive`, `--positive-bg`,
   `--warning`, `--warning-bg`, `--star`, `--shadow`).
3. `src/components/SettingsView.tsx` — add a `SWATCH` entry (two hex
   values: outer background and accent dot).

### Add a new font family
1. `npm install @fontsource/<font>` (or `@fontsource-variable/<font>`).
2. Import the CSS in `src/main.tsx`.
3. `src/settings.tsx` — add to `FontFamily` union, `FONT_FAMILIES`,
   `FONT_LABELS`, `FONT_STACKS`.
4. `src/components/SettingsView.tsx` — add a `FONT_PREVIEW` stack.

### Add a new business shortcut
`src-tauri/src/business_terms.rs` — add a `("ABBR", "expansion")` tuple to
`DICTIONARY`. Pick an expansion that appears verbatim in at least one
NAICS title/description/index entry, or add multiple variants.

### Tweak sector colors
`src/sectors.ts` — edit `SECTOR_COLORS`. Browse chips, code-row left bars,
and the Detail-screen hero bar all read from this map. Pick colors with
enough contrast against `--bg` in both light and dark themes (the iOS
notes from `SectorPalette.swift` are a good reference).

### Change zoom factors / add another text size
`src/settings.tsx` — `FontSize` union, `FONT_SIZES`, `FONT_SIZE_LABELS`,
`ZOOM_FACTORS`. The segmented control auto-renders the new option.

### Change the app icon
1. Replace `app-icon-source.png` or `app-icon-rounded.png` (keep both
   for future regeneration).
2. `npm run tauri icon app-icon-rounded.png` — overwrites `src-tauri/icons/*`.
3. **Touch `src-tauri/src/lib.rs`** (so `generate_context!` re-embeds the
   window icon — see Gotcha #1).
4. Rebuild.

### Disable the hidden rhythm in a shipping build
Remove the `onClick={secretTap}` attribute from the Version `<span>` in
`src/components/SettingsView.tsx`.

### Add a Lemon Squeezy `product_id` check
See [Appendix B](#appendix-b--hardening-lemon-squeezy).

---

## 13. Known gotchas

1. **Icon changes don't auto-rebuild `lib.rs`.** The window icon is embedded
   by `generate_context!` at compile time. Changing files in
   `src-tauri/icons/` doesn't change any `.rs` file, so cargo thinks nothing
   needs rebuilding. After `tauri icon`, `touch src-tauri/src/lib.rs`.

2. **Port 1420 lingers** sometimes after killing `tauri dev`. Vite's node
   child outlives the parent. `lsof -ti:1420 | xargs kill -9` on macOS;
   on Windows kill node via Task Manager.

3. **WKWebView (macOS) doesn't support `window.print()`.** That's why PDF
   export is implemented natively in Rust via `printpdf`. Don't be tempted
   to "simplify" by switching to webview print — it will silently no-op
   on Mac.

4. **macOS dock icon won't update in `tauri dev` without a lib.rs
   recompile.** Same root cause as #1. In packaged `.app` builds the icon
   comes from the embedded `.icns`, which is rebuilt every `tauri build`.

5. **Spaces in the project path.** The iCloud path contains spaces; most
   tools handle it but some need quoting. Always quote paths in shell
   commands.

6. **Silent crash on Windows release builds.** With
   `windows_subsystem = "windows"` set in `main.rs` (required to suppress
   the extra console window), every `panic!`, `.expect()`, and `eprintln!`
   from Rust goes to a void. The app appears to "not launch". `lib.rs`
   installs a global panic hook + wraps the `tauri::Builder` setup
   closure so all startup failures get appended to
   `%TEMP%\naicssnap-startup.log` (Windows) or `$TMPDIR/naicssnap-startup.log`
   (macOS / Linux). **Always check that file first** when a release build
   misbehaves silently. If you add panicky code anywhere in startup,
   keep it inside the `setup` closure or wrap it in `std::panic::catch_unwind`
   so the hook runs.

7. **Grouped sectors must use first-member code internally.** The 24 rows
   at level 2 in the DB (one per `sector_code`) include 31/32/33, 44/45,
   and 48/49 as separate entries with identical sector colors. The 20
   canonical sectors list lives in `naics.rs::SECTOR_CODES` and mirrors
   the iOS `SectorPalette.canonicalSectorCodes`. The Browse "Manufacturing"
   row uses `"31"` and its `list_children` widens to `["31","32","33"]`.
   Don't reduce these to a single literal — the DB doesn't store a
   `"31-33"` row.

8. **Premium override layering:** effective unlock is
   `real_license OR override`. The hidden rhythm toggles the override
   only, never the real license.

9. **printpdf 0.8 builtin font fallback** can't render non-Latin-1 chars.
   The current code always uses embedded NanumGothic (subsetted, tiny) so
   any input renders correctly. Don't switch back to builtins without a
   non-Latin detection fallback.

10. **PDF export payload uses snake_case keys.** `pdf::ExportEntry` has
    `#[derive(Deserialize)]` without `#[serde(rename_all)]`, so JS must
    send `industry_group` and `sba_size` (not camelCase). `src/export.ts`
    already does this; remember when adding new fields.

11. **Korean PDF size scales with unique Hangul characters.** Subsetting
    embeds only the glyphs used. A PDF with 200 unique Hangul chars is
    ~50 KB; 2000 unique chars ~200 KB. Still tiny vs. the unsubset 2 MB.

12. **Windows MSI default refuses to install older over newer.** The
    `bundle.windows.allowDowngrades: true` setting in `tauri.conf.json`
    flips this so hotfix rollbacks (and side-grade tests) just work.
    Don't remove it without also planning a roll-forward-only release
    discipline.

13. **WebView2 offline installer balloons the Windows MSI by ~150 MB.**
    `bundle.windows.webviewInstallMode: { type: "offlineInstaller" }`
    is the stability choice — installation works without an internet
    connection on any Win10/11. If installer size matters more than
    offline-install reliability, switch to `downloadBootstrapper`
    (~150 MB smaller, but the install will fail on an air-gapped Win10).

---

## 14. Testing

### Rust
```bash
cd src-tauri
cargo test --lib
```
Suite (in `src/pdf.rs`):
- `produces_a_valid_ascii_pdf` — generates an English PDF with page break,
  asserts `%PDF-` header + `%%EOF`.
- `produces_a_small_korean_pdf` — Korean content with em-dash, asserts
  file size < 400 KB (verifies subsetting actually happened).
- `wrap_handles_long_words_and_cjk` — word-wrap unit tests.

No tests for `naics.rs` / `license.rs` / `store.rs` yet — manual smoke
tests cover them. Adding a `naics.rs` integration test that opens the
bundled DB and runs a known query is a high-value next addition.

### Frontend
No automated tests yet. Components are decoupled (state vs. presentation)
so Vitest can be added incrementally.

### Windows stability test plan (run on a Windows machine after every release tag)

Cross-compiling from macOS is not viable; either run these on a real Windows
box (10 / 11), in a Parallels/UTM VM, or pull the artifact built by the CI
job (Appendix A) onto a Windows machine for testing. **Cover both clean and
upgrade scenarios** — silent upgrade failures are the #1 Windows-only bug
class for Tauri apps.

#### Install / upgrade
- [ ] **Clean install (Win 11 / WebView2 preinstalled)** — MSI from a path
      with spaces (e.g. `Downloads\NAICS Snap installer\`). Confirm Start
      menu shortcut + desktop icon exist after install.
- [ ] **Clean install (Win 10 21H2 without WebView2)** — installer should
      install WebView2 first without an internet connection (we ship the
      offline bootstrapper). If it asks for network, `webviewInstallMode`
      regressed.
- [ ] **Upgrade install** — install 1.0.0, then run the 1.0.1 MSI. App
      data in `%APPDATA%\com.ryan.naicssnap\` must survive. The
      `allowDowngrades: true` setting also lets you reinstall an older
      build over a newer one for hotfix rollback — verify both directions.
- [ ] **MSI + NSIS** — both installers ship from one build. Spot-check
      both. NSIS is friendlier for individual users; MSI is the
      enterprise / GPO-deployable option.
- [ ] **Per-user vs all-users** — default is per-user (no admin needed).
      Confirm no UAC prompt during install.

#### Runtime
- [ ] **First launch** — window appears within 2 seconds. If nothing
      happens, look in `%TEMP%\naicssnap-startup.log` — any panic from the
      Tauri builder / setup closure / command handlers is recorded there
      (the silent-crash log; see §13 gotcha #6).
- [ ] **App data path** — open `%APPDATA%\com.ryan.naicssnap\` after
      first use. `favorites.json` / `collections.json` / `notes.json` /
      `settings.json` appear here.
- [ ] **High DPI** — try a 4K monitor at 150% / 200% scaling. Text should
      render crisply; sector colorbars stay aligned with rows.
- [ ] **Multi-monitor** — drag the window between primary and secondary
      displays at different DPI; no visual glitches, settings/zoom persist.
- [ ] **Font fallback** — if the user picks "iA Writer Quattro" or
      "Atkinson Hyperlegible" without internet, the bundled woff2 files
      under `dist/assets/` and `dist/fonts/` should still render. (No CDN
      dependency by design.)
- [ ] **Locale** — switch Windows to a non-English locale (es-ES, ko-KR).
      `Intl.NumberFormat` calls in `sectors.ts::formatSbaSize` honor the
      user locale — verify "$34M annual receipts" still reads correctly
      under each locale; thousand separators may localize.
- [ ] **Long paths** — install to a path > 100 chars (e.g.
      `C:\Users\Test\Documents\Apps\NAICS Snap\…`). WebView2 has known
      issues with paths approaching `MAX_PATH = 260`. If it breaks here,
      Windows 10 long-path support (registry `LongPathsEnabled`) is the
      workaround documented for end users.

#### Per-feature smoke (same as Mac, but worth re-running)
- [ ] Search: "software" / "5415" / "SaaS" → results.
- [ ] Browse: 20 sectors render with colored chips; drill into 31-33;
      colors match Mac side-by-side (sanity-check sector palette).
- [ ] Detail: 541512 → SBA "$34M annual receipts" → 3 Copy buttons paste
      into Notepad correctly (line endings = CRLF).
- [ ] Favorite: ☆ → restart Windows → still ☆.
- [ ] Collection CSV export: open in Excel — Korean note text is intact
      (Excel sometimes mangles UTF-8 CSV; if so, ship a BOM by tweaking
      `export.ts` to prepend `﻿`).
- [ ] Collection PDF export: opens in Edge / Acrobat; Korean glyphs render.
- [ ] Premium hidden rhythm: tap-tap pause tap-tap pause tap-tap on
      "Version 1.0.0" → unlocks premium themes.
- [ ] License activation: paste a real LS key → activates → second machine
      activates → third refused. (Cannot be tested without a live LS
      product; see §10.)

#### Uninstall
- [ ] Uninstall via Settings → Apps → NAICS Snap (or Control Panel).
      `%APPDATA%\com.ryan.naicssnap\` is **intentionally preserved** so
      reinstalling restores favorites / collections / notes. Document
      this for users who want a true clean-slate uninstall (delete that
      folder manually).
- [ ] WebView2 is *not* removed — it's a shared OS component installed
      by other apps too. This is expected behavior.

#### Antivirus / SmartScreen
- [ ] **First-run SmartScreen warning is expected** when the build is
      unsigned. Users see "Windows protected your PC" → "More info" →
      "Run anyway". Mitigation: ship with a signing certificate (set
      `bundle.windows.certificateThumbprint` in `tauri.conf.json`, or
      provide signing via the GitHub Actions secrets). An EV certificate
      builds SmartScreen reputation fastest.
- [ ] **AV false positives** — Rust-compiled `.exe` files that bundle
      SQLite occasionally trip generic heuristics. Test on Windows
      Defender + a representative third-party AV (Bitdefender / Kaspersky)
      and submit a false-positive report if flagged.

---

### Manual smoke test (every release)
- [ ] Search: "software" / "5415" / "SaaS" — all return relevant results.
- [ ] Code detail: click `541512` → SBA "$34M annual receipts" badge
      visible → 3 copy buttons paste correctly → Examples of Activities
      list renders.
- [ ] Browse: 20 sectors render with colored chips → drill into 31-33 →
      see 32 (Wood Products etc.) under the manufacturing prefix family
      → drill all the way to a 6-digit → click → detail opens.
- [ ] Favorite: ☆ a code → switches state → appears in Favorites tab
      → survives app restart.
- [ ] Collection: create → add codes → ⋯ menu → CSV exports correctly
      (open in Numbers/Excel) → PDF exports correctly (open in Preview).
- [ ] Notes: add Korean text to a code's note → restart → still there →
      export PDF → Korean renders.
- [ ] Theme: pick each theme → UI updates → restart → persisted.
- [ ] Font: try each family + each size → restart → persisted.
- [ ] Premium hidden rhythm: tap-tap pause tap-tap pause tap-tap on
      "Version 1.0.0" → "Premium override toggled" flash → premium
      themes unlock.
- [ ] Free-tier limits: with override OFF, add 16th favorite → upsell
      modal. Try to create 11th collection → upsell modal. Existing
      data is not deleted.
- [ ] License: with the LS product live, paste a real key → Activate
      succeeds → second machine activates → third machine refused.

---

## 15. Command cheatsheet

```bash
# install (once)
npm install

# dev
npm run tauri dev

# release — macOS Apple Silicon
npm run tauri build

# release — macOS universal (Intel + ARM)
rustup target add x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin

# release — Windows (run on Windows)
npm run tauri build

# Rust tests
cd src-tauri && cargo test --lib

# regenerate app icons from a 1024×1024 PNG
npm run tauri icon app-icon-rounded.png
touch src-tauri/src/lib.rs   # force re-embed

# kill stuck dev server (macOS)
lsof -ti:1420 | xargs kill -9

# Mac signing env vars (before tauri build)
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
```

---

## Appendix A — Sample GitHub Actions CI

Save as `.github/workflows/build.yml`. Triggers on every push of a tag
matching `v*` and produces Mac + Windows artifacts attached to a draft
release.

```yaml
name: build

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: --target universal-apple-darwin
          - platform: windows-latest
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: setup node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: setup rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: cache cargo
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: install frontend deps
        run: npm ci

      - name: build with tauri
        uses: tauri-apps/tauri-action@v0
        env:
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          args: ${{ matrix.args }}
          tagName: ${{ github.ref_name }}
          releaseName: 'NAICS Snap ${{ github.ref_name }}'
          releaseDraft: true
```

---

## Appendix B — Hardening Lemon Squeezy

Once you have a real LS product, add a `product_id` check so license keys
from any other LS product in your account can't accidentally unlock NAICS
Snap.

In `src-tauri/src/license.rs`:

```rust
/// Replace 0 with the real product ID from your LS dashboard URL.
const EXPECTED_PRODUCT_ID: u64 = 0;

#[derive(Deserialize)]
struct ActivateResp {
    activated: bool,
    error: Option<String>,
    instance: Option<Instance>,
    meta: Option<Meta>,                  // <- add this
}

#[derive(Deserialize)]
struct ValidateResp {
    valid: bool,
    meta: Option<Meta>,                  // <- add this
}

#[derive(Deserialize)]
struct Meta {
    product_id: u64,
}

fn product_id_ok(meta: &Option<Meta>) -> bool {
    EXPECTED_PRODUCT_ID == 0
        || meta.as_ref().map(|m| m.product_id) == Some(EXPECTED_PRODUCT_ID)
}
```

Then in `activate`:
```rust
if !resp.activated || !product_id_ok(&resp.meta) {
    return Err(resp.error.unwrap_or_else(|| "This license key is not valid for NAICS Snap.".into()));
}
```

And in the validate path, treat a product_id mismatch as `valid: false`
(lock the app and clear the stored license).

Leaving `EXPECTED_PRODUCT_ID = 0` is the current state — the check is a
no-op and any LS key activates. Set it to the real number when ready.

---

*End of handoff.*
