import { useEffect, useState } from "react";
import { listChildren, listSectors } from "../api";
import { levelLabel, sectorColor, sectorDisplayCode } from "../sectors";
import type { HierarchyNode, SectorEntry } from "../types";

interface Crumb {
  code: string;
  title: string;
}

interface Props {
  selectedCode: string | null;
  onSelect: (code: string) => void;
}

/** Browse tab — drill the NAICS hierarchy from the 20 sectors all the way down
 *  to 6-digit national industries. Selecting a 6-digit row opens the Detail
 *  pane (handled by the parent via onSelect). */
export function BrowseView({ selectedCode, onSelect }: Props) {
  const [sectors, setSectors] = useState<SectorEntry[]>([]);
  /** Drill path. Empty = sector root. */
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [children, setChildren] = useState<HierarchyNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSectors()
      .then(setSectors)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const last = crumbs[crumbs.length - 1];
    if (!last) {
      setChildren([]);
      return;
    }
    listChildren(last.code)
      .then(setChildren)
      .catch((e) => setError(String(e)));
  }, [crumbs]);

  function openSector(s: SectorEntry) {
    setCrumbs([{ code: s.code, title: s.title }]);
  }

  function openNode(n: HierarchyNode) {
    if (n.level >= 6 || n.childCount === 0) {
      onSelect(n.code);
      return;
    }
    setCrumbs((prev) => [...prev, { code: n.code, title: n.title }]);
  }

  function jumpTo(idx: number) {
    setCrumbs((prev) => prev.slice(0, idx + 1));
  }

  function reset() {
    setCrumbs([]);
  }

  if (error) {
    return (
      <div className="list-pane">
        <div className="state-msg state-msg--error">{error}</div>
      </div>
    );
  }

  // Root: 20 sectors with colored chips.
  if (crumbs.length === 0) {
    return (
      <div className="list-pane">
        <div className="pane-header">
          <h2 className="pane-header__title">Browse</h2>
          <span className="pane-header__count">{sectors.length} sectors</span>
        </div>
        <div className="list-scroll">
          {sectors.map((s) => (
            <button
              key={s.code}
              className="sector-row"
              onClick={() => openSector(s)}
            >
              <span
                className="sector-row__chip"
                style={{ background: sectorColor(s.code) }}
              >
                {s.displayCode}
              </span>
              <span className="sector-row__main">
                <span className="sector-row__title">{s.title}</span>
                <span className="sector-row__sub">Sector</span>
              </span>
              <span className="sector-row__chevron">›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Drilled-in: breadcrumb + children list.
  const sectorCode = crumbs[0].code;
  return (
    <div className="list-pane">
      <div className="pane-header pane-header--detail">
        <button className="back-btn" onClick={reset} title="Back to sectors">
          ‹
        </button>
        <div className="collection-head">
          <span
            className="sector-row__chip"
            style={{
              background: sectorColor(sectorCode),
              width: 30,
              height: 30,
              fontSize: 11,
            }}
          >
            {sectorDisplayCode(sectorCode)}
          </span>
          <div>
            <div className="collection-head__name">
              {crumbs[crumbs.length - 1].title}
            </div>
            <div className="collection-head__count">
              {children.length}{" "}
              {children.length === 1 ? "child" : "children"}
            </div>
          </div>
        </div>
      </div>

      <div className="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={c.code}>
            {i > 0 && <span className="breadcrumb__sep"> › </span>}
            <span
              className="breadcrumb__crumb"
              onClick={() => jumpTo(i)}
              title={`Jump to ${c.code}`}
            >
              {c.code}
            </span>
          </span>
        ))}
      </div>

      <div className="list-scroll">
        {children.length === 0 && (
          <div className="state-msg">
            <p>No deeper levels.</p>
          </div>
        )}
        {children.map((n) => {
          const leaf = n.level >= 6 || n.childCount === 0;
          return (
            <div
              key={n.code}
              className={`code-row${
                leaf && n.code === selectedCode ? " code-row--selected" : ""
              }`}
              role="button"
              tabIndex={0}
              onClick={() => openNode(n)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openNode(n);
                }
              }}
            >
              <div
                className="code-row__bar"
                style={{ background: sectorColor(sectorCode) }}
              />
              <div className="code-row__main">
                <div className="code-row__top">
                  <span className="code-row__code">{n.code}</span>
                  <span className="badge badge--level">{levelLabel(n.level)}</span>
                </div>
                <div className="code-row__desc">{n.title}</div>
                {!leaf && (
                  <div className="code-row__chapter">
                    {n.childCount} child{n.childCount === 1 ? "" : "ren"} ›
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
