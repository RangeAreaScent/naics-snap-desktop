import { useEffect, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { exportCollectionPDF } from "../export";
import { useListKeyNav } from "../hooks/useListKeyNav";
import { levelLabel, sectorColor, sectorDisplayCode } from "../sectors";
import { useAppData } from "../state";
import type { Collection, Favorite, SearchResult } from "../types";
import { CodeRow } from "./CodeRow";
import { showToast } from "./Toaster";

interface Props {
  selectedCode: string | null;
  onSelect: (code: string) => void;
}

export function FavoritesView({ selectedCode, onSelect }: Props) {
  const { favorites, isFavorite, toggleFavorite, removeFavorite, notes } =
    useAppData();

  /** Polish — multi-select mode for bulk remove / export / add-to-collection.
   *  When `selecting` is true, ↑↓ navigation is disabled (the row clicks
   *  toggle the checkbox instead). */
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [movingToCollection, setMovingToCollection] = useState(false);

  // Keep arrow-key nav only when NOT in multi-select.
  useListKeyNav(selecting ? [] : favorites, selectedCode, onSelect);

  // Drop selection mode if the list shrinks to nothing.
  useEffect(() => {
    if (favorites.length === 0 && selecting) {
      setSelecting(false);
      setPicked(new Set());
    }
  }, [favorites.length, selecting]);

  function togglePick(code: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function cancelSelect() {
    setSelecting(false);
    setPicked(new Set());
  }

  function pickedFavorites(): Favorite[] {
    return favorites.filter((f) => picked.has(f.code));
  }

  async function bulkRemove() {
    if (picked.size === 0) return;
    const n = picked.size;
    const ok = await ask(
      `Remove ${n} favorite${n === 1 ? "" : "s"}? This cannot be undone.`,
      { title: "Remove favorites", kind: "warning" },
    );
    if (!ok) return;
    picked.forEach((c) => removeFavorite(c));
    cancelSelect();
    showToast(`Removed ${n} favorite${n === 1 ? "" : "s"}`);
  }

  // Export picked favorites as a PDF by reusing the collection-export pipeline.
  // A throwaway Collection wraps the picks so we get the same A4 layout.
  async function bulkExport() {
    const items = pickedFavorites();
    if (items.length === 0) return;
    const fakeCollection: Collection = {
      id: "__bulk_export__",
      name: `Favorites (${items.length} codes)`,
      emoji: "★",
      createdAt: Date.now(),
      items: items.map((f) => ({
        code: f.code,
        title: f.title,
        level: f.level,
        sectorCode: f.sectorCode,
        sectorTitle: f.sectorTitle,
        addedAt: f.addedAt,
      })),
    };
    try {
      if (await exportCollectionPDF(fakeCollection, notes)) {
        showToast("PDF saved");
        cancelSelect();
      }
    } catch (e) {
      showToast(`Export failed: ${e}`);
    }
  }

  return (
    <div className="list-pane">
      <div className="pane-header">
        <h2 className="pane-header__title">Favorites</h2>
        <span className="pane-header__count">{favorites.length}</span>
        {favorites.length > 0 && !selecting && (
          <button
            className="pane-header__action"
            onClick={() => setSelecting(true)}
            title="Select multiple"
            aria-label="Select multiple"
          >
            ☑
          </button>
        )}
      </div>

      {selecting && (
        <div className="multi-bar">
          <span className="multi-bar__count">{picked.size} selected</span>
          <div className="multi-bar__actions">
            <button
              className="icon-btn"
              onClick={() => setMovingToCollection(true)}
              disabled={picked.size === 0}
              title="Add to a collection"
            >
              📁
            </button>
            <button
              className="icon-btn"
              onClick={bulkExport}
              disabled={picked.size === 0}
              title="Export as PDF"
            >
              📄
            </button>
            <button
              className="icon-btn icon-btn--danger"
              onClick={bulkRemove}
              disabled={picked.size === 0}
              title="Remove from favorites"
            >
              🗑
            </button>
            <button className="icon-btn" onClick={cancelSelect} title="Cancel">
              ✕
            </button>
          </div>
        </div>
      )}

      {movingToCollection && picked.size > 0 && (
        <BulkAddToCollection
          items={pickedFavorites()}
          onClose={() => setMovingToCollection(false)}
          onAdded={() => {
            setMovingToCollection(false);
            cancelSelect();
          }}
        />
      )}

      <div className="list-scroll">
        {favorites.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">No favorites yet</p>
            <p>Tap the ☆ on any code to save it here.</p>
          </div>
        )}
        {favorites.map((fav) => {
          const item: SearchResult = {
            code: fav.code,
            title: fav.title,
            level: fav.level,
            sectorCode: fav.sectorCode,
            sectorTitle: fav.sectorTitle,
          };

          if (selecting) {
            const isPicked = picked.has(fav.code);
            return (
              <label
                key={fav.code}
                className={`code-row code-row--pickable${
                  isPicked ? " code-row--picked" : ""
                }`}
                data-code={fav.code}
              >
                <input
                  type="checkbox"
                  className="code-row__check"
                  checked={isPicked}
                  onChange={() => togglePick(fav.code)}
                />
                <div
                  className="code-row__bar"
                  style={{ background: sectorColor(fav.sectorCode) }}
                />
                <div className="code-row__main">
                  <div className="code-row__top">
                    <span className="code-row__code">{fav.code}</span>
                    <span className="badge badge--level">
                      {levelLabel(fav.level)}
                    </span>
                  </div>
                  <div className="code-row__desc">{fav.title}</div>
                  {fav.sectorTitle && (
                    <div className="code-row__chapter">
                      {sectorDisplayCode(fav.sectorCode)} · {fav.sectorTitle}
                    </div>
                  )}
                </div>
              </label>
            );
          }

          return (
            <CodeRow
              key={fav.code}
              item={item}
              selected={fav.code === selectedCode}
              favorite={isFavorite(fav.code)}
              onSelect={() => onSelect(fav.code)}
              onToggleFavorite={() => toggleFavorite(item)}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Bulk "add to collection" picker. Thin chooser over the existing
 *  addToCollection primitive. Used by FavoritesView and CollectionsView.
 *  - `items` accepts anything with the SearchResult shape; both Favorite
 *    and CollectionItem are supersets so they pass through unchanged.
 *  - `excludeCollectionId` skips a collection from the chooser (used by
 *    CollectionsView so the open collection isn't a target for itself). */
export function BulkAddToCollection({
  items,
  excludeCollectionId,
  onClose,
  onAdded,
}: {
  items: Array<{
    code: string;
    title: string;
    level: number;
    sectorCode: string;
    sectorTitle: string;
  }>;
  excludeCollectionId?: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { collections, addToCollection } = useAppData();
  const targets = excludeCollectionId
    ? collections.filter((c) => c.id !== excludeCollectionId)
    : collections;

  function send(collectionId: string, name: string) {
    items.forEach((f) => {
      addToCollection(collectionId, {
        code: f.code,
        title: f.title,
        level: f.level,
        sectorCode: f.sectorCode,
        sectorTitle: f.sectorTitle,
      });
    });
    showToast(`Added ${items.length} to ${name}`);
    onAdded();
  }

  if (targets.length === 0) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal__header">
            <h3 className="modal__title">
              {excludeCollectionId
                ? "No other collections"
                : "No collections yet"}
            </h3>
            <button className="modal__close" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="modal__body">
            <p className="settings-disclaimer">
              {excludeCollectionId
                ? "Create another collection from the Collections tab, then come back to copy items into it."
                : "Create a collection from the Collections tab first, then come back to bulk-add."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__title">
            Add {items.length} to a collection
          </h3>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal__body">
          <div className="bulk-collection-list">
            {targets.map((c) => (
              <button
                key={c.id}
                className="bulk-collection-row"
                onClick={() => send(c.id, c.name)}
              >
                <span className="bulk-collection-row__emoji">{c.emoji}</span>
                <span className="bulk-collection-row__name">{c.name}</span>
                <span className="bulk-collection-row__count">
                  {c.items.length} codes
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
