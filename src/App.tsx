import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "./styles.css";
import { getCodeDetail } from "./api";
import { BrowseView } from "./components/BrowseView";
import { CodeDetailView } from "./components/CodeDetailView";
import { CollectionsView } from "./components/CollectionsView";
import { CommandPalette } from "./components/CommandPalette";
import { FavoritesView } from "./components/FavoritesView";
import { PremiumPromptModal } from "./components/PremiumPromptModal";
import { SearchView } from "./components/SearchView";
import { SettingsView } from "./components/SettingsView";
import { Splitter } from "./components/Splitter";
import { StatusBar } from "./components/StatusBar";
import { showToast, Toaster } from "./components/Toaster";
import { AppDataProvider, useAppData } from "./state";
import { SettingsProvider } from "./settings";

type Tab = "search" | "browse" | "favorites" | "collections" | "settings";

/** Phase B: responsive breakpoint. Below this, list-pane goes full-width
 *  and detail-pane overlays. 900px lets standard 13-inch laptops keep
 *  the split layout; only intentional narrow windows trip the overlay. */
const NARROW_PX = 900;

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < NARROW_PX,
  );
  useEffect(() => {
    function onResize() {
      setNarrow(window.innerWidth < NARROW_PX);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}

function App() {
  return (
    <SettingsProvider>
      <AppDataProvider>
        <AppShell />
      </AppDataProvider>
    </SettingsProvider>
  );
}

function AppShell() {
  const [tab, setTab] = useState<Tab>("search");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const isNarrow = useIsNarrow();
  // Phase B: in narrow mode the detail-pane is hidden by default and only
  // appears as an overlay when the user opens a row. Esc / back returns
  // to the list.
  const [narrowDetailOpen, setNarrowDetailOpen] = useState(false);
  // Phase C — ⌘K command palette open state.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const {
    premiumPrompt,
    clearPremiumPrompt,
    isFavorite,
    toggleFavorite,
    removeFavorite,
  } = useAppData();

  // Phase B — row selection opens the detail overlay (narrow mode); tab
  // change auto-closes it.
  const handleSelect = useCallback((code: string) => {
    setSelectedCode(code);
    setNarrowDetailOpen(true);
  }, []);

  useEffect(() => {
    setNarrowDetailOpen(false);
  }, [tab]);

  // Phase D — wire native menu events to the same handlers the keyboard
  // shortcuts use. Menu IDs are defined in src-tauri/src/menu.rs and
  // must match exactly (kept stable as a hard-coded contract).
  useEffect(() => {
    const unlistens: Array<Promise<() => void>> = [];
    function on(id: string, fn: () => void) {
      unlistens.push(listen(`menu:${id}`, fn));
    }

    on("file.new_search", () => {
      setTab("search");
      setTimeout(() => {
        const input = document.querySelector(
          ".search-bar__input",
        ) as HTMLInputElement | null;
        input?.focus();
      }, 0);
    });
    on("file.command_palette", () => setPaletteOpen(true));
    on("file.export_collection", () => {
      // CollectionsView's own ⌘E listener picks this up.
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "e", metaKey: true }),
      );
    });

    on("edit.copy_code", () => {
      if (!selectedCode) return;
      navigator.clipboard
        .writeText(selectedCode)
        .then(() => showToast(`Copied ${selectedCode}`))
        .catch(() => showToast("Copy failed"));
    });
    on("edit.find", () => {
      setTab("search");
      setTimeout(() => {
        const input = document.querySelector(
          ".search-bar__input",
        ) as HTMLInputElement | null;
        input?.focus();
      }, 0);
    });

    on("view.tab_search", () => setTab("search"));
    on("view.tab_browse", () => setTab("browse"));
    on("view.tab_favorites", () => setTab("favorites"));
    on("view.tab_collections", () => setTab("collections"));
    on("view.tab_settings", () => setTab("settings"));
    on("view.reset_splitter", () => {
      localStorage.removeItem("snap.listWidth");
      document.documentElement.style.setProperty("--list-width", "380px");
      showToast("Splitter width reset");
    });

    // Help menu items land on Settings tab and pop the matching info
    // modal. The CustomEvent is consumed by SettingsView via its
    // window listener.
    function openSettingsPanel(which: "howToUse" | "database" | "about") {
      setTab("settings");
      // Defer one tick so SettingsView mounts before the modal opens.
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("snap:open-settings-modal", { detail: which }),
        );
      }, 0);
    }
    on("help.how_to_use", () => openSettingsPanel("howToUse"));
    on("help.database_details", () => openSettingsPanel("database"));

    return () => {
      unlistens.forEach((p) => p.then((fn) => fn()).catch(() => {}));
    };
  }, [selectedCode]);

  // Phase B/C — Esc priority: palette > narrow overlay > Search focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // cmdk owns its own Esc; defer to it.
      if (paletteOpen) return;
      if (isNarrow && narrowDetailOpen) {
        setNarrowDetailOpen(false);
        return;
      }
      if (tab === "search") {
        const active = document.activeElement as HTMLElement | null;
        const t = active?.tagName?.toLowerCase();
        if (t === "input" || t === "textarea") return;
        const input = document.querySelector(
          ".search-bar__input",
        ) as HTMLInputElement | null;
        input?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNarrow, narrowDetailOpen, paletteOpen, tab]);

  // Phase A — global desktop shortcuts (SNAP_DESKTOP_IMPROVEMENT_PLAN.md §5).
  // Single source of truth so behavior stays consistent across views.
  useEffect(() => {
    async function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const inEditable = tag === "input" || tag === "textarea";
      const key = e.key.toLowerCase();

      // ⌘K → command palette toggle (Phase C)
      if (key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      // ⌘F → focus Search tab (existing behavior, kept)
      if (key === "f") {
        e.preventDefault();
        setTab("search");
        return;
      }
      // ⌘1~5 → sidebar jump (matches rail order)
      if (e.key === "1") { e.preventDefault(); setTab("search"); return; }
      if (e.key === "2") { e.preventDefault(); setTab("browse"); return; }
      if (e.key === "3") { e.preventDefault(); setTab("favorites"); return; }
      if (e.key === "4") { e.preventDefault(); setTab("collections"); return; }
      if (e.key === "5") { e.preventDefault(); setTab("settings"); return; }
      // ⌘, → Settings (macOS convention)
      if (e.key === ",") { e.preventDefault(); setTab("settings"); return; }

      // The rest need a selected code; if the user is typing into an
      // input, let the browser's native ⌘C/⌘D through.
      if (inEditable) return;
      if (!selectedCode) return;

      // ⌘C → copy selected code to clipboard
      if (key === "c") {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(selectedCode);
          showToast(`Copied ${selectedCode}`);
        } catch {
          showToast("Copy failed");
        }
        return;
      }
      // ⌘D → favorite toggle for selected code
      if (key === "d") {
        e.preventDefault();
        if (isFavorite(selectedCode)) {
          removeFavorite(selectedCode);
          showToast("Removed from favorites");
          return;
        }
        // Need full SearchResult to add — fetch detail and convert.
        try {
          const d = await getCodeDetail(selectedCode);
          if (!d) { showToast("Code not found"); return; }
          toggleFavorite({
            code: d.code,
            title: d.title,
            level: d.level,
            sectorCode: d.sectorCode,
            sectorTitle: d.sectorTitle,
          });
          showToast("Added to favorites");
        } catch {
          showToast("Failed to add favorite");
        }
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedCode, isFavorite, toggleFavorite, removeFavorite]);

  return (
    <div className="app">
      <div className="app__main">
      <nav className="rail">
        <div className="rail__brand">NAICS</div>
        <RailTab
          label="Search"
          icon="⌕"
          active={tab === "search"}
          onClick={() => setTab("search")}
        />
        <RailTab
          label="Browse"
          icon="☷"
          active={tab === "browse"}
          onClick={() => setTab("browse")}
        />
        <RailTab
          label="Favorites"
          icon="★"
          active={tab === "favorites"}
          onClick={() => setTab("favorites")}
        />
        <RailTab
          label="Collections"
          icon="🗂"
          active={tab === "collections"}
          onClick={() => setTab("collections")}
        />
        <div className="rail__spacer" />
        <RailTab
          label="Settings"
          icon="⚙"
          active={tab === "settings"}
          onClick={() => setTab("settings")}
        />
      </nav>

      <main
        className={`content${
          isNarrow ? " content--narrow" : ""
        }${isNarrow && narrowDetailOpen ? " content--detail-overlay" : ""}`}
      >
        {tab === "search" && (
          <SearchView selectedCode={selectedCode} onSelect={handleSelect} />
        )}
        {tab === "browse" && (
          <BrowseView selectedCode={selectedCode} onSelect={handleSelect} />
        )}
        {tab === "favorites" && (
          <FavoritesView
            selectedCode={selectedCode}
            onSelect={handleSelect}
          />
        )}
        {tab === "collections" && (
          <CollectionsView
            selectedCode={selectedCode}
            onSelect={handleSelect}
          />
        )}
        {tab === "settings" ? (
          <SettingsView />
        ) : (
          <>
            {!isNarrow && <Splitter />}
            <CodeDetailView
              code={selectedCode}
              onClose={
                isNarrow ? () => setNarrowDetailOpen(false) : undefined
              }
            />
          </>
        )}
      </main>

      {premiumPrompt && (
        <PremiumPromptModal
          message={premiumPrompt}
          onClose={clearPremiumPrompt}
          onGoSettings={() => {
            clearPremiumPrompt();
            setTab("settings");
          }}
        />
      )}

      </div>{/* /.app__main */}
      <StatusBar />

      <Toaster />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onJumpToCode={(code) => {
          setTab("search");
          setSelectedCode(code);
          setNarrowDetailOpen(true);
        }}
        onJumpToTab={(t) => setTab(t)}
      />
    </div>
  );
}

function RailTab({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`rail__tab${active ? " rail__tab--active" : ""}`}
      onClick={onClick}
      title={label}
    >
      <span className="rail__icon">{icon}</span>
      <span className="rail__label">{label}</span>
    </button>
  );
}

export default App;
