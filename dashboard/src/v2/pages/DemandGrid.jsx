import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDemandGrid, getDemandGridCompanies, formatApiError } from '../api.js'
import { IconAlertTriangle } from '../icons.jsx'

// cell.status -> badge tone + label. "applicable" is a CONFIGURATION fact (Batch 9's own
// applicable_icps), never rephrased as "demand exists" -- matched_account_count is the separate,
// real evidence field (Part 8's own explicit warning against collapsing the two).
const CELL_META = {
  applicable: { badge: 'v2-badge-success', label: 'Applicable' },
  excluded: { badge: 'v2-badge-danger', label: 'Excluded' },
  unconfigured: { badge: 'v2-badge-neutral', label: 'Unconfigured' },
}

function GridCell({ cell, icpId, onSelect, isSelected }) {
  const meta = CELL_META[cell.status] || CELL_META.unconfigured
  const clickable = cell.status === 'applicable' && cell.matched_account_count > 0

  return (
    <td>
      <button
        type="button"
        className={`v2-grid-cell${clickable ? ' clickable' : ''}`}
        onClick={clickable ? () => onSelect(icpId, cell.offering) : undefined}
        disabled={!clickable}
        style={isSelected ? { outline: '2px solid var(--v2-accent)', outlineOffset: 2, borderRadius: 6 } : undefined}
      >
        <span className={`v2-badge ${meta.badge}`}>{meta.label}</span>
        {cell.status === 'applicable' && (
          <span className="v2-grid-cell-count">
            {cell.matched_account_count} matched account{cell.matched_account_count === 1 ? '' : 's'}
          </span>
        )}
      </button>
    </td>
  )
}

function DrilldownPanel({ icpId, icpName, offering, onClose }) {
  const [companies, setCompanies] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setCompanies(null)
    getDemandGridCompanies(icpId)
      .then(data => { if (!cancelled) setCompanies(data.companies) })
      .catch(err => { if (!cancelled) setError(formatApiError(err)) })
    return () => { cancelled = true }
  }, [icpId])

  return (
    <div className="v2-card" style={{ marginTop: '1.5rem' }}>
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{icpName} × {offering} — matched accounts</span>
        <button type="button" className="v2-theme-toggle" onClick={onClose} aria-label="Close" style={{ width: 28, height: 28 }}>×</button>
      </div>
      <p className="v2-placeholder-note">
        Companies matching this ICP (Batch 8's ICPMatch) -- offering fit for an applicable cell is a
        configuration fact of the ICP match alone, so this same list applies to every applicable offering
        in this ICP's row.
      </p>
      {error ? (
        <div className="v2-state v2-state-error">{error}</div>
      ) : companies === null ? (
        <div className="v2-skeleton-row" />
      ) : companies.length === 0 ? (
        <div className="v2-state">No matched companies.</div>
      ) : (
        <div className="v2-evidence-list">
          {companies.map(c => (
            <div key={c.company_id} className="v2-evidence-item">
              <div className="v2-evidence-item-head">
                <Link to={`/v2/accounts/${c.company_id}`} className="v2-evidence-item-title" style={{ color: 'inherit' }}>
                  {c.company_name || `Company #${c.company_id}`}
                </Link>
              </div>
              <div className="v2-evidence-item-body">{(c.reasons || []).join(' · ')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Answers "what demand/problem areas are we seeing, and how do they relate to ICPs and
// Offerings" -- decision-oriented (Part 2), distinct from Market Intelligence's evidence/trend
// focus. Every cell status is a pure configuration fact (Batch 9); every count is real ICPMatch
// evidence (Batch 8) -- never a re-derived offering match, never a fabricated demand number.
export default function DemandGrid() {
  const [grid, setGrid] = useState(null)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null) // { icpId, icpName, offering }

  useEffect(() => {
    getDemandGrid()
      .then(setGrid)
      .catch(err => setError(formatApiError(err)))
  }, [])

  return (
    <div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load the demand grid: {error}</div>
          </div>
        </div>
      ) : grid === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 240 }} />
      ) : grid.icps.length === 0 || grid.offerings.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">No ICPs or offerings are configured yet for this tenant.</div>
        </div>
      ) : (
        <>
          <div className="v2-grid-scroll">
            <table className="v2-demand-grid">
              <thead>
                <tr>
                  <th>ICP</th>
                  {grid.offerings.map(o => <th key={o}>{o}</th>)}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map(row => (
                  <tr key={row.icp_id}>
                    <th scope="row">{row.icp_name}</th>
                    {row.cells.map(cell => (
                      <GridCell
                        key={cell.offering}
                        cell={cell}
                        icpId={row.icp_id}
                        isSelected={selected?.icpId === row.icp_id && selected?.offering === cell.offering}
                        onSelect={(icpId, offering) => setSelected({ icpId, icpName: row.icp_name, offering })}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="v2-placeholder-note" style={{ marginTop: '0.9rem' }}>
            "Applicable" means this offering is configured for that ICP -- it does not by itself mean demand
            exists. The account count under an applicable cell is real, separate evidence (ICPMatch).
          </p>

          {selected && (
            <DrilldownPanel
              icpId={selected.icpId}
              icpName={selected.icpName}
              offering={selected.offering}
              onClose={() => setSelected(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
