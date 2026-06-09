import { useCallback, useEffect, useRef, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  FONT_FAMILIES,
  FONT_LABELS,
  FONT_SIZE_LABELS,
  FONT_SIZES,
  FREE_THEMES,
  PREMIUM_THEMES,
  THEME_LABELS,
  useSettings,
  type FontFamily,
  type Theme,
} from "../settings";
import { FREE_COLLECTIONS_MAX, FREE_FAVORITES_MAX, useAppData } from "../state";

const FONT_PREVIEW: Record<FontFamily, string> = {
  system: '-apple-system, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter Variable", sans-serif',
  atkinson: '"Atkinson Hyperlegible", sans-serif',
  quattro: '"iA Writer Quattro", sans-serif',
};

/** Detects the hidden unlock rhythm: tap-tap · pause · tap-tap · pause ·
 *  tap-tap (6 clicks). Mirrors the iOS app's SecretTapDetector. */
function useSecretRhythm(onTrigger: () => void) {
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const now = Date.now();
    const t = taps.current;
    if (t.length > 0 && now - t[t.length - 1] > 6000) t.length = 0;
    t.push(now);
    if (t.length > 6) t.splice(0, t.length - 6);
    if (t.length === 6) {
      const g = [
        t[1] - t[0],
        t[2] - t[1],
        t[3] - t[2],
        t[4] - t[3],
        t[5] - t[4],
      ];
      const pair = (x: number) => x < 700;
      const gap = (x: number) => x >= 700 && x <= 4500;
      if (pair(g[0]) && gap(g[1]) && pair(g[2]) && gap(g[3]) && pair(g[4])) {
        taps.current = [];
        onTrigger();
      }
    }
  }, [onTrigger]);
}

/** Small preview colors per theme: [outer background, accent]. */
const SWATCH: Record<Theme, [string, string]> = {
  system: ["#ffffff", "#1c1d21"],
  light: ["#f4f5f7", "#0a66c2"],
  dark: ["#1e2023", "#4da3ff"],
  "sky-blue": ["#c9d3de", "#5c7ba3"],
  "peach-pink": ["#eac3b7", "#c77f66"],
  "deep-charcoal": ["#262424", "#e8b87a"],
  blueberry: ["#3e4e66", "#b8c9e0"],
};

/** Which Help/Data/About modal is currently open. */
type InfoPanel = "howToUse" | "database" | "about" | null;

