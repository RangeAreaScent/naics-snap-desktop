import { useEffect, useRef, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { exportCollectionCSV, exportCollectionPDF } from "../export";
import { useListKeyNav } from "../hooks/useListKeyNav";
import { levelLabel, sectorColor, sectorDisplayCode } from "../sectors";
import { useAppData } from "../state";
import type { Collection, CollectionItem } from "../types";
import { AddCodeModal } from "./AddCodeModal";
import { BulkAddToCollection } from "./FavoritesView";
import { CollectionFormModal } from "./CollectionFormModal";
import { showToast } from "./Toaster";

interface Props {
  selectedCode: string | null;
  onSelect: (code: string) => void;
}

export function CollectionsView({ selectedCode, onSelect }: Props) {
  const { collections } = useAppData();
  const [openId, setOpenId] = useState<string | null>(null);

  const open = collections.find((c) => c.id === openId) ?? null;

  useEffect(() => {
    if (openId && !open) setOpenId(null);
  }, [openId, open]);

  if (open) {
    return (
      <CollectionDetail
        collection={open}
        selectedCode={selectedCode}
        onSelect={onSelect}
        onBack={() => setOpenId(null)}
      />
    );
  }
  return <CollectionList onOpen={setOpenId} />;
}

function CollectionList({ onOpen }: { onOpen: (id: string) => void }) {
  const { collections, createCollection, collectionsMax, promptPremium } =
    useAppData();
  const [creating, setCreating] = useState(false);

  const atLimit = collections.length >= collectionsMax;
  function startNew() {
    if (atLimit) {
      promptPremium(
        "The free plan keeps up to 10 collections. " +
          "Unlock unlimited collections with premium.",
      );
    } else {
      setCreating(true);
    }
  }

  return (
    <div className="list-pane">
      <div className="pane-header">
        <h2 className="pane-header__title">Collections</h2>
        <span className="pane-header__count">{collections.length}</span>
        <button
          className="pane-header__action"
          title="New collection"
          onClick={startNew}
        >
          ＋
        </button>
      </div>
      <div className="list-scroll">
        {collections.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">No collections yet</p>
            <p>Group related codes — e.g. "SaaS competitors", "Local restaurants".</p>
          </div>
        )}
        {collections.map((c) => (
          <button
            key={c.id}
            className="collection-row"
            onClick={() => onOpen(c.id)}
          >
            <span className="collection-row__emoji">{c.emoji}</span>
            <span className="collection-row__main">
              <span className="collection-row__name">{c.name}</span>
              <span className="collection-row__count">
                {c.items.length} code{c.items.length === 1 ? "" : "s"}
              </span>
            </span>
            <span className="collection-row__chevron">›</span>
          </button>
        ))}
      </div>

      {creating && (
        <CollectionFormModal
          title="New collection"
          submitLabel="Create"
          onClose={() => setCreating(false)}
          onSubmit={(name, emoji) => createCollection(name, emoji)}
        />
      )}
    </div>
  );
}

interface DetailProps {
  collection: Collection;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  onBack: () => void;
}

