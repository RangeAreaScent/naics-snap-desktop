# Session Handoff — NAICS Snap Desktop

> **Purpose:** capture every piece of context from the chat session
> 2026-05-29 ~ 05-30 so a fresh Claude chat (or a future human) can pick
> up the work in 5 minutes without re-reading the conversation.
>
> Pair this with `HANDOFF.md` (project-level architecture/maintenance
> reference, 33k chars, written first). This file = "what state are
> we in right now and what's next." That file = "how does the codebase
> work."
>
> Last update: 2026-05-30 04:00 UTC.

---

## 0. TL;DR (30-second pickup)

1. **Project**: NAICS Snap Desktop — Tauri 2 + React 19 + TS desktop port of the iOS NAICS Snap app. Mirrors the architecture of ICD Snap Desktop (sibling folder).
2. **Local path**: `/Users/ryan/Library/Mobile Documents/com~apple~CloudDocs/App Projects/NAICS Snap_Mac_Win_app/`
3. **GitHub**: https://github.com/RangeAreaScent/naics-snap-desktop (PRIVATE) — owned by user `RangeAreaScent`.
4. **Tag in flight**: `v1.0.0-beta.1` (re-tagged 4 times in this session due to CI fixes).
5. **Build status (most recent)**: run ID `26673888500` was queued at 2026-05-30 03:58 UTC after an icon swap. Outcome unknown at time of writing — likely finishes ~04:08 UTC. Previous run `26656314271` was 100% green and produced a draft release with 4 assets.
6. **Code state**: frontend `npm run build` ✅, Rust `cargo check --lib` ✅, `cargo test --lib` 3/3 ✅. All work committed and pushed to `main`.
7. **Blocker / next action**: user-driven. Confirm build #4 green → download installers from draft release → manual Windows testing (HANDOFF §14) → either publish as prerelease or patch any bugs found.

---

## 1. The three project folders

The user has **three** related folders in `~/Library/Mobile Documents/com~apple~CloudDocs/App Projects/`:

| Folder | Role | What's in it |
|---|---|---|
| `NAICS-Snap/` | iOS source (product reference) | Xcode project, `data-pipeline/` for building the SQLite, `NAICS_Snap_Handoff.md` |
| **`NAICS Snap_Mac_Win_app/`** | ← **this project** (desktop port) | Tauri 2 / React 19 / TS source + `HANDOFF.md` + `SESSION_HANDOFF.md` (this file) |
| `ICD Snap_mac_win_app/` | Sibling desktop app (template / reference) | Same shape — we copied its architecture line-for-line, adapted to NAICS data |

The user also has a fourth relevant folder used for icon assets:

| Folder | Role |
|---|---|
| `SNAP Series Plan/Icons/naics-snap/` | Series master icon (cream + outlined NAICS). Currently used. |

---

## 2. What was built this session — full inventory

### 2.1 Frontend (`src/`)
- `main.tsx` — React root + font imports (Inter, Atkinson Hyperlegible).
- `App.tsx` — `<SettingsProvider><AppDataProvider>` + 5-tab rail (Search / Browse / Favorites / Collections / Settings) + ⌘F shortcut + premium modal mount.
- `state.tsx` — `AppDataProvider` (favorites, collections, notes, freemium caps, premium prompt). `usePersistentState` hook.
- `settings.tsx` — `SettingsProvider` (theme, font, fontSize, license). 7 themes, 4 fonts, 4 sizes.
- `api.ts` — Tauri invoke wrappers: `searchCodes`, `getCodeDetail`, `getCodeActivities`, `listSectors`, `listChildren`, `storeRead`, `storeWrite`.
- `export.ts` — CSV (JS) + PDF (Rust) export drivers. **PDF payload uses snake_case keys** to match the Rust `ExportEntry` struct (no `#[serde(rename_all)]` on it).
- `sectors.ts` — Port of `SectorPalette.swift`: 20-sector hex palette + `sectorDisplayCode()` + `levelLabel()` + `formatSbaSize()`.
- `types.ts` — Strict TS interfaces matching Rust serde shapes.
- `styles.css` — All theme variables (`[data-theme="…"]`), 18 CSS custom properties per theme, every UI component selector.
- `vite-env.d.ts` — `/// <reference types="vite/client" />`