export function SettingsView() {
  const {
    theme,
    setTheme,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    unlocked,
    licenseKey,
    activateLicense,
    deactivateLicense,
    togglePremiumOverride,
  } = useSettings();

  const [flash, setFlash] = useState<string | null>(null);
  const secretTap = useSecretRhythm(() => {
    togglePremiumOverride().then(() => {
      setFlash("Premium override toggled");
      setTimeout(() => setFlash((f) => (f ? null : f)), 2500);
    });
  });

  // App.tsx forwards Help → How to Use / Database Details menu clicks here.
  // We open the matching modal so the menu items have a real destination
  // (not just a tab jump).
  const [panel, setPanel] = useState<InfoPanel>(null);
  useEffect(() => {
    function onOpen(e: Event) {
      const which = (e as CustomEvent<InfoPanel>).detail;
      if (which) setPanel(which);
    }
    window.addEventListener("snap:open-settings-modal", onOpen);
    return () =>
      window.removeEventListener("snap:open-settings-modal", onOpen);
  }, []);
  const closePanel = () => setPanel(null);

  return (
    <div className="settings-pane">
      <div className="settings-scroll">
        <h1 className="settings-title">Settings</h1>

        <section className="settings-section">
          <h2 className="settings-heading">Appearance</h2>
          <p className="settings-sub">Free themes</p>
          <div className="theme-grid">
            {FREE_THEMES.map((t) => (
              <ThemeCard
                key={t}
                theme={t}
                selected={theme === t}
                locked={false}
                onClick={() => setTheme(t)}
              />
            ))}
          </div>
          <p className="settings-sub">
            Premium themes {unlocked ? "" : "🔒"}
          </p>
          <div className="theme-grid">
            {PREMIUM_THEMES.map((t) => (
              <ThemeCard
                key={t}
                theme={t}
                selected={theme === t}
                locked={!unlocked}
                onClick={() => unlocked && setTheme(t)}
              />
            ))}
          </div>
          {!unlocked && (
            <p className="settings-hint">Unlock all premium themes below.</p>
          )}

          <p className="settings-sub">Font</p>
          <div className="theme-grid">
            {FONT_FAMILIES.map((f) => (
              <button
                key={f}
                className={`theme-card${
                  fontFamily === f ? " theme-card--selected" : ""
                }`}
                onClick={() => setFontFamily(f)}
              >
                <span
                  className="font-preview"
                  style={{ fontFamily: FONT_PREVIEW[f] }}
                >
                  Aa
                </span>
                <span className="theme-card__label">{FONT_LABELS[f]}</span>
                {fontFamily === f && (
                  <span className="theme-card__check">✓</span>
                )}
              </button>
            ))}
          </div>

          <p className="settings-sub">Text size</p>
          <div className="segmented">
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                className={`segmented__opt${
                  fontSize === s ? " segmented__opt--on" : ""
                }`}
                onClick={() => setFontSize(s)}
              >
                {FONT_SIZE_LABELS[s]}
              </button>
            ))}
          </div>
        </section>

        <PremiumSection
          unlocked={unlocked}
          licenseKey={licenseKey}
          activateLicense={activateLicense}
          deactivateLicense={deactivateLicense}
          togglePremiumOverride={togglePremiumOverride}
        />

        <section className="settings-section">
          <h2 className="settings-heading">Help</h2>
          <NavRow
            label="How to Use"
            onClick={() => setPanel("howToUse")}
          />
        </section>

        <section className="settings-section">
          <h2 className="settings-heading">Data</h2>
          <InfoRow label="Source" value="U.S. Census Bureau · SBA" />
          <InfoRow label="Snapshot" value="NAICS 2022 · 2,129 codes" />
          <InfoRow label="SBA Size Standards" value="Effective 2023-03-17" />
          <InfoRow label="License" value="Public domain (U.S. federal)" />
          <NavRow
            label="Database Details"
            onClick={() => setPanel("database")}
          />
        </section>

        <section className="settings-section">
          <h2 className="settings-heading">About</h2>
          <div className="info-row">
            <span className="info-row__label">NAICS Snap</span>
            <span
              className="info-row__value"
              onClick={secretTap}
              style={{ cursor: "default" }}
            >
              Version 1.0.0
            </span>
          </div>
          {flash && <p className="settings-hint">{flash}</p>}
          <NavRow label="About This App" onClick={() => setPanel("about")} />
        </section>
      </div>

      {panel === "howToUse" && <HowToUseModal onClose={closePanel} />}
      {panel === "database" && <DatabaseModal onClose={closePanel} />}
      {panel === "about" && <AboutModal onClose={closePanel} />}
    </div>
  );
}

