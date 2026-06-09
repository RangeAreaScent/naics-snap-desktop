import { useEffect, useRef, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { searchCodes } from "../api";
import { useListKeyNav } from "../hooks/useListKeyNav";
import { useAppData } from "../state";
import type { SearchResult } from "../types";
import { CodeRow } from "./CodeRow";

interface Props {
  selectedCode: string | null;
  onSelect: (code: string) => void;
}

export function SearchView({ selectedCode, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isFavorite, toggleFavorite, recents, clearRecents } = useAppData();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runId = useRef(0);
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++runId.current;
    const timer = setTimeout(() => {
      searchCodes(trimmed)
        .then((res) => {
          if (id !== runId.current) return;
          setResults(res);
          setError(null);
        })
        .catch((e) => {
          if (id !== runId.current) return;
          setError(String(e));
          setResults([]);
        })
        .finally(() => {
          if (id === runId.current) setLoading(false);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const trimmed = query.trim();

  // stableRecents — frozen snapshot of recents refreshed only when the query
  // transitions from active → empty. While idle (empty query), we deliberately
  // do NOT follow live recents updates so that ↑↓ browsing a code doesn't
  // cause the list to reorder mid-navigation (ping-pong, §11.1 A-3).
  const stableRecentsRef = useRef<SearchResult[]>(recents);
  const prevTrimmedRef = useRef(trimmed);
  if (prevTrimmedRef.current !== trimmed) {
    prevTrimmedRef.current = trimmed;
    if (!trimmed) stableRecentsRef.current = recents;
  }
  const displayRecents = stableRecentsRef.current;

  // Phase A — ↑↓ navigation: over results when searching, recents when idle.
  useListKeyNav(trimmed ? results : displayRecents, selectedCode, onSelect);

  async function handleClearRecents() {
    const ok = await ask("Clear all recent codes?", {
      title: "Clear recents",
      kind: "warning",
    });
    if (ok) clearRecents();
  }

  return (
    <div className="list-pane">
      <div className="search-bar">
        <span className="search-bar__icon">⌕</span>
        <input
          ref={inputRef}
          className="search-bar__input"
          placeholder="Search industry or code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        {query && (
          <button
            className="search-bar__clear"
            onClick={() => setQuery("")}
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>

      <div className="list-scroll">
        {error && <div className="state-msg state-msg--error">{error}</div>}

        {/* idle + no recents → empty-state hint */}
        {!error && !trimmed && displayRecents.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">Search NAICS 2022 codes</p>
            <p>Type an industry (e.g. "software publishers") or a code (e.g. "5415").</p>
            <p>Business shortcuts work too — try "SaaS", "3PL", "HVAC".</p>
          </div>
        )}

        {/* idle + recents → recent list */}
        {!error && !trimmed && displayRecents.length > 0 && (
          <>
            <div className="recents-header">
              <span className="recents-header__label">Recent</span>
              <button
                className="recents-header__clear"
                onClick={handleClearRecents}
                title="Clear all recents"
              >
                Clear
              </button>
            </div>
            {displayRecents.map((item) => (
              <CodeRow
                key={item.code}
                item={item}
                selected={item.code === selectedCode}
                favorite={isFavorite(item.code)}
                onSelect={() => onSelect(item.code)}
                onToggleFavorite={() => toggleFavorite(item)}
              />
            ))}
          </>
        )}

        {/* active query → search results */}
        {!error && trimmed && !loading && results.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">No results</p>
            <p>No codes match "{trimmed}".</p>
          </div>
        )}
        {trimmed && results.map((item) => (
          <CodeRow
            key={item.code}
            item={item}
            selected={item.code === selectedCode}
            favorite={isFavorite(item.code)}
            onSelect={() => onSelect(item.code)}
            onToggleFavorite={() => toggleFavorite(item)}
          />
        ))}
      </div>
    </div>
  );
}