### 2.2 Components (`src/components/`, 12 files)
- `SearchView.tsx`, `BrowseView.tsx` (20-sector drilldown), `FavoritesView.tsx`, `CollectionsView.tsx` (list + detail + menu + export), `CodeRow.tsx` (with sector color bar), `CodeDetailView.tsx` (SBA size, activities, hierarchy, notes), `SettingsView.tsx` (themes, fonts, premium, about, hidden tap rhythm).
- Modals: `Modal.tsx` (base), `AddCodeModal.tsx`, `AddToCollectionModal.tsx`, `CollectionFormModal.tsx`, `PremiumPromptModal.tsx`.

### 2.3 Rust backend (`src-tauri/src/`, 6 modules)
- `main.rs` — 4-line entry (`fn main() { naicssnap_lib::run() }`). Has `windows_subsystem = "windows"`.
- `lib.rs` — Tauri Builder + 14 IPC commands + `AppState` + **global panic hook + setup error logger writing to `<tempdir>/naicssnap-startup.log`**. (Crucial for Windows silent-crash diagnosis.)
- `naics.rs` — Read-only SQLite access. 2-stage search (code prefix + FTS5), `fetch_detail`, `fetch_activities`, `list_sectors`, `list_children` (with grouped-sector prefix widening for 31-33 / 44-45 / 48-49).
- `business_terms.rs` — 110+ business-vocabulary shortcuts ported from `BusinessTerms.swift`.
- `store.rs` — Atomic JSON document store (write → rename, JSON-validates before persist). Verbatim from ICD Snap.
- `license.rs` — Lemon Squeezy activate / validate / deactivate + override layer. Instance name: `"NAICS Snap Desktop"`.
- `pdf.rs` — Collection → PDF via printpdf 0.8 with subsetted NanumGothic (Korean glyph support, tiny output). 3 unit tests guard the format.

### 2.4 Bundled resources (`src-tauri/resources/`)
- `naics_2022.sqlite` (6.7 MB) — copied from iOS project `Data/naics_2022.sqlite`.
- `fonts/NanumGothic-Regular.ttf` + `-Bold.ttf` + `OFL.txt` — copied from ICD Snap desktop.

### 2.5 Web fonts (`public/fonts/`)
- `iAWriterQuattroS-Regular.woff2` + `-Bold.woff2` + license.

### 2.6 Icons (`src-tauri/icons/`, 19 files for macOS/Windows + iOS/Android variants)
- Generated by `npm run tauri icon app-icon-rounded.png`.
- **Currently the SNAP Series Plan master icon (cream + outlined NAICS + black "SNAP" block).**
- Source file `app-icon-rounded.png` SHA = `e36a820a3131026c63986409dba0a2a3c3fafc65` (this matches `SNAP Series Plan/Icons/naics-snap/naics-snap.png`).
- First build used the iOS playful icon (peach + "snap!" pill) — replaced in attempt #4.

### 2.7 Config / CI
- `package.json` — npm scripts + Tauri 2 / React 19 / Vite 7 / TS 5.8 deps.
- `vite.config.ts` — port 1420, `TAURI_DEV_HOST` support.
- `tsconfig.json` + `tsconfig.node.json` — strict, ES2020, bundler resolution, jsx react-jsx.
- `src-tauri/Cargo.toml` — crate `naicssnap` / lib `naicssnap_lib`, `panic = "abort"`, LTO release profile, deps: tauri 2, rusqlite (bundled), printpdf 0.8, ureq, serde.
- `src-tauri/tauri.conf.json` — bundle id `com.ryan.naicssnap`, product name `NAICS Snap`, **`webviewInstallMode: offlineInstaller`**, **`allowDowngrades: true`**, resources include the SQLite.
- `src-tauri/capabilities/default.json` — webview perms (dialog, opener, zoom).
- `.github/workflows/build.yml` — matrix Mac universal + Windows; uses `tauri-apps/tauri-action@v0`; **`permissions: contents: write`** for release uploads; signing env vars commented out (no certs yet); also includes a `check` job that runs on PRs but skips on release tags.

### 2.8 Documentation
- `HANDOFF.md` — 33k chars, project-level reference: architecture, IPC map, feature map, maintenance recipes, Windows test plan, gotchas, CI workflow appendix, Lemon Squeezy hardening appendix.
- `README.md` — quick start.
- **`SESSION_HANDOFF.md`** — this file.

---

## 3. CI build attempt history (decision log)

All builds on tag `v1.0.0-beta.1`, deleted and re-applied to each new commit.