function ThemeCard({
  theme,
  selected,
  locked,
  onClick,
}: {
  theme: Theme;
  selected: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  const [bg, accent] = SWATCH[theme];
  return (
    <button
      className={`theme-card${selected ? " theme-card--selected" : ""}${
        locked ? " theme-card--locked" : ""
      }`}
      onClick={onClick}
    >
      <span className="theme-swatch" style={{ background: bg }}>
        <span className="theme-swatch__dot" style={{ background: accent }} />
        {locked && <span className="theme-swatch__lock">🔒</span>}
      </span>
      <span className="theme-card__label">{THEME_LABELS[theme]}</span>
      {selected && <span className="theme-card__check">✓</span>}
    </button>
  );
}

function PremiumSection({
  unlocked,
  licenseKey,
  activateLicense,
  deactivateLicense,
  togglePremiumOverride,
}: {
  unlocked: boolean;
  licenseKey: string | null;
  activateLicense: (key: string) => Promise<void>;
  deactivateLicense: () => Promise<void>;
  togglePremiumOverride: () => Promise<void>;
}) {
  const { favorites, collections } = useAppData();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDev = import.meta.env.DEV;

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      await activateLicense(key);
      setKey("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    // Tauri 2 webview silently ignores window.confirm — use native ask().
    const ok = await ask("Deactivate premium on this computer?", {
      title: "Deactivate premium",
      kind: "warning",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await deactivateLicense();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-heading">Premium</h2>
      {unlocked ? (
        <div className="premium-box premium-box--on">
          <p className="premium-box__title">✓ Premium unlocked</p>
          <p className="premium-box__text">
            Thank you for supporting NAICS Snap.
          </p>
          {licenseKey && (
            <p className="premium-box__key">Key: {maskKey(licenseKey)}</p>
          )}
          <button className="btn" onClick={deactivate} disabled={busy}>
            Deactivate on this computer
          </button>
        </div>
      ) : (
        <div className="premium-box">
          <p className="premium-box__text">
            NAICS Snap is free to use. A one-time premium license unlocks all
            four premium themes plus unlimited favorites and collections.
          </p>
          <p className="premium-box__text">
            Free plan: {favorites.length} / {FREE_FAVORITES_MAX} favorites
            {" · "}
            {collections.length} / {FREE_COLLECTIONS_MAX} collections. Notes
            and export are always unlimited.
          </p>
          <p className="premium-box__text">
            Enter your license key (one key works on up to 2 computers):
          </p>
          <div className="license-row">
            <input
              className="text-input"
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              spellCheck={false}
              disabled={busy}
            />
            <button
              className="btn btn--primary"
              onClick={activate}
              disabled={busy || !key.trim()}
            >
              {busy ? "Activating…" : "Activate"}
            </button>
          </div>
          {error && <p className="license-error">{error}</p>}
        </div>
      )}
      {isDev && (
        <button
          className="btn dev-btn"
          onClick={() => togglePremiumOverride()}
        >
          Dev: toggle premium override
        </button>
      )}
    </section>
  );
}

function maskKey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}

function NavRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="nav-row" onClick={onClick}>
      <span className="nav-row__label">{label}</span>
      <span className="nav-row__chevron">›</span>
    </button>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function InfoModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="info-modal__header">
          <h3 className="info-modal__title">{title}</h3>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="info-modal__body">{children}</div>
      </div>
    </div>
  );
}

function ModalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="info-modal__section">
      <h4 className="info-modal__section-heading">{heading}</h4>
      {children}
    </div>
  );
}

