import { levelLabel, sectorColor, sectorDisplayCode } from "../sectors";
import type { SearchResult } from "../types";

interface Props {
  item: SearchResult;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

export function CodeRow({
  item,
  selected,
  favorite,
  onSelect,
  onToggleFavorite,
}: Props) {
  const sectorTag = sectorDisplayCode(item.sectorCode);
  const level = levelLabel(item.level);
  return (
    <div
      className={`code-row${selected ? " code-row--selected" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
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
          {level && <span className="badge badge--level">{level}</span>}
        </div>
        <div className="code-row__desc">{item.title}</div>
        {item.sectorTitle && (
          <div className="code-row__chapter">
            {sectorTag} · {item.sectorTitle}
          </div>
        )}
      </div>
      <button
        className={`star-btn${favorite ? " star-btn--on" : ""}`}
        title={favorite ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
      >
        {favorite ? "★" : "☆"}
      </button>
    </div>
  );
}
