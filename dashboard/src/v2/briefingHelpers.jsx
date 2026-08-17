import { Link } from 'react-router-dom'
import { IconAlertTriangle, IconInfo } from './icons.jsx'

// category (configuration_gaps/data_gaps/human_attention's own real field, Batch 14) -> where in
// V2 that category's config actually lives. Purely presentational routing over an already-real
// field -- never a guess at WHICH ICP/offering/motion to fix, just which PAGE has the editor.
export const CATEGORY_LINK = {
  configuration: { to: '/v2/icps-offerings', label: 'Open ICPs & Offerings' },
  coverage: { to: '/v2/accounts', label: 'Open Accounts' },
  data: { to: '/v2/accounts', label: 'Open Accounts' },
  execution: { to: '/v2/pipeline', label: 'Open Pipeline' },
  market_intelligence: { to: '/v2/market-intelligence', label: 'Open Market Intelligence' },
}

// A configuration_gaps item's own relates_to_stage (Batch 14, real field) points at a more
// specific tab than the generic category mapping above can.
export const STAGE_LINK = {
  offering_matched: { to: '/v2/icps-offerings?tab=offerings', label: 'Open Offerings' },
  motion_ready: { to: '/v2/icps-offerings?tab=motion', label: 'Open GTM Motion' },
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