function HowToUseModal({ onClose }: { onClose: () => void }) {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac/i.test(navigator.platform || navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl";

  return (
    <InfoModal title="How to Use" onClose={onClose}>
      <ModalSection heading="Search">
        <p>
          Type an industry name, a NAICS code, or a business term into the
          search bar. Everyday vocabulary works — common business shortcuts
          expand to the formal NAICS phrasing automatically.
        </p>
        <table className="howto-table">
          <tbody>
            <tr>
              <td>By industry</td>
              <td>
                <code>software publishers</code>, <code>restaurants</code>,{" "}
                <code>dental offices</code>
              </td>
            </tr>
            <tr>
              <td>By code</td>
              <td>
                <code>541512</code> · <code>5415</code> · <code>54</code>
              </td>
            </tr>
            <tr>
              <td>By shortcut</td>
              <td>
                <code>SaaS</code>, <code>3PL</code>, <code>HVAC</code>,{" "}
                <code>CPA</code>, <code>PR</code>
              </td>
            </tr>
          </tbody>
        </table>
      </ModalSection>

      <ModalSection heading="Browse">
        <p>
          The Browse tab opens at the 20 canonical NAICS sectors (color-coded).
          Click a sector to drill from 2-digit sector down to 6-digit national
          industry. Use the breadcrumb to jump back any number of levels.
        </p>
        <p className="howto-note">
          Manufacturing (31-33), Retail Trade (44-45) and Transportation
          (48-49) are grouped sectors — drilling in widens to all three
          prefixes automatically.
        </p>
      </ModalSection>

      <ModalSection heading="Favorites & Collections">
        <p>
          Click the ☆ on any code to save it to <strong>Favorites</strong>.
          Group related codes into named <strong>Collections</strong> —
          useful for SBA bid prep, marketing audience definitions, or
          industry research sets.
        </p>
        <p className="howto-note">
          Free plan: up to {FREE_FAVORITES_MAX} favorites and{" "}
          {FREE_COLLECTIONS_MAX} collections. Notes and export are always
          unlimited. Premium removes both caps.
        </p>
        <p>
          On Favorites, click <strong>Select</strong> to enter multi-select
          mode: pick rows then 📁 (add to a collection), 📄 (export PDF), or
          🗑 (remove).
        </p>
      </ModalSection>

      <ModalSection heading="SBA Size Standards">
        <p>
          Each 6-digit code shows the SBA "small business" size threshold —
          either <strong>annual receipts in $M</strong> or{" "}
          <strong>number of employees</strong>, depending on the industry.
          These are the thresholds federal contracting uses to determine
          small-business eligibility (set-asides, 8(a), HUBZone, etc.).
        </p>
        <p className="howto-note">
          Source: SBA Table of Small Business Size Standards. Thresholds
          drift independently of the NAICS revision cycle — verify the
          latest with SBA before bid submission.
        </p>
      </ModalSection>

      <ModalSection heading="Export">
        <table className="howto-table">
          <tbody>
            <tr>
              <td>Collection (CSV)</td>
              <td>Open a collection → ⋯ menu → Export as CSV</td>
            </tr>
            <tr>
              <td>Collection (PDF, A4)</td>
              <td>Open a collection → ⋯ menu → Export as PDF</td>
            </tr>
            <tr>
              <td>Favorites batch (PDF)</td>
              <td>Favorites → Select → 📄 icon</td>
            </tr>
            <tr>
              <td>Single code</td>
              <td>Detail pane → Copy buttons (code / code+title / full)</td>
            </tr>
          </tbody>
        </table>
      </ModalSection>

      <ModalSection heading="Keyboard Shortcuts">
        <table className="howto-table howto-table--kbd">
          <tbody>
            <tr>
              <td>
                <kbd>↑</kbd> <kbd>↓</kbd>
              </td>
              <td>Move through results</td>
            </tr>
            <tr>
              <td>
                <kbd>↓</kbd> (in search)
              </td>
              <td>Jump from the search box to the first result</td>
            </tr>
            <tr>
              <td>
                <kbd>Esc</kbd>
              </td>
              <td>Close overlay / return focus to search</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}K</kbd>
              </td>
              <td>Command palette (search anywhere, jump anywhere)</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}F</kbd>
              </td>
              <td>Focus search</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}C</kbd>
              </td>
              <td>Copy the selected code</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}D</kbd>
              </td>
              <td>Add / remove favorite</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}1</kbd>–<kbd>{mod}5</kbd>
              </td>
              <td>
                Jump tabs (Search · Browse · Favorites · Collections ·
                Settings)
              </td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}E</kbd>
              </td>
              <td>Export the open collection as CSV</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}N</kbd>
              </td>
              <td>New search</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}{","}</kbd>
              </td>
              <td>Settings</td>
            </tr>
          </tbody>
        </table>
      </ModalSection>

      <ModalSection heading="Tips">
        <ul>
          <li>
            Search expands business shortcuts: <code>SaaS</code> → "software
            publishers", <code>3PL</code> → "logistics", <code>CPA</code> →
            "accounting services". 110+ shortcuts shipped.
          </li>
          <li>
            US spellings only — NAICS is a U.S. dataset and the bundled
            vocabulary uses American English ("aluminum", "tire", "labor").
          </li>
          <li>
            Drag the divider between the result list and detail pane to
            resize. The position is remembered between sessions.
          </li>
          <li>
            NAICS is revised every 5 years (last: 2022, next: 2027). Your
            favorites and collections survive a revision — they're keyed by
            code string.
          </li>
        </ul>
      </ModalSection>
    </InfoModal>
  );
}