| # | Run ID | Commit | Result | Failure | Fix |
|---|---|---|---|---|---|
| 1 | `26654684291` | `b624a09` (initial) | ❌ both jobs | Mac: empty `APPLE_SIGNING_IDENTITY` env → "specified item could not be found in the keychain" during codesign. Windows: bundles produced, then `GITHUB_TOKEN is required` upload error. | `fb3aa6f`: comment out signing env vars; add `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to env. |
| 2 | `26655631520` | `fb3aa6f` | ❌ (cancelled mid-run) | New error: `Resource not accessible by integration` from REST `/releases` endpoint — default `GITHUB_TOKEN` is `contents: read` only since 2022 hardening. | `ae5f473`: add `permissions: contents: write` at job level. |
| 3 | `26656314271` | `ae5f473` | ✅✅ both green | (none) | — |
| 4 | `26673888500` | `a908dad` | 🟡 in progress at handoff time | (rebuild — not a failure) | Icon swap: SNAP Series Plan master → `app-icon-{source,rounded}.png` + `tauri icon` regen + `touch src-tauri/src/lib.rs` to force `generate_context!` re-embed. |

### Draft release after run #3 (deleted before run #4)
- 4 assets uploaded:
  - `NAICS.Snap_1.0.0_universal.dmg` (Mac Intel+ARM)
  - `NAICS.Snap_1.0.0_x64_en-US.msi` (Win MSI)
  - `NAICS.Snap_1.0.0_x64-setup.exe` (Win NSIS)
  - `NAICS.Snap_universal.app.tar.gz` (raw .app archive)

The draft release **was deleted** via `gh release delete v1.0.0-beta.1 --yes --cleanup-tag` before run #4 so the new build could create a fresh one with the updated icon.

### Rate limit incident
Heavy use of `gh run watch` (polls every 2-3s) consumed all 5000 API requests/hour during runs #1-3. Reset at unix `1780082613` (UTC 2026-05-29 19:23). **Reminder for fresh chat: use `gh run view <id>` once instead of `gh run watch`, or just check the GitHub web UI.**

---

## 4. Decisions made (with rationale, locked unless explicitly revisited)

| Decision | Choice | Why |
|---|---|---|
| Tech stack | Tauri 2 + React 19 + TS | Mirrors ICD Snap Desktop. User wanted "stability first" + cross-platform Mac/Win. |
| Repo visibility | Private | User chose Private (Recommended). Beta testing first; license keys not in repo. |
| Repo name | `naics-snap-desktop` | User initially said `naics-snap-win` but renamed mid-session when realizing this is the same repo for Mac+Win builds (matrix). |
| Tag | `v1.0.0-beta.1` | Beta first, then v1.0.0 after Windows verification. |
| Code signing | Disabled (env vars commented out in CI) | No certs yet. SmartScreen warning on Win expected for now. Re-enable by uncommenting + adding repo secrets. |
| WebView2 install mode | `offlineInstaller` | Bundles WebView2 (+~150 MB). Works on air-gapped Win10. Stability > size. |
| `allowDowngrades` | `true` | Lets hotfix rollback work without manual uninstall. |
| Premium freemium model | 15 favorites / 10 collections cap, then upsell | Differentiates from iOS app where premium was cosmetic-only. |
| Themes | 7 (3 free + 4 premium) | Identical lineup to ICD Snap. Accent re-tinted to cooler blue (`#0a66c2`) because NAICS already has loud sector colors. |
| Browse tab | New (NAICS-specific, not in ICD) | Sector → subsector → industry group → industry → national industry drilldown. Grouped sectors (31-33, 44-45, 48-49) collapse to single rows in `naics.rs::SECTOR_CODES`. |
| Icon | SNAP Series Plan master (cream + outlined NAICS) | Series consistency. Replaces iOS-playful peach version. |
| Startup panic logging | `<tempdir>/naicssnap-startup.log` | Mitigates Windows silent-crash (`windows_subsystem = "windows"` hides stderr). |
| PDF i18n | Always embed subsetted NanumGothic | iOS WKWebView can't `window.print()`; built natively. Korean notes render correctly with negligible size overhead. |

---

## 5. Open items / immediate next steps (priority order)

### 5.1 Confirm run #4 result
- Browser: https://github.com/RangeAreaScent/naics-snap-desktop/actions/runs/26673888500
- Or terminal (after API rate-limit recovery): `gh run view 26673888500`
- Both green → proceed to 5.2. Any red → diagnose with `gh run view --job <id> --log-failed | tail -50`.

### 5.2 Visual icon verification
- After run #4, the draft release will have updated assets.
- Download `NAICS.Snap_1.0.0_universal.dmg`, mount, look at the .app icon in Finder. Should be the cream/outlined version, not peach.
- Also look at the icon in the running window's dock / taskbar.

