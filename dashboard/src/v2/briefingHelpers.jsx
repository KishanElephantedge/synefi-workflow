import { Link } from 'react-router-dom'
import { IconAlertTriangle, IconInfo, IconCheckCircle } from './icons.jsx'

// category (configuration_gaps/data_gaps/human_attention's own real field, Batch 14) -> where in
// V2 that category's config actually lives. Purely presentational routing over an already-real
// field -- never a guess at WHICH ICP/offering/motion to fix, just which PAGE has the editor.
export const CATEGORY_LINK = {
  configuration: { to: '/v2/settings?tab=icps-offerings', label: 'Open ICPs & Offerings' },
  coverage: { to: '/v2/accounts', label: 'Open Accounts' },
  data: { to: '/v2/accounts', label: 'Open Accounts' },
  execution: { to: '/v2/pipeline', label: 'Open Pipeline' },
  market_intelligence: { to: '/v2/market-intelligence', label: 'Open Market Intelligence' },
}

// A configuration_gaps item's own relates_to_stage (Batch 14, real field) points at a more
// specific tab than the generic category mapping above can.
export const STAGE_LINK = {
  offering_matched: { to: '/v2/settings?tab=icps-offerings', label: 'Open Offerings' },
  motion_ready: { to: '/v2/settings?tab=icps-offerings', label: 'Open GTM Motion' },
}

const SEVERITY_ICON = { danger: IconAlertTriangle, warning: IconAlertTriangle, info: IconInfo }

// Real backend text (e.g. AutonomousRun.error_message) can be long and can embed a raw
// exception string, sometimes itself containing JSON. Truncated for DISPLAY only -- the
// underlying text is never altered, paraphrased, or re-derived, just visually shortened so one
// operational issue doesn't dump a wall of raw JSON into the list.
export function truncate(text, max = 140) {
  if (!text) return text
  return text.length > max ? `${text.slice(0, max).trim()}…` : text
}

export function CheckRow({ severity, description, meta, link, maxLength = 140 }) {
  const Icon = SEVERITY_ICON[severity] || IconInfo
  return (
    <div className={`v2-check-row severity-${severity}`}>
      <div className="v2-check-row-icon"><Icon width={15} height={15} /></div>
      <div className="v2-check-row-body">
        <div className="v2-check-row-text">
          <div className="v2-check-row-desc">{truncate(description, maxLength)}</div>
          {meta && <div className="v2-check-row-meta">{truncate(meta, Math.max(maxLength - 40, 60))}</div>}
        </div>
        {link && (
          <div className="v2-check-row-action">
            <Link to={link.to}>{link.label} →</Link>
          </div>
        )}
      </div>
    </div>
  )
}

export function Section({ title, children, empty }) {
  return (
    <div className="v2-section">
      <div className="v2-section-title">{title}</div>
      {empty ? <div className="v2-card"><div className="v2-state">{empty}</div></div> : children}
    </div>
  )
}

// Shows at most `limit` items inline, then a real "View all N" link to a dedicated full-list
// page, instead of unrolling every gap onto the main Briefing page -- that page stays scannable,
// and nothing is hidden, just moved one click away.
export function PreviewSection({ title, items, limit, renderItem, emptyText, viewAllTo }) {
  if (items.length === 0) {
    return <Section title={title} empty={emptyText} />
  }
  const shown = items.slice(0, limit)
  return (
    <div className="v2-section">
      <div className="v2-section-title">
        {title} <span className="v2-badge v2-badge-neutral">{items.length}</span>
      </div>
      {shown.map(renderItem)}
      {items.length > limit && (
        <Link to={viewAllTo} className="v2-btn" style={{ display: 'inline-flex', marginTop: '0.4rem', textDecoration: 'none' }}>
          View all {items.length} →
        </Link>
      )}
    </div>
  )
}

// ---------- V2 Briefing redesign (2026-08-18 UI audit, visual polish pass same day) ----------
// A contained, fixed-height category card: icon + title + real count, up to `limit` compact
// title+subtitle items, and a real "View all N" link to the same full-list pages PreviewSection
// already routes to. Deliberately never renders a raw backend sentence -- callers pass structured
// `title`/`subtitle` per item (from governance.py's own title/short_description fields where they
// exist), not free-text description strings. Empty state gets a genuine green check + "healthy"
// framing -- per the lead's own instruction, a real zero-issue count is a positive signal, not
// just an absence of text, and should read as one at a glance.
export function MiniCard({ icon, title, items, limit, emptyText, viewAllTo, renderItem }) {
  return (
    <div className="v2-mini-card">
      <div className="v2-mini-card-head">
        {icon && <span className="v2-mini-card-icon">{icon}</span>}
        <span>{title}</span>
        <span className="v2-badge v2-badge-neutral">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="v2-mini-card-empty healthy">
          <IconCheckCircle width={16} height={16} />
          <span>{emptyText}</span>
        </div>
      ) : (
        <div className="v2-mini-list">{items.slice(0, limit).map(renderItem)}</div>
      )}
      {viewAllTo && items.length > limit && (
        <div className="v2-mini-card-footer">
          <Link to={viewAllTo}>View all {items.length} →</Link>
        </div>
      )}
    </div>
  )
}

export function MiniItem({ severity = 'warning', title, subtitle }) {
  return (
    <div className="v2-mini-item">
      <div className={`v2-mini-item-dot severity-${severity}`} />
      <div className="v2-mini-item-body">
        <div className="v2-mini-item-title">{title}</div>
        {subtitle && <div className="v2-mini-item-subtitle">{subtitle}</div>}
      </div>
    </div>
  )
}

export function KpiTile({ icon, label, value, context, tone }) {
  return (
    <div className={`v2-kpi-tile${tone ? ` tone-${tone}` : ''}`}>
      <div className="v2-kpi-tile-label">{icon}{label}</div>
      <div className={`v2-kpi-tile-value${tone ? ` ${tone}` : ''}`}>{value}</div>
      {context && <div className="v2-kpi-tile-context">{context}</div>}
    </div>
  )
}

export function formatUsd(value) {
  if (value == null) return '—'
  return `$${Number(value).toLocaleString()}`
}

// Real system label (governance.py's own "v1_discovery" | "gtm_os" tag on each operational
// issue, added so legacy V1 discovery-pipeline failures are never presented as if they were the
// new GTM-OS system's own health) -> a short caption, combined with a real date into one
// subtitle line (e.g. "V1 Discovery · Aug 18") rather than a separate floating badge -- reads
// faster as one fact ("this is old, from the other system") instead of two disconnected labels.
export const SYSTEM_LABEL = { v1_discovery: 'V1 Discovery', gtm_os: 'GTM-OS' }

export function SystemBadge({ system }) {
  if (!system) return null
  return <span className={`v2-system-badge ${system}`}>{SYSTEM_LABEL[system] || system}</span>
}

// "Aug 18" -- short, real date for the System Health subtitle line. No relative "N days ago"
// here (unlike timeAgo() for the snapshot itself) since a run's own date is a fixed historical
// fact worth reading exactly, not a freshness signal that decays.
export function shortDate(isoString) {
  if (!isoString) return null
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Plain "N minutes/hours ago" for a snapshot's computed_at -- so the Briefing page honestly
// communicates it's reading a periodic snapshot (see governance.py's GovernanceSnapshot), not a
// live number, without requiring the reader to parse a raw timestamp.
export function timeAgo(isoString) {
  if (!isoString) return null
  const diffMs = Date.now() - new Date(isoString).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}