function DatabaseModal({ onClose }: { onClose: () => void }) {
  return (
    <InfoModal title="Database Details" onClose={onClose}>
      <ModalSection heading="Source">
        <p>
          Data is sourced from the{" "}
          <strong>U.S. Census Bureau NAICS 2022</strong> publication and the{" "}
          <strong>SBA Table of Small Business Size Standards</strong>. Both
          are U.S. federal public-domain datasets.
        </p>
        <table className="info-table">
          <tbody>
            <tr>
              <td>NAICS source</td>
              <td>
                <code>census.gov/naics</code>
              </td>
            </tr>
            <tr>
              <td>SBA source</td>
              <td>SBA Office of Size Standards (XLSX)</td>
            </tr>
            <tr>
              <td>Format</td>
              <td>SQLite + FTS5 (bundled)</td>
            </tr>
            <tr>
              <td>NAICS revision</td>
              <td>2022 (in force 2022-01-01)</td>
            </tr>
            <tr>
              <td>SBA effective date</td>
              <td>2023-03-17</td>
            </tr>
          </tbody>
        </table>
      </ModalSection>

      <ModalSection heading="Coverage">
        <table className="info-table">
          <tbody>
            <tr>
              <td>Total NAICS rows (all levels)</td>
              <td>2,129</td>
            </tr>
            <tr>
              <td>National industries (6-digit)</td>
              <td>1,012</td>
            </tr>
            <tr>
              <td>Canonical sectors</td>
              <td>20 (24 raw level-2 rows collapsed)</td>
            </tr>
            <tr>
              <td>Business-term shortcuts</td>
              <td>110+ (SaaS, 3PL, HVAC, CPA, …)</td>
            </tr>
            <tr>
              <td>SBA size standards</td>
              <td>All 6-digit industries covered</td>
            </tr>
            <tr>
              <td>Bundled database size</td>
              <td>~6.7 MB</td>
            </tr>
          </tbody>
        </table>
      </ModalSection>

      <ModalSection heading="What's Included">
        <ul>
          <li>Full NAICS 2022 hierarchy (Sector → Subsector → Industry Group → Industry → National Industry)</li>
          <li>Each row's official title and description</li>
          <li>Examples of activities (the "index" entries) — what falls in each code</li>
          <li>SBA size standard per 6-digit industry — annual receipts or employee count</li>
          <li>Full-text search index (FTS5) over codes, titles, descriptions, and activity examples</li>
          <li>NAICS concordance table (mappings between revision years — staged for future UI)</li>
        </ul>
      </ModalSection>

      <ModalSection heading="What's Not Included">
        <ul>
          <li>
            <strong>NAICS 2017 / 2027</strong> — only the 2022 revision is
            bundled. Concordance data is shipped for a future code-change UI
          </li>
          <li>
            <strong>State / county / MSA breakdowns</strong> — NAICS is a
            classification only; County Business Patterns and similar
            economic data are not bundled
          </li>
          <li>
            <strong>Employer counts or payroll</strong> — see the U.S.
            Census Bureau's CBP and SUSB programs for that
          </li>
          <li>
            <strong>Business listings</strong> — NAICS Snap classifies, it
            does not enumerate companies
          </li>
          <li>
            <strong>SIC cross-reference</strong> — staged for a future
            release (the data exists upstream)
          </li>
        </ul>
      </ModalSection>

      <ModalSection heading="Update Cadence">
        <p>
          NAICS is revised on a <strong>5-year cycle</strong>. The next
          revision is <strong>NAICS 2027</strong>, expected late 2026 — an
          updated bundle will ship as a free app update. SBA size standards
          drift independently and update when SBA publishes a new schedule.
        </p>
      </ModalSection>

      <ModalSection heading="License — U.S. Federal Public Domain">
        <p className="info-modal__ogl">
          NAICS and SBA size-standard data are works of the United States
          federal government and are in the public domain (17 U.S.C. § 105).
          No attribution is legally required, but we credit the U.S. Census
          Bureau and SBA as the authoritative sources.<br />
          NAICS Snap is not affiliated with the U.S. Census Bureau or the
          U.S. Small Business Administration. For regulatory or contracting
          decisions, always verify with the official sources or a qualified
          professional.
        </p>
      </ModalSection>
    </InfoModal>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <InfoModal title="About NAICS Snap" onClose={onClose}>
      <div className="info-modal__app-header">
        <div className="info-modal__app-name">NAICS Snap</div>
        <div className="info-modal__app-version">Version 1.0.0</div>
        <div className="info-modal__app-tagline">
          NAICS 2022 industry codes in seconds. Offline.
        </div>
      </div>

      <ModalSection heading="Why This App">
        <p>
          The North American Industry Classification System is the backbone
          of how the U.S. economy is measured, taxed, and contracted. SBA
          set-asides, federal solicitations, marketing audience targeting,
          credit risk models — all of them key off a NAICS code.
        </p>
        <p>
          But finding the right code is slow. The Census Bureau's official
          tool needs a connection and refuses to surface SBA size standards
          inline. NAICS Snap is the opposite: a fast, fully offline copy of
          2,129 NAICS 2022 codes with SBA thresholds attached to every
          6-digit industry, plus 110+ business-term shortcuts so you can
          search the way you actually talk.
        </p>
      </ModalSection>

      <ModalSection heading="Free for Everyone">
        <p>
          NAICS Snap is free to use. Every search, browse, favorite, and
          collection is unlocked by default — no ads, no subscription, no
          account required.
        </p>
        <p>
          A one-time premium license unlocks all four premium themes and
          removes the free-plan limits on favorites ({FREE_FAVORITES_MAX})
          and collections ({FREE_COLLECTIONS_MAX}). It's a genuine help if
          you find the app saves you time.
        </p>
      </ModalSection>

      <ModalSection heading="Data Source">
        <p>
          All classification data comes from the{" "}
          <strong>U.S. Census Bureau NAICS 2022</strong> publication. Size
          standards come from the{" "}
          <strong>SBA Table of Small Business Size Standards</strong>{" "}
          (effective 2023-03-17). Both are U.S. federal public-domain works
          (17 U.S.C. § 105).
        </p>
        <p className="info-modal__ogl">
          NAICS Snap is not affiliated with the U.S. Census Bureau or the
          U.S. Small Business Administration. Always verify final
          classification and any SBA size determination with the official
          sources or a qualified professional before relying on them for
          regulatory, contracting, or financial use.
        </p>
      </ModalSection>

      <ModalSection heading="Privacy">
        <p>
          All data stays on your computer. NAICS Snap does not collect,
          transmit, or share any personal information. The only network
          request is an optional license-key activation check with Lemon
          Squeezy (our payment processor) when you enter a premium key.
        </p>
      </ModalSection>

      <ModalSection heading="Disclaimer">
        <p>
          NAICS Snap is for reference purposes only. Industry classification
          and SBA size determinations are matters for the U.S. Census
          Bureau, the SBA, and contracting officers. Always verify final
          NAICS code assignment, size standards, set-aside eligibility, and
          any other regulatory determination with the official sources or a
          qualified professional before submitting a bid or making a filing.
        </p>
      </ModalSection>

      <ModalSection heading="Open Source">
        <div className="info-modal__oss-row">
          <strong>rusqlite</strong>
          <span>SQLite bindings for Rust. MIT License.</span>
        </div>
        <div className="info-modal__oss-row">
          <strong>printpdf</strong>
          <span>PDF generation for Rust. MIT License.</span>
        </div>
        <div className="info-modal__oss-row">
          <strong>cmdk</strong>
          <span>Command palette by Vercel. MIT License.</span>
        </div>
        <div className="info-modal__oss-row">
          <strong>React</strong>
          <span>UI framework by Meta. MIT License.</span>
        </div>
        <div className="info-modal__oss-row">
          <strong>Tauri</strong>
          <span>Desktop app framework. MIT / Apache 2.0.</span>
        </div>
        <div className="info-modal__oss-row">
          <strong>Inter · Atkinson Hyperlegible · iA Writer Quattro</strong>
          <span>Bundled fonts. OFL 1.1.</span>
        </div>
        <div className="info-modal__oss-row">
          <strong>NanumGothic</strong>
          <span>Korean glyph fallback for PDF export. OFL 1.1.</span>
        </div>
      </ModalSection>
    </InfoModal>
  );
}