### 5.3 Manual Windows testing
- Download `NAICS.Snap_1.0.0_x64_en-US.msi` (or NSIS .exe).
- On a Windows 10/11 machine (or VM), run `HANDOFF.md §14 — Windows stability test plan` checklist:
  - Clean install / upgrade / per-user vs all-users
  - First launch (< 2s window appears; if not, check `%TEMP%\naicssnap-startup.log`)
  - High DPI on a 4K monitor
  - Long install path (> 100 chars)
  - Locale (es-ES / ko-KR)
  - All 5 tabs functional
  - PDF export with Korean characters
  - Premium hidden rhythm (6-tap on version)
  - Uninstall preserves `%APPDATA%\com.ryan.naicssnap\`
  - SmartScreen "More info → Run anyway" expected on first launch (unsigned)

### 5.4 Publish decision
Three options, pick one:
- **A. Keep draft, iterate on bugs** — if Windows testing reveals issues, fix and retag without publishing.
- **B. Publish as pre-release** — `gh release edit v1.0.0-beta.1 --draft=false --prerelease`. Anyone with repo access can download. Good for distributing to friendly testers.
- **C. Skip beta, ship v1.0.0** — only if Windows test is 100% clean and you don't need external testers. Re-tag `v1.0.0` (drop `-beta.1`).

### 5.5 Lemon Squeezy product creation (when ready to monetize)
See `HANDOFF.md §10`. Activation limit 2 per key, $4.99 one-time. Then optionally tighten with `product_id` check (Appendix B).

### 5.6 Code signing (deferred)
For v1.0.0 final, get:
- macOS: Apple Developer Program ($99/yr) → Developer ID Application cert → set 4 secrets (`APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`). Uncomment the env block in `.github/workflows/build.yml`.
- Windows: Sectigo / DigiCert code-sign cert (~$60-300/yr). Add `bundle.windows.certificateThumbprint` to `tauri.conf.json`.

Without these, SmartScreen / Gatekeeper warn users on first launch. Functional, just scary.

---

## 6. Useful commands cheatsheet

### Development (local, on this Mac)
```bash
cd "/Users/ryan/Library/Mobile Documents/com~apple~CloudDocs/App Projects/NAICS Snap_Mac_Win_app"

# Run dev (Vite + Tauri together)
npm run tauri dev

# Build locally (Mac Apple Silicon)
npm run tauri build

# Build Mac universal
rustup target add x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin

# Run tests
cd src-tauri && cargo test --lib

# Frontend-only check
npm run build

# Sourcing cargo if it's not on PATH
. ~/.cargo/env
```

### Git / GitHub
```bash
# Check current state
git log --oneline -10
git status

# Re-tag (if a CI fix requires a rebuild on same version)
git tag -d v1.0.0-beta.1
git push origin :refs/tags/v1.0.0-beta.1
git tag -a v1.0.0-beta.1 -m "<msg>"
git push origin v1.0.0-beta.1

# Inspect a workflow run (uses 1 API call vs gh run watch which uses many)
gh run view 26673888500
gh run view --job <job-id> --log-failed | tail -50

# Check rate limit before any gh call (free, doesn't count)
gh api rate_limit --jq '.resources.core'

