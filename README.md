# NAICS Snap Desktop

Mac + Windows desktop port of the **NAICS Snap** iOS app — a fast, offline
NAICS 2022 industry-code lookup tool. Tauri 2 + React 19 + TypeScript.

See [HANDOFF.md](HANDOFF.md) for the full picking-up / maintenance / shipping
guide.

## Quick start

```bash
npm install
npm run tauri dev
```

## Build

```bash
# macOS (Apple Silicon)
npm run tauri build

# macOS universal
rustup target add x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin

# Windows (run on Windows)
npm run tauri build
```
