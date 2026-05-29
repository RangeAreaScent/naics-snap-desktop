import { useEffect, useState } from "react";
import { getCodeActivities, getCodeDetail } from "../api";
import { formatSbaSize, sectorColor } from "../sectors";
import { useAppData } from "../state";
import type { CodeDetail, SearchResult } from "../types";
import { AddToCollectionModal } from "./AddToCollectionModal";

interface Props {
  code: string | null;
}

export function CodeDetailView({ code }: Props) {
  const [detail, setDetail] = useState<CodeDetail | null>(null);
  const [activities, setActivities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [addingToCollection, setAddingToCollection] = useState(false);
  const { isFavorite, toggleFavorite } = useAppData();

  useEffect(() => {
    if (!code) {
      setDetail(null);
      setActivities([]);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([getCodeDetail(code), getCodeActivities(code).catch(() => [])])
      .then(([d, acts]) => {
        if (!active) return;
        setDetail(d);
        setActivities(acts);
        if (!d) setError(`Code "${code}" was not found.`);
      })
      .catch((e) => {
        if (active) setError(String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code]);

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1600);
    } catch (e) {
      console.error("copy failed:", e);
    }
  }

  if (!code) {
    return (
      <div className="detail-pane detail-pane--empty">
        <p>Select a code to see its details.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="detail-pane detail-pane--empty">
        <p>Loading…</p>
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="detail-pane detail-pane--empty">
        <p>{error ?? "Not found."}</p>
      </div>
    );
  }

  const asItem: SearchResult = {
    code: detail.code,
    title: detail.title,
    level: detail.level,
    sectorCode: detail.sectorCode,
    sectorTitle: detail.sectorTitle,
  };

  const sbaLabel = formatSbaSize(detail.sbaSizeDollars, detail.sbaSizeEmployees);

  const fullDetail = [
    detail.code,
    detail.title,
    detail.sectorTitle && `Sector: ${detail.sectorTitle}`,
    detail.subsectorTitle && `Subsector: ${detail.subsectorTitle}`,
    detail.industryGroupTitle && `Industry Group: ${detail.industryGroupTitle}`,
    detail.industryTitle && `Industry: ${detail.industryTitle}`,
    sbaLabel && `SBA size standard: ${sbaLabel}`,
  ]
    .filter(Boolean)
    .join("\n");

  const fav = isFavorite(detail.code);

  return (
    <div className="detail-pane">
      <div className="detail-scroll">
        <div className="detail-hero">
          <div className="detail-hero__actions">
            <button
              className={`star-btn star-btn--lg${fav ? " star-btn--on" : ""}`}
              title={fav ? "Remove from favorites" : "Add to favorites"}
              onClick={() => toggleFavorite(asItem)}
            >
              {fav ? "★" : "☆"}
            </button>
            <button
              className="icon-btn"
              title="Add to collection"
              onClick={() => setAddingToCollection(true)}
            >
              ＋
            </button>
          </div>
          <div
            className="detail-hero__sector-bar"
            style={{ background: sectorColor(detail.sectorCode) }}
          />
          <div className="detail-hero__code">{detail.code}</div>
          <div className="detail-hero__desc">{detail.title}</div>
          <div className="detail-hero__chips">
            <span className="badge badge--level">
              {levelText(detail.level)}
            </span>
            {sbaLabel && (
              <span className="badge badge--positive">SBA: {sbaLabel}</span>
            )}
          </div>
        </div>

        <div className="copy-group">
          <button className="copy-btn" onClick={() => copy("code", detail.code)}>
            Copy code · {detail.code}
          </button>
          <button
            className="copy-btn"
            onClick={() => copy("codeTitle", `${detail.code} ${detail.title}`)}
          >
            Copy code + title
          </button>
          <button className="copy-btn" onClick={() => copy("full", fullDetail)}>
            Copy full detail
          </button>
        </div>

        <div className="classification">
          <h3 className="classification__heading">Classification (NAICS 2022)</h3>
          {detail.sectorTitle && (
            <ClassRow
              label="Sector"
              code={detail.sectorCode}
              value={detail.sectorTitle}
            />
          )}
          {detail.subsectorTitle && (
            <ClassRow
              label="Subsector"
              code={detail.subsectorCode}
              value={detail.subsectorTitle}
            />
          )}
          {detail.industryGroupTitle && (
            <ClassRow
              label="Industry Group"
              code={detail.industryGroupCode}
              value={detail.industryGroupTitle}
            />
          )}
          {detail.industryTitle && (
            <ClassRow
              label="Industry"
              code={detail.industryCode}
              value={detail.industryTitle}
            />
          )}
        </div>

        {sbaLabel && (
          <div className="detail-section">
            <h3 className="classification__heading">SBA Size Standard</h3>
            <div className="sba-card">
              <span className="sba-card__icon">🏛</span>
              <div>
                <div className="sba-card__title">{sbaLabel}</div>
                <div className="sba-card__hint">
                  SBA threshold below which a business is "small" for this
                  NAICS code{detail.sbaFootnote ? ` (footnote ${detail.sbaFootnote})` : ""}.
                </div>
              </div>
            </div>
          </div>
        )}

        {detail.description && (
          <div className="detail-section">
            <h3 className="classification__heading">Description</h3>
            <div className="note-text">{detail.description}</div>
          </div>
        )}

        {activities.length > 0 && (
          <div className="detail-section">
            <h3 className="classification__heading">Examples of Activities</h3>
            <ul className="activities-list">
              {activities.slice(0, 50).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        <NoteSection code={detail.code} />
      </div>

      <div className={`toast${copied ? " toast--show" : ""}`}>Copied</div>

      {addingToCollection && (
        <AddToCollectionModal
          item={asItem}
          onClose={() => setAddingToCollection(false)}
        />
      )}
    </div>
  );
}

function levelText(level: number): string {
  switch (level) {
    case 2:
      return "Sector";
    case 3:
      return "Subsector";
    case 4:
      return "Industry Group";
    case 5:
      return "Industry";
    case 6:
      return "National Industry";
    default:
      return `Level ${level}`;
  }
}

function ClassRow({
  label,
  code,
  value,
}: {
  label: string;
  code: string;
  value: string;
}) {
  return (
    <div className="class-row">
      <span className="class-row__label">{label}</span>
      <span className="class-row__value">
        {code && <span className="class-row__code">{code}</span>}
        {value}
      </span>
    </div>
  );
}

function NoteSection({ code }: { code: string }) {
  const { notes, setNote, deleteNote } = useAppData();
  const note = notes[code];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setEditing(false);
    setDraft("");
  }, [code]);

  function startEdit() {
    setDraft(note?.text ?? "");
    setEditing(true);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed) {
      setNote(code, trimmed);
    } else if (note) {
      deleteNote(code);
    }
    setEditing(false);
  }

  return (
    <div className="note-section">
      <h3 className="classification__heading">Note</h3>
      {editing ? (
        <>
          <textarea
            className="note-input"
            value={draft}
            autoFocus
            placeholder="Add a note for this code…"
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="note-actions">
            <button className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={save}>
              Save
            </button>
          </div>
        </>
      ) : note ? (
        <>
          <div className="note-text">{note.text}</div>
          <div className="note-actions">
            <button className="btn" onClick={startEdit}>
              Edit
            </button>
            <button
              className="btn btn--danger"
              onClick={() => deleteNote(code)}
            >
              Delete
            </button>
          </div>
        </>
      ) : (
        <button className="note-add" onClick={startEdit}>
          ＋ Add a note
        </button>
      )}
    </div>
  );
}
