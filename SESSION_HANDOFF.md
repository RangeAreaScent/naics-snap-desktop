# Session Handoff — NAICS Snap Desktop

> **Purpose:** capture every piece of context from the chat session
> 2026-05-29 ~ 05-30 so a fresh Claude chat (or a future human) can pick
> up the work in 5 minutes without re-reading the conversation.
>
> Read order:
>
> 1. `HANDOFF.md` top of file — `<!-- snap-series:manager-block -->` is the
>    canonical "where are we right now" block, maintained as part of the
>    user's series-wide tracker.
> 2. This file — session-level operational detail (CI history,
>    incidents, commands used) that doesn't belong in the manager block.
> 3. Rest of `HANDOFF.md` — project architecture / maintenance reference.
>
> Last refresh: 2026-05-30 (after CI Win-only switch).

---

## 0. TL;DR (30-second pickup)

- **Project:** NAICS Snap Desktop — Tauri 2 + React 19 + TS port of the iOS NAICS Snap app. Mirrors ICD Snap Desktop's architecture.
- **Local path:** `/Users/ryan/Library/Mobile Documents/com~apple~CloudDocs/App Projects/NAICS Snap_Mac_Win_app/`
- **Repo (private):** https://github.com/RangeAreaScent/naics-snap-desktop
- **Latest release:** `v1.0.0-beta.1` (draft, with 4 assets: Mac universal DMG, Mac .app.tar.gz, Win MSI, Win NSIS .exe).
- **Latest CI:** ✅ success on run `26673888500` (icon swap, 2026-05-30 03:58 UTC, 7m11s). All earlier failures were CI-config issues, not code.
- **Build topology (current):** **Windows is CI**, **Mac is local** (built on this dev Mac via the user's `snap-release-mac` helper, uploaded manually to the same draft release). Switched mid-session in commit `870d9b3`.
- **Next 3 steps (per HANDOFF manager-block):**
  1. Publish the v1.0.0-beta.1 draft and run beta smoke test on Mac + Windows.
  2. Apply the Lemon Squeezy `product_id` check (HANDOFF Appendix B).
  3. Promote to v1.0.0 (bump version in 3 places, tag, push, watch CI).
- **Active blockers:** Apple Developer cert, Windows code-sign cert, and LS `product_id` no-op — all known and documented in the manager-block.

---

## 1. The folder layout (relevant to this project)

```
~/Library/Mobile Documents/com~apple~CloudDocs/App Projects/
├── NAICS-Snap/                       ← iOS source (product reference, not built here)
│   ├── NAICS-Snap/NAICSSnap/Data/naics_2022.sqlite  (source for the bundled DB)
│   ├── Icons/                        (iOS-playful icons, NOT used anymore)
│   └── NAICS_Snap_Handoff.md
├── NAICS Snap_Mac_Win_app/          ← *** THIS PROJECT (desktop port) ***
├── ICD Snap_mac_win_app/             ← sibling template; architecture twin
└── SNAP Series Plan/Icons/naics-snap/  ← series master icon (currently shipped)
```

Inside `NAICS Snap_Mac_Win_app/`:

```
├── .github/workflows/build.yml      ← CI: Windows-only since 870d9b3
├── HANDOFF.md                       ← project ref (33k+ chars) with manager-block header
├── SESSION_HANDOFF.md               ← this file
├── README.md
├── app-icon-source.png              ← series master (cream / outlined NAICS / black SNAP)
├── app-icon-rounded.png             ← same source, same SHA e36a820a…
├── public/fonts/                    ← iA Writer Quattro woff2
├── src/                             ← 10 frontend files + components/ (12 files)
├── src-tauri/
│   ├── Cargo.toml / .lock           ← Cargo.lock IS committed (binary crate)
│   ├── tauri.conf.json              ← bundle id com.ryan.naicssnap, offlineInstaller, allowDowngrades
│   ├── icons/                       ← 19 sizes + iOS/Android variants (regen via `tauri icon`)
│   ├── capabilities/default.json
│   ├── resources/
│   │   ├── naics_2022.sqlite        ← 6.7 MB
│   │   └── fonts/NanumGothic-{Regular,Bold}.ttf + OFL.txt
│   └── src/                         ← main.rs + 6 modules
└── (gitignored: node_modules/, dist/, src-tauri/target/, src-tauri/gen/)
```

---

## 2. What was built this session — inventory by area

### Frontend (`src/`)
- `main.tsx` (React root + font imports), `App.tsx` (5-tab shell + ⌘F), `state.tsx` (AppDataProvider), `settings.tsx` (theme/font/license, 7 themes / 4 fonts / 4 sizes), `api.ts` (Tauri invokes), `export.ts` (CSV + PDF), `sectors.ts` (20-sector palette + display-code + SBA format), `types.ts`, `styles.css` (all theme blocks), `vite-env.d.ts`.

### Components (`src/components/`, 12 files)
- Views: `SearchView`, `BrowseView` (NAICS-specific drilldown), `FavoritesView`, `CollectionsView`, `CodeRow`, `CodeDetailView`, `SettingsView`.
- Modals: `Modal`, `AddCodeModal`, `AddToCollectionModal`, `CollectionFormModal`, `PremiumPromptModal`.

### Rust backend (`src-tauri/src/`, 6 modules)
- `main.rs` (4-line entry, `windows_subsystem = "windows"`).
- `lib.rs` (Tauri Builder + 14 IPC commands + **global panic hook → `<tempdir>/naicssnap-startup.log`** for Windows silent-crash diagnosis).
- `naics.rs` (read-only SQLite, 2-stage code+FTS5 search, hierarchy, grouped-sector prefix widening).
- `business_terms.rs` (110+ business shortcuts: SaaS / 3PL / HVAC / B2B / …).
- `store.rs` (atomic JSON store, verbatim from ICD Snap).
- `license.rs` (Lemon Squeezy activate/validate/deactivate + override; instance name `"NAICS Snap Desktop"`).
- `pdf.rs` (collection → PDF via printpdf 0.8 with subsetted NanumGothic; 3 unit tests pass).

### Resources, fonts, icons
- `src-tauri/resources/naics_2022.sqlite` (copied from iOS project).
- `src-tauri/resources/fonts/NanumGothic-{Regular,Bold}.ttf` + `OFL.txt` (copied from ICD Snap desktop).
- `public/fonts/iAWriterQuattroS-{Regular,Bold}.woff2` + license.
- `app-icon-source.png` + `app-icon-rounded.png` + `src-tauri/icons/*` (19 sizes / variants). **Currently the SNAP Series Plan master** (`SNAP Series Plan/Icons/naics-snap/naics-snap.png`, SHA `e36a820a…`). The iOS-playful peach icon was used for runs #1–#3 then replaced for run #4.

### Config / CI
- `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `.gitignore`.
- `src-tauri/Cargo.toml` (crate `naicssnap`, lib `naicssnap_lib`, panic=abort, LTO).
- `src-tauri/tauri.conf.json` — bundle id `com.ryan.naicssnap`, `webviewInstallMode: offlineInstaller`, `allowDowngrades: true`, SQLite as a resource.
- `src-tauri/capabilities/default.json` — webview perms (dialog, opener, zoom).
- `.github/workflows/build.yml` — **Windows-only** matrix since `870d9b3`. `permissions: contents: write`. Signing env block commented out (no certs yet).

---

## 3. CI build attempt history (decision log)

All builds tagged `v1.0.0-beta.1` (tag re-applied on each new commit).

| # | Run ID | Commit | Result | Failure | Fix |
|---|---|---|---|---|---|
| 1 | `26654684291` | `b624a09` (initial) | ❌ both jobs | Mac: empty `APPLE_SIGNING_IDENTITY` env → keychain error during codesign. Windows: bundles produced, then `GITHUB_TOKEN is required` on upload. | `fb3aa6f`: comment out signing env vars; add `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to env. |
| 2 | `26655631520` | `fb3aa6f` | ❌ (cancelled mid-run) | `Resource not accessible by integration` from `/releases` REST endpoint — default `GITHUB_TOKEN` is `contents: read` since 2022. | `ae5f473`: add `permissions: contents: write` at job level. |
| 3 | `26656314271` | `ae5f473` | ✅ Mac + Win green | — | First clean release: DMG + MSI + NSIS + .app.tar.gz uploaded to draft. Release deleted before run #4 (icon swap). |
| 4 | `26673888500` | `a908dad` (icon swap) | ✅ Mac + Win green, **7m 11s** | — | Cargo cache hit cut build time dramatically. Current draft release sourced from this run. |

After run #4, user committed `870d9b3` (CI → Windows-only) and `641bcc6` (Snap Series manager-block in HANDOFF.md). **Both are post-build**, so the currently-uploaded Mac DMG was produced by CI before the Mac job was removed. Future tag pushes will only build Windows; Mac DMG must be produced locally (helper: `snap-release-mac <tag>`).

### Rate-limit incident
Heavy use of `gh run watch` (polls every 2-3s) burned the 5000/hr API budget during runs #1-#3. Reset takes ~17 min once hit. **Use `gh run view <id>` once (1 call) or the GitHub web UI; avoid `gh run watch` unless rate-limit headroom is high.**

---

## 4. Decisions made (locked unless explicitly revisited)

| Decision | Choice | Why |
|---|---|---|
| Tech stack | Tauri 2 + React 19 + TS | Mirrors ICD Snap Desktop. User wanted stability + Mac/Win cross-platform. |
| Repo | Private, `naics-snap-desktop` | User picked Private (Recommended). Renamed mid-session from `-win` once realizing it builds both OSes. |
| Tag | `v1.0.0-beta.1` | Beta first, then v1.0.0 after Win verification. |
| Code signing | Off (env vars commented out) | No certs yet. Beta users see SmartScreen "More info → Run anyway" / Gatekeeper warning. |
| WebView2 install mode | `offlineInstaller` | Bundles WebView2 (+~150 MB MSI). Works on air-gapped Win10. Stability > size. |
| `allowDowngrades` | `true` | Lets hotfix rollback work without manual uninstall. |
| Premium model | 15 favs / 10 collections free, then upsell | Differentiates from iOS (cosmetic-only). |
| Themes | 7 (3 free + 4 premium) | Identical lineup to ICD Snap. Accent re-tinted cooler (`#0a66c2`) because NAICS has loud sector colors. |
| Browse tab | New (NAICS-specific) | Sector → subsector → industry group → industry → national industry. Grouped sectors (31-33 / 44-45 / 48-49) collapsed in `naics.rs::SECTOR_CODES`. |
| Icon | SNAP Series Plan master | Series consistency (cream + outlined NAICS). Replaces iOS-playful peach in run #4. |
| Startup panic logging | `<tempdir>/naicssnap-startup.log` | Mitigates Windows silent-crash (`windows_subsystem = "windows"` hides stderr). |
| PDF i18n | Always embed subsetted NanumGothic | WKWebView can't `window.print()`; native printpdf with CJK subsetting. |
| **CI matrix** | **Windows-only (since `870d9b3`)** | **Mac DMG built locally via `snap-release-mac` to avoid putting Apple signing secrets in repo + keep CI fast.** |

---

## 5. Open items / immediate next steps

Aligned with the `HANDOFF.md` manager-block "Next 3 steps":

### 5.1 Publish v1.0.0-beta.1 draft + smoke test
- Draft URL (private): currently `https://github.com/RangeAreaScent/naics-snap-desktop/releases/tag/untagged-155a4a4a1307ecfc94f4` (will move to the `v1.0.0-beta.1` slug when published).
- Publish as **pre-release** (not full release): `gh release edit v1.0.0-beta.1 --draft=false --prerelease`.
- Smoke checklist: `HANDOFF.md §14 "Manual smoke test"` (Mac) + `§14 "Windows stability test plan"` (Win).
  - Mac: open .app from DMG, exercise all 5 tabs, premium hidden rhythm, PDF export with Korean chars, theme + font switch, restart persistence.
  - Win: install MSI on Win 10/11, exercise the same plus check `%APPDATA%\com.ryan.naicssnap\` is created, `%TEMP%\naicssnap-startup.log` doesn't exist (means no crash), SmartScreen "More info → Run anyway" works.

### 5.2 Apply Lemon Squeezy `product_id` check (HANDOFF Appendix B)
- Edit `src-tauri/src/license.rs`:
  - Add `EXPECTED_PRODUCT_ID: u64 = <real LS product id>` near the top.
  - Add `meta: Option<Meta>` to `ActivateResp` and `ValidateResp`.
  - Add `Meta { product_id: u64 }` deserialize struct.
  - Add `product_id_ok(meta)` helper.
  - Use it in `activate` (return error on mismatch) and in `validate` (treat mismatch as `valid: false`, clear stored license).
- Test path: create a test LS key for a different product → confirm it's rejected.

### 5.3 Promote to v1.0.0
- Bump version in **three places** (per `HANDOFF.md §9`):
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`
  - `package.json`
- (The Snap Series CLAUDE files sometimes refer to "four version locations" — confirm whether iOS Info.plist applies; for this desktop-only repo, three is correct.)
- Commit, tag `v1.0.0`, push tag → CI builds Windows.
- Run `snap-release-mac v1.0.0` on this Mac to attach the Mac universal DMG.
- Smoke test, then `gh release edit v1.0.0 --draft=false` (NOT prerelease this time).

### 5.4 Code signing (deferred but blocks shipping to non-friendly users)
- macOS: Apple Developer Program ($99/yr) → "Developer ID Application" cert in Keychain. Set the 4 env vars locally before `npm run tauri build` (HANDOFF §6.5). Since CI is Mac-free now, repo secrets are not needed.
- Windows: Sectigo/DigiCert code-sign cert (~$60–300/yr) → set `bundle.windows.certificateThumbprint` in `tauri.conf.json`. For CI signing, add the cert+password as repo secrets and uncomment the env block in `.github/workflows/build.yml`.

---

## 6. Useful commands cheatsheet

### Local development
```bash
cd "/Users/ryan/Library/Mobile Documents/com~apple~CloudDocs/App Projects/NAICS Snap_Mac_Win_app"

npm run tauri dev                            # dev (Vite + Tauri together)
npm run build                                # frontend-only typecheck + bundle
npm run tauri build                          # release for current Mac
npm run tauri build -- --target universal-apple-darwin   # Mac universal (signed if env vars set)

cd src-tauri && cargo test --lib             # 3 PDF tests
. ~/.cargo/env                               # if cargo not on PATH
```

### Git / GitHub
```bash
git log --oneline -10                        # current state
git tag -d v1.0.0-beta.1                     # local delete
git push origin :refs/tags/v1.0.0-beta.1     # remote delete
git tag -a v1.0.0-beta.1 -m "<msg>"          # recreate on new HEAD
git push origin v1.0.0-beta.1                # triggers CI

gh api rate_limit --jq '.resources.core'     # always free; check before bulk gh
gh run list --limit 5
gh run view <id>                             # 1 API call, NOT `gh run watch`
gh run view --job <jobid> --log-failed | tail -50

gh release view v1.0.0-beta.1
gh release edit v1.0.0-beta.1 --draft=false --prerelease
gh release delete v1.0.0-beta.1 --yes --cleanup-tag   # CAUTION: removes the tag too
```

### Icon refresh
```bash
cp "<new>.png" app-icon-source.png
cp "<new>.png" app-icon-rounded.png
npm run tauri icon app-icon-rounded.png
touch src-tauri/src/lib.rs                   # CRITICAL — forces generate_context! re-embed
git add -A && git commit -m "chore(icons): <reason>"
# retag + push tag if you want a fresh release
```

### Mac local release (replaces the removed Mac CI job)
The user maintains a helper called `snap-release-mac` (location not in this repo; defined in their shell environment / SNAP Series Plan). Conceptually:
```bash
# build Mac universal locally with Keychain-signed cert (when available)
npm run tauri build -- --target universal-apple-darwin
# upload the .dmg to the draft release matching the tag
gh release upload <tag> "src-tauri/target/universal-apple-darwin/release/bundle/dmg/NAICS Snap_*.dmg"
```
Refer to the user's `snap-release-mac` script for the exact, signed flow.

---

## 7. Git history snapshot at handoff

```
e525583  docs: add SESSION_HANDOFF.md for cross-chat continuity   ← previous version of THIS file
641bcc6  docs: add Snap Series manager-block header to HANDOFF    ← user, post-build
870d9b3  ci: switch to Windows-only build; Mac DMG now built locally   ← user, post-build
a908dad  chore(icons): swap to SNAP Series Plan master (cream / outlined NAICS)
ae5f473  ci: grant contents:write so tauri-action can create the draft release
fb3aa6f  ci: fix release upload (pass GITHUB_TOKEN; skip empty-cert codesign)
b624a09  Initial commit — NAICS Snap Desktop v1.0.0
```

Branch: `main`. Remote: `origin = https://github.com/RangeAreaScent/naics-snap-desktop.git`.

Tags: only `v1.0.0-beta.1` (currently → `a908dad`).

---

## 8. Things that drifted / parallel-chat reconciliation

This chat is one of (at least) two chats working on this project. Between
this session's last action and the next refresh, the user (in another
chat or locally) made these post-build commits:

- `870d9b3` — removed `macos-latest` from `.github/workflows/build.yml` matrix. Mac is now a local-Keychain-signed flow.
- `641bcc6` — added the `<!-- snap-series:manager-block -->` header to `HANDOFF.md`. This is the canonical "where are we right now" block, maintained as part of the user's Snap-series-wide tracker. **A fresh chat should read this manager-block first** for current state.

---

## 9. Useful trivia for the new chat

- The `naics_concordance` table (2017↔2022 mapping) is in the DB but not surfaced in UI. Future feature potential.
- No frontend automated tests yet. Components are decoupled, so Vitest can slot in incrementally.
- No `naics.rs` integration test. Adding one (open the bundled DB, run a known query, assert shape) would catch schema regressions in CI.
- Windows MSI is ~155 MB because of WebView2 bundling. If size becomes a complaint, switch `webviewInstallMode` to `downloadBootstrapper` (but Win10 air-gapped installs will then fail).
- Node 20 in CI is deprecated by GitHub; auto-migrate to Node 24 by Jun 2026.
- iCloud project path has spaces — quote shell paths.

---

## 10. How a fresh chat should start

1. `cd "/Users/ryan/Library/Mobile Documents/com~apple~CloudDocs/App Projects/NAICS Snap_Mac_Win_app"`
2. Read **`HANDOFF.md` lines 1–24** (the manager-block) — that is the source of truth for "where are we right now."
3. Read **this file** (`SESSION_HANDOFF.md`) for the operational detail / CI history / decisions / commands.
4. Skim **`HANDOFF.md` §0–6** for tech-stack / build / architecture orientation.
5. Status check: `git log --oneline -5 && gh run list --limit 3 && gh release view v1.0.0-beta.1`.
6. Pick the next step from §5 above (publish beta, LS hardening, or v1.0.0 promotion).

---

*End of session handoff. Project reference continues in `HANDOFF.md`.*
