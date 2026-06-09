import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { searchCodes } from "../api";
import { useAppData } from "../state";
import type { SearchResult } from "../types";

/** Phase C (SNAP_DESKTOP_IMPROVEMENT_PLAN.md) — ⌘K command palette.
 *
 * Single overlay that unifies:
 *   - NAICS code search (debounced, only when query has substance)
 *   - Favorite jumps (top 3, idle only)
 *   - Navigation actions (tab jumps, always available via fuzzy match)
 *
 * Noise prevention rules:
 *   1. Codes group only renders when query.length >= 2 — short prefixes
 *      flood the list with sector-roots that aren't actionable here.
 *   2. Favorites only render when query is empty — once the user starts
 *      typing, the only relevant matches are codes + tab jumps.
 *   3. Tab jumps are always shown; cmdk's built-in fuzzy filter hides
 *      irrelevant ones as the user types ("set" → Settings).
 *   4. Group limits (5/3) keep the list under a single screen.
 *
 * Note: unlike Tariff Snap, NAICS has no domain-special toggle (NI Mode,
 * Windsor, etc.), so there is no Actions group here.
 */

type Tab = "search" | "browse" | "favorites" | "collections" | "settings";

interface Props {
  open: boolean;
  onClose: () => void;
  onJumpToCode: (code: string) => void;
  onJumpToTab: (tab: Tab) => void;
}

export function CommandPalette({
  open,
  onClose,
  onJumpToCode,
  onJumpToTab,
}: Props) {
  const [query, setQuery] = useState("");
  const [codeResults, setCodeResults] = useState<SearchResult[]>([]);
  const { favorites, recents } = useAppData();

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setCodeResults([]);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      searchCodes(q, 5)
        .then((r) => {
          if (active) setCodeResults(r);
        })
        .catch(() => {
          if (active) setCodeResults([]);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  if (!open) return null;

  const trimmed = query.trim();
  const showIdleSuggestions = trimmed.length === 0;
  const showCodes = trimmed.length >= 2 && codeResults.length > 0;

  function jumpCode(code: string) {
    onJumpToCode(code);
    onClose();
  }
  function jumpTab(tab: Tab) {
    onJumpToTab(tab);
    onClose();
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      label="Command palette"
      className="cmdk-root"
    >
      <Command.Input
        placeholder="Type a code, industry, or command…"
        value={query}
        onValueChange={setQuery}
        className="cmdk-input"
        autoFocus
      />
      <Command.List className="cmdk-list">
        <Command.Empty className="cmdk-empty">No matches</Command.Empty>

        {showCodes && (
          <Command.Group heading="NAICS codes" className="cmdk-group">
            {codeResults.map((r) => (
              <Command.Item
                key={`code-${r.code}`}
                value={`${r.code} ${r.title}`}
                onSelect={() => jumpCode(r.code)}
                className="cmdk-item"
              >
                <span className="cmdk-item__code">{r.code}</span>
                <span className="cmdk-item__desc">{r.title}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {showIdleSuggestions && recents.length > 0 && (
          <Command.Group heading="Recent" className="cmdk-group">
            {recents.slice(0, 3).map((r) => (
              <Command.Item
                key={`recent-${r.code}`}
                value={`recent ${r.code} ${r.title}`}
                onSelect={() => jumpCode(r.code)}
                className="cmdk-item"
              >
                <span className="cmdk-item__code">{r.code}</span>
                <span className="cmdk-item__desc">{r.title}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {showIdleSuggestions && favorites.length > 0 && (
          <Command.Group heading="Favorites" className="cmdk-group">
            {favorites.slice(0, 3).map((f) => (
              <Command.Item
                key={`fav-${f.code}`}
                value={`favorite ${f.code} ${f.title}`}
                onSelect={() => jumpCode(f.code)}
                className="cmdk-item"
              >
                <span className="cmdk-item__code">{f.code}</span>
                <span className="cmdk-item__desc">{f.title}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Go to" className="cmdk-group">
          <Command.Item
            value="go to search"
            onSelect={() => jumpTab("search")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">⌕</span>
            <span className="cmdk-item__label">Search</span>
            <span className="cmdk-item__hint">⌘1</span>
          </Command.Item>
          <Command.Item
            value="go to browse sectors industries"
            onSelect={() => jumpTab("browse")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">☷</span>
            <span className="cmdk-item__label">Browse</span>
            <span className="cmdk-item__hint">⌘2</span>
          </Command.Item>
          <Command.Item
            value="go to favorites favourites starred"
            onSelect={() => jumpTab("favorites")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">★</span>
            <span className="cmdk-item__label">Favorites</span>
            <span className="cmdk-item__hint">⌘3</span>
          </Command.Item>
          <Command.Item
            value="go to collections lists groups"
            onSelect={() => jumpTab("collections")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">🗂</span>
            <span className="cmdk-item__label">Collections</span>
            <span className="cmdk-item__hint">⌘4</span>
          </Command.Item>
          <Command.Item
            value="go to settings preferences theme font premium"
            onSelect={() => jumpTab("settings")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">⚙</span>
            <span className="cmdk-item__label">Settings</span>
            <span className="cmdk-item__hint">⌘,</span>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
