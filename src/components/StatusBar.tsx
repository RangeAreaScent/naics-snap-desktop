/** Phase D (SNAP_DESKTOP_IMPROVEMENT_PLAN.md) — bottom status bar.
 *
 * Single fixed-height strip at the bottom of the window. Left: dataset
 * metadata (codes count, snapshot version, source name) so the user
 * always knows what bundle they're querying. Right: a quiet hint that
 * ⌘K opens the command palette.
 *
 * Stats are hard-coded for the bundled NAICS 2022 dataset — these
 * numbers change on the 5-year revision cadence (next: NAICS 2027).
 */
export function StatusBar() {
  return (
    <div className="status-bar" aria-label="Status">
      <div className="status-bar__left">
        <span className="status-bar__dot" aria-hidden />
        <span className="status-bar__text">
          2,129 codes · NAICS 2022 · US Census Bureau
        </span>
      </div>
      <div className="status-bar__right">
        <span className="status-bar__hint">
          Press <kbd className="status-bar__kbd">⌘K</kbd> for commands
        </span>
      </div>
    </div>
  );
}