function CollectionDetail({
  collection,
  selectedCode,
  onSelect,
  onBack,
}: DetailProps) {
  const {
    notes,
    renameCollection,
    deleteCollection,
    removeFromCollection,
  } = useAppData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"rename" | "addcode" | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Multi-select state mirrors FavoritesView so users learn one pattern.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [movingToCollection, setMovingToCollection] = useState(false);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Phase A — ↑↓ across collection items, disabled while multi-selecting.
  useListKeyNav(selecting ? [] : collection.items, selectedCode, onSelect);

  // Drop select mode if the collection empties.
  useEffect(() => {
    if (collection.items.length === 0 && selecting) {
      setSelecting(false);
      setPicked(new Set());
    }
  }, [collection.items.length, selecting]);

  // Phase A — ⌘E exports the open collection as CSV. Disabled in select mode
  // (the multi-bar 📄 export covers picked items there).
  useEffect(() => {
    async function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "e") return;
      if (selecting) return;
      e.preventDefault();
      try {
        if (await exportCollectionCSV(collection, notes)) {
          showToast("CSV saved");
        }
      } catch (err) {
        showToast(`Export failed: ${err}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collection, notes, selecting]);

  function flash(msg: string) {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg((m) => (m === msg ? null : m)), 2000);
  }

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

  function pickedItems(): CollectionItem[] {
    return collection.items.filter((i) => picked.has(i.code));
  }

  async function bulkRemove() {
    if (picked.size === 0) return;
    const n = picked.size;
    const ok = await ask(
      `Remove ${n} code${n === 1 ? "" : "s"} from "${collection.name}"? ` +
        `This cannot be undone.`,
      { title: "Remove from collection", kind: "warning" },
    );
    if (!ok) return;
    picked.forEach((code) => removeFromCollection(collection.id, code));
    cancelSelect();
    showToast(`Removed ${n} code${n === 1 ? "" : "s"}`);
  }

  // Bulk PDF export of picked items via the existing collection-export
  // pipeline. A throwaway Collection wraps the picks so we get the same
  // A4 layout. (Identical pattern to FavoritesView.bulkExport.)
  async function bulkExport() {
    const items = pickedItems();
    if (items.length === 0) return;
    const fake: Collection = {
      id: "__bulk_export__",
      name: `${collection.name} (${items.length} codes)`,
      emoji: collection.emoji,
      createdAt: Date.now(),
      items,
    };
    try {
      if (await exportCollectionPDF(fake, notes)) {
        showToast("PDF saved");
        cancelSelect();
      }
    } catch (e) {
      showToast(`Export failed: ${e}`);
    }
  }

  async function copyAll() {
    setMenuOpen(false);
    if (collection.items.length === 0) return;
    await navigator.clipboard.writeText(
      collection.items.map((i) => i.code).join(", "),
    );
    flash("Codes copied");
  }

  async function exportCSV() {
    setMenuOpen(false);
    try {
      if (await exportCollectionCSV(collection, notes)) flash("CSV saved");
    } catch (e) {
      flash(`Export failed: ${e}`);
    }
  }

  async function exportPDF() {
    setMenuOpen(false);
    if (collection.items.length === 0) return;
    try {
      if (await exportCollectionPDF(collection, notes)) flash("PDF saved");
    } catch (e) {
      flash(`Export failed: ${e}`);
    }
  }

  async function confirmDelete() {
    setMenuOpen(false);
    // Tauri 2 webview silently ignores window.confirm — use native ask().
    const ok = await ask(
      `Delete "${collection.name}"? This cannot be undone.`,
      { title: "Delete collection", kind: "warning" },
    );
    if (ok) {
      deleteCollection(collection.id);
      onBack();
    }
  }

  return (
    <div className="list-pane">
      <div className="pane-header pane-header--detail">
        <button className="back-btn" onClick={onBack} title="Back">
          ‹
        </button>
        <div className="collection-head">
          <span className="collection-head__emoji">{collection.emoji}</span>
          <div>
            <div className="collection-head__name">{collection.name}</div>
            <div className="collection-head__count">
              {collection.items.length} code
              {collection.items.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        {collection.items.length > 0 && !selecting && (
          <button
            className="pane-header__action"
            onClick={() => setSelecting(true)}
            title="Select multiple"
            aria-label="Select multiple"
          >
            ☑
          </button>
        )}
        <div className="menu-wrap" ref={menuRef}>
          <button
            className="pane-header__action"
            title="Actions"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="menu">
              <button
                className="menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  setModal("addcode");
                }}
              >
                Add code
              </button>
              <button className="menu__item" onClick={copyAll}>
                Copy all codes
              </button>
              <button className="menu__item" onClick={exportCSV}>
                Export as CSV…
              </button>
              <button className="menu__item" onClick={exportPDF}>
                Export as PDF…
              </button>
              <button
                className="menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  setModal("rename");
                }}
              >
                Rename
              </button>
              <button
                className="menu__item menu__item--danger"
                onClick={confirmDelete}
              >
                Delete collection
              </button>
            </div>
          )}
        </div>
      </div>

      {selecting && (
        <div className="multi-bar">
          <span className="multi-bar__count">{picked.size} selected</span>
          <div className="multi-bar__actions">
            <button
              className="icon-btn"
              onClick={() => setMovingToCollection(true)}
              disabled={picked.size === 0}
              title="Copy to another collection"
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
              title="Remove from this collection"
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
          items={pickedItems()}
          excludeCollectionId={collection.id}
          onClose={() => setMovingToCollection(false)}
          onAdded={() => {
            setMovingToCollection(false);
            cancelSelect();
          }}
        />
      )}

      <div className="list-scroll">
        {collection.items.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">Empty collection</p>
            <p>Use the ⋯ menu to add codes.</p>
          </div>
        )}
        {collection.items.map((item) => {
          if (selecting) {
            const isPicked = picked.has(item.code);
            return (
              <label
                key={item.code}
                className={`code-row code-row--pickable${
                  isPicked ? " code-row--picked" : ""
                }`}
                data-code={item.code}
              >
                <input
                  type="checkbox"
                  className="code-row__check"
                  checked={isPicked}
                  onChange={() => togglePick(item.code)}
                />
                <div
                  className="code-row__bar"
                  style={{ background: sectorColor(item.sectorCode) }}
                />
                <div className="code-row__main">
                  <div className="code-row__top">
                    <span className="code-row__code">{item.code}</span>
                    <span className="badge badge--level">
                      {levelLabel(item.level)}
                    </span>
                  </div>
                  <div className="code-row__desc">{item.title}</div>
                  {item.sectorTitle && (
                    <div className="code-row__chapter">
                      {sectorDisplayCode(item.sectorCode)} · {item.sectorTitle}
                    </div>
                  )}
                </div>
              </label>
            );
          }
          return (
            <div
              key={item.code}
              className={`code-row${
                item.code === selectedCode ? " code-row--selected" : ""
              }`}
              data-code={item.code}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(item.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(item.code);
                }
              }}
            >
              <div
                className="code-row__bar"
                style={{ background: sectorColor(item.sectorCode) }}
              />
              <div className="code-row__main">
                <div className="code-row__top">
                  <span className="code-row__code">{item.code}</span>
                  <span className="badge badge--level">
                    {levelLabel(item.level)}
                  </span>
                </div>
                <div className="code-row__desc">{item.title}</div>
                {item.sectorTitle && (
                  <div className="code-row__chapter">
                    {sectorDisplayCode(item.sectorCode)} · {item.sectorTitle}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {statusMsg && <div className="inline-status">{statusMsg}</div>}

      {modal === "rename" && (
        <CollectionFormModal
          title="Rename collection"
          submitLabel="Save"
          initialName={collection.name}
          initialEmoji={collection.emoji}
          onClose={() => setModal(null)}
          onSubmit={(name, emoji) =>
            renameCollection(collection.id, name, emoji)
          }
        />
      )}
      {modal === "addcode" && (
        <AddCodeModal
          collectionId={collection.id}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