# Release management
gh release view v1.0.0-beta.1
gh release list
gh release edit v1.0.0-beta.1 --draft=false --prerelease
gh release delete v1.0.0-beta.1 --yes --cleanup-tag    # CAUTION: deletes the tag too
```

### Icon refresh (if changing icon again)
```bash
cp "<new icon>.png" app-icon-source.png
cp "<new icon>.png" app-icon-rounded.png
npm run tauri icon app-icon-rounded.png
touch src-tauri/src/lib.rs   # CRITICAL — forces generate_context! re-embed
git add -A
git commit -m "chore(icons): <reason>"
# then retag + push tag
```

---

## 7. Things I would have asked next if context wasn't capped

(Listed so a fresh chat can ask the user these efficiently.)

1. Does the run #4 icon match what you expected (cream + outlined NAICS)?
2. Do you have a Windows machine / VM ready for testing, or should we keep the build as a downloadable artifact and you test later?
3. After testing passes, publish v1.0.0-beta.1 as pre-release, or jump straight to v1.0.0?
4. Are you planning to set up Lemon Squeezy before public release, or ship without monetization at first?
5. Apple Developer Program signing — set up now for v1.0.0, or after some initial user feedback?

---

## 8. Known minor things / future polish

- `.github/workflows/build.yml` `check` job uses Node 20; GitHub deprecated Node 20 in Sep 2025 and will force-migrate June 2026. Move to Node 24 in `actions/setup-node@v4` `node-version: 24` before then.
- No frontend automated tests yet. Components are decoupled, so Vitest can be added incrementally. Worth doing once the app stabilizes.
- No `naics.rs` integration test that actually opens the bundled DB. High-value addition (would catch schema regressions in CI).
- `naics_concordance` (2017→2022 NAICS mapping) is in the DB but unused. Future "deprecated code mapping" feature could surface it.
- iCloud path with spaces — works fine but worth double-quoting in any shell snippet.
- Windows MSI is ~155 MB because of WebView2 bundling. NSIS .exe is smaller. Re-evaluate `downloadBootstrapper` if size becomes a complaint (would require an internet connection at install time on Win10 without WebView2).

---

## 9. Quick directory inventory

```
NAICS Snap_Mac_Win_app/
├── .git/                            ← initialized this session
├── .github/workflows/build.yml      ← CI: Mac universal + Windows
├── .gitignore                       ← node_modules, dist, src-tauri/{target,gen}
├── HANDOFF.md                       ← project reference (33k chars)
├── SESSION_HANDOFF.md               ← this file
├── README.md
├── app-icon-source.png              ← series master (cream/outlined)
├── app-icon-rounded.png             ← same as source (1024×1024)
├── index.html                       ← Vite entry
├── package.json / package-lock.json
├── tsconfig.json / tsconfig.node.json
├── vite.config.ts
├── public/fonts/                    ← iA Writer Quattro woff2 + license
├── src/                             ← React/TS (10 files)
│   ├── App.tsx
│   ├── api.ts
│   ├── export.ts
│   ├── main.tsx
│   ├── sectors.ts                   ← 20-sector palette + display-code + SBA format
│   ├── settings.tsx
│   ├── state.tsx
│   ├── styles.css                   ← all theme blocks
│   ├── types.ts
│   ├── vite-env.d.ts
│   └── components/                  ← 12 components
├── src-tauri/
│   ├── Cargo.toml / Cargo.lock      ← Cargo.lock IS committed (binary crate)
│   ├── build.rs
│   ├── tauri.conf.json              ← bundle id, WebView2 offline installer, allowDowngrades
│   ├── capabilities/default.json
│   ├── icons/                       ← 19 sizes/formats, regenerated by `tauri icon`
│   ├── resources/
│   │   ├── naics_2022.sqlite        ← 6.7 MB bundled DB
│   │   └── fonts/                   ← NanumGothic-Regular/Bold.ttf + OFL.txt
│   └── src/                         ← Rust (6 modules + main.rs)
│       ├── main.rs
│       ├── lib.rs                   ← Tauri Builder, panic hook, IPC commands
│       ├── naics.rs                 ← SQLite + FTS5 search/detail/hierarchy
│       ├── business_terms.rs        ← 110+ business shortcuts
│       ├── store.rs                 ← atomic JSON store
│       ├── license.rs               ← Lemon Squeezy
│       └── pdf.rs                   ← collection → PDF with subsetted CJK
└── (gitignored: node_modules/, dist/, src-tauri/target/, src-tauri/gen/)
```

---

## 10. Git history snapshot at handoff

```
a908dad  chore(icons): swap to SNAP Series Plan master (cream / outlined NAICS)
ae5f473  ci: grant contents:write so tauri-action can create the draft release
fb3aa6f  ci: fix release upload (pass GITHUB_TOKEN; skip empty-cert codesign)
b624a09  Initial commit — NAICS Snap Desktop v1.0.0
```

Branch: `main` (only branch).
Remote: `origin = https://github.com/RangeAreaScent/naics-snap-desktop.git`.

Tags pushed (only one):
- `v1.0.0-beta.1` → currently points at `a908dad`.

---

## 11. How a fresh chat should start

> "Read `SESSION_HANDOFF.md` first, then `HANDOFF.md` §0-6. Then check
> the GitHub Actions run page for the latest build status. After that
> you'll know what to do next."

Specifically:
1. `cd "/Users/ryan/Library/Mobile Documents/com~apple~CloudDocs/App Projects/NAICS Snap_Mac_Win_app"`
2. `cat SESSION_HANDOFF.md` (this file)
3. Open https://github.com/RangeAreaScent/naics-snap-desktop/actions in browser to see build #4 status.
4. If build is green: `gh release view v1.0.0-beta.1` to see the draft + assets.
5. If build is red: `gh run view 26673888500 --log-failed | tail -50` and patch.

---

*End of session handoff. The detailed project reference continues in `HANDOFF.md`.*
