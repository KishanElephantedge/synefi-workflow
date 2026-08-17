import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getIcpsOfferings, putIcps, putOfferings, putGtmMotions, formatApiError } from '../api.js'
import { IconAlertTriangle, IconEdit, IconCheck } from '../icons.jsx'

const CONFIG_TABS = ['ICPs', 'Offerings', 'Matrix', 'GTM Motion']

// Slug <-> tab-label mapping so other pages (Governance) can deep-link to a specific tab, e.g.
// /v2/icps-offerings?tab=offerings. Purely presentational routing -- no config/business logic.
const TAB_SLUGS = { icps: 'ICPs', offerings: 'Offerings', matrix: 'Matrix', motion: 'GTM Motion' }

const HIRING_SIGNAL_ROLES = ['head_of_sales', 'sdr', 'ae', 'marketing', 'gtm']

// ---------- small shared form primitives ----------

function ChipCheckboxGroup({ options, selected, onToggle, getKey = o => o, getLabel = o => o }) {
  if (options.length === 0) {
    return <p className="v2-field-hint" style={{ marginTop: 0 }}>Nothing configured yet to choose from.</p>
  }
  return (
    <div className="v2-chip-group">
      {options.map(opt => {
        const key = getKey(opt)
        const checked = selected.includes(key)
        return (
          <label key={key} className={`v2-chip-option${checked ? ' checked' : ''}`}>
            <input type="checkbox" checked={checked} onChange={() => onToggle(key)} style={{ display: 'none' }} />
            {checked && <IconCheck width={11} height={11} />}
            {getLabel(opt)}
          </label>
        )
      })}
    </div>
  )
}

// Array-of-strings fields (target_functions, exclusions, ...) edited as one line per item --
// simplest control that can't silently mangle a string containing a comma, unlike a comma-split
// input would.
function ListField({ label, hint, value, onChange }) {
  return (
    <div className="v2-field">
      <label className="v2-field-label">{label}</label>
      <textarea
        className="v2-textarea"
        value={(value || []).join('\n')}
        onChange={e => onChange(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
        placeholder="One per line"
      />
      {hint && <div className="v2-field-hint">{hint}</div>}
    </div>
  )
}

function TextField({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="v2-field">
      <label className="v2-field-label">{label}</label>
      <input
        className="v2-input"
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => onChange(type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
      />
    </div>
  )
}

function StatusPill({ complete }) {
  return complete
    ? <span className="v2-badge v2-badge-success">Configured</span>
    : <span className="v2-badge v2-badge-warning">Not fully configured</span>
}

function FormMessage({ error, success }) {
  if (error) return <div className="v2-form-message error">{error}</div>
  if (success) return <div className="v2-form-message success">{success}</div>
  return null
}

// ---------- ICPs ----------

function IcpEditForm({ icp, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(icp)
  const dirty = JSON.stringify(form) !== JSON.stringify(icp)

  return (
    <div>
      <FormMessage error={error} />
      <TextField label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
      <div className="v2-field-row">
        <TextField label="Revenue minimum (USD)" type="number" value={form.revenue_min_usd} onChange={v => setForm({ ...form, revenue_min_usd: v })} placeholder="Not configured" />
        <TextField label="Revenue maximum (USD)" type="number" value={form.revenue_max_usd} onChange={v => setForm({ ...form, revenue_max_usd: v })} placeholder="Not configured" />
      </div>
      <TextField label="Max sales team size" type="number" value={form.sales_team_size_max} onChange={v => setForm({ ...form, sales_team_size_max: v })} placeholder="No constraint" />
      <div className="v2-field">
        <label className="v2-field-label">Trigger mode</label>
        <select className="v2-select" value={form.trigger_mode} onChange={e => setForm({ ...form, trigger_mode: e.target.value })}>
          <option value="requires_presence">Requires presence (must be hiring one of these roles)</option>
          <option value="requires_absence">Requires absence (must NOT be hiring one of these roles)</option>
        </select>
      </div>
      <div className="v2-field">
        <label className="v2-field-label">Trigger hiring roles</label>
        <ChipCheckboxGroup
          options={HIRING_SIGNAL_ROLES}
          selected={form.trigger_hiring_roles || []}
          onToggle={role => setForm({
            ...form,
            trigger_hiring_roles: (form.trigger_hiring_roles || []).includes(role)
              ? form.trigger_hiring_roles.filter(r => r !== role)
              : [...(form.trigger_hiring_roles || []), role],
          })}
        />
      </div>
      <ListField label="Description" hint="Free text, one line" value={form.description ? [form.description] : []} onChange={arr => setForm({ ...form, description: arr.join(' ') || null })} />
      <div className="v2-btn-row">
        <button type="button" className="v2-btn v2-btn-primary" disabled={!dirty || saving} onClick={() => onSave(form)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="v2-btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  )
}

function IcpCard({ icp, allIcps, onSaved, canWrite }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async (form) => {
    setSaving(true)
    setError(null)
    try {
      const updated = allIcps.map(i => (i.id === icp.id ? { ...form } : i))
      const data = await putIcps(updated)
      onSaved(data)
      setEditing(false)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="v2-card" style={{ marginBottom: '1rem' }}>
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">{icp.name}</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <StatusPill complete={icp.is_complete} />
          {canWrite && !editing && (
            <button type="button" className="v2-btn" onClick={() => setEditing(true)}>
              <IconEdit width={13} height={13} /> Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <IcpEditForm icp={icp} onSave={save} onCancel={() => { setEditing(false); setError(null) }} saving={saving} error={error} />
      ) : (
        <>
          <p className="v2-placeholder-note">{icp.description || 'No description configured.'}</p>
          <div className="v2-kv-grid">
            <div>
              <div className="v2-kv-label">Revenue range</div>
              <div className="v2-kv-value">
                {icp.revenue_min_usd != null && icp.revenue_max_usd != null
                  ? `$${(icp.revenue_min_usd / 1_000_000).toFixed(1)}M – $${(icp.revenue_max_usd / 1_000_000).toFixed(1)}M`
                  : 'Not configured'}
              </div>
            </div>
            <div>
              <div className="v2-kv-label">Sales team constraint</div>
              <div className="v2-kv-value">{icp.sales_team_size_max != null ? `≤ ${icp.sales_team_size_max} reps` : 'No constraint'}</div>
            </div>
            <div>
              <div className="v2-kv-label">Trigger</div>
              <div className="v2-kv-value" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                {icp.trigger_hiring_roles?.length > 0
                  ? `${icp.trigger_mode === 'requires_absence' ? 'Not hiring' : 'Hiring'}: ${icp.trigger_hiring_roles.join(', ')}`
                  : 'Not configured'}
              </div>
            </div>
            <div>
              <div className="v2-kv-label">Matched accounts</div>
              <div className="v2-kv-value">{icp.matched_account_count}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function IcpsTab({ data, onSaved, canWrite }) {
  if (data.icps.length === 0) {
    return <div className="v2-card"><div className="v2-state">No ICPs are configured yet.</div></div>
  }
  return data.icps.map(icp => <IcpCard key={icp.id} icp={icp} allIcps={data.icps} onSaved={onSaved} canWrite={canWrite} />)
}

// ---------- Offerings ----------

function OfferingEditForm({ offering, allIcps, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(offering)
  const dirty = JSON.stringify(form) !== JSON.stringify(offering)

  return (
    <div>
      <FormMessage error={error} />
      <div className="v2-section-group-label">Identity</div>
      <TextField label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
      <ListField label="Description" value={form.description ? [form.description] : []} onChange={arr => setForm({ ...form, description: arr.join(' ') || null })} />

      <div className="v2-section-group-label">Targeting</div>
      <div className="v2-field">
        <label className="v2-field-label">Applicable ICPs</label>
        <ChipCheckboxGroup
          options={allIcps}
          selected={form.applicable_icps || []}
          getKey={i => i.id}
          getLabel={i => i.name}
          onToggle={id => setForm({
            ...form,
            applicable_icps: (form.applicable_icps || []).includes(id)
              ? form.applicable_icps.filter(x => x !== id)
              : [...(form.applicable_icps || []), id],
          })}
        />
      </div>
      <ListField label="Target functions" hint="Not confirmed by the lead yet -- leave as-is unless you know the real rule" value={form.target_functions} onChange={v => setForm({ ...form, target_functions: v })} />
      <ListField label="Target problem types" value={form.target_problem_types} onChange={v => setForm({ ...form, target_problem_types: v })} />
      <ListField label="Target company characteristics" value={form.target_company_characteristics} onChange={v => setForm({ ...form, target_company_characteristics: v })} />

      <div className="v2-section-group-label">Qualification</div>
      <ListField label="Qualification signals" value={form.qualification_signals} onChange={v => setForm({ ...form, qualification_signals: v })} />
      <div className="v2-field">
        <label className="v2-field-label">Exclusions (ICPs this offering explicitly does NOT apply to)</label>
        <ChipCheckboxGroup
          options={allIcps}
          selected={form.exclusions || []}
          getKey={i => i.id}
          getLabel={i => i.name}
          onToggle={id => setForm({
            ...form,
            exclusions: (form.exclusions || []).includes(id) ? form.exclusions.filter(x => x !== id) : [...(form.exclusions || []), id],
          })}
        />
      </div>

      <div className="v2-section-group-label">Delivery</div>
      <ListField label="Delivery constraints" value={form.delivery_constraints ? [form.delivery_constraints] : []} onChange={arr => setForm({ ...form, delivery_constraints: arr.join(' ') || null })} />

      <div className="v2-section-group-label">Positioning</div>
      <ListField label="Positioning / messaging" value={form.positioning_messaging ? [form.positioning_messaging] : []} onChange={arr => setForm({ ...form, positioning_messaging: arr.join(' ') || null })} />
      <ListField label="Typical objections" value={form.typical_objections} onChange={v => setForm({ ...form, typical_objections: v })} />

      <div className="v2-btn-row">
        <button type="button" className="v2-btn v2-btn-primary" disabled={!dirty || saving} onClick={() => onSave(form)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="v2-btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  )
}

function OfferingCard({ offering, allOfferings, allIcps, onSaved, canWrite }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async (form) => {
    setSaving(true)
    setError(null)
    try {
      const updated = allOfferings.map(o => (o.name === offering.name ? { ...form } : o))
      const data = await putOfferings(updated)
      onSaved(data)
      setEditing(false)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const applicableNames = (offering.applicable_icps || []).map(id => allIcps.find(i => i.id === id)?.name || id)

  return (
    <div className="v2-card" style={{ marginBottom: '1rem' }}>
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">{offering.name}</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <StatusPill complete={offering.is_complete} />
          {canWrite && !editing && (
            <button type="button" className="v2-btn" onClick={() => setEditing(true)}>
              <IconEdit width={13} height={13} /> Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <OfferingEditForm offering={offering} allIcps={allIcps} onSave={save} onCancel={() => { setEditing(false); setError(null) }} saving={saving} error={error} />
      ) : (
        <>
          <p className="v2-placeholder-note">{offering.description || 'No description configured.'}</p>
          <div className="v2-kv-grid">
            <div>
              <div className="v2-kv-label">Applicable ICPs</div>
              <div className="v2-kv-value" style={{ fontSize: '0.82rem' }}>{applicableNames.length > 0 ? applicableNames.join(', ') : 'Not configured'}</div>
            </div>
            <div>
              <div className="v2-kv-label">Target functions</div>
              <div className="v2-kv-value" style={{ fontSize: '0.82rem' }}>{offering.target_functions?.length > 0 ? offering.target_functions.join(', ') : 'Not configured'}</div>
            </div>
            <div>
              <div className="v2-kv-label">Qualification signals</div>
              <div className="v2-kv-value" style={{ fontSize: '0.82rem' }}>{offering.qualification_signals?.length > 0 ? offering.qualification_signals.join(', ') : 'Not configured'}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function OfferingsTab({ data, onSaved, canWrite }) {
  if (data.offerings.length === 0) {
    return <div className="v2-card"><div className="v2-state">No offerings are configured yet.</div></div>
  }
  return data.offerings.map(o => (
    <OfferingCard key={o.name} offering={o} allOfferings={data.offerings} allIcps={data.icps} onSaved={onSaved} canWrite={canWrite} />
  ))
}

// ---------- Matrix ----------

const CELL_META = {
  applicable: { badge: 'v2-badge-success', label: 'Applicable' },
  excluded: { badge: 'v2-badge-danger', label: 'Excluded' },
  unconfigured: { badge: 'v2-badge-neutral', label: 'Unconfigured' },
}

function MatrixTab({ data, onSaved, canWrite }) {
  const [saving, setSaving] = useState(null) // `${icpId}::${offering}` while in flight
  const [error, setError] = useState(null)
  const grid = data.demand_grid

  if (grid.icps.length === 0 || grid.offerings.length === 0) {
    return <div className="v2-card"><div className="v2-state">No ICPs or offerings are configured yet.</div></div>
  }

  const toggleCell = async (icpId, offeringName, status) => {
    if (status === 'excluded') return // exclusions are edited from the Offerings tab, not toggled here
    setSaving(`${icpId}::${offeringName}`)
    setError(null)
    try {
      const updated = data.offerings.map(o => {
        if (o.name !== offeringName) return o
        const applicable = o.applicable_icps || []
        return {
          ...o,
          applicable_icps: applicable.includes(icpId) ? applicable.filter(id => id !== icpId) : [...applicable, icpId],
        }
      })
      const result = await putOfferings(updated)
      onSaved(result)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      <FormMessage error={error} />
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
                {row.cells.map(cell => {
                  const meta = CELL_META[cell.status] || CELL_META.unconfigured
                  const busy = saving === `${row.icp_id}::${cell.offering}`
                  return (
                    <td key={cell.offering}>
                      <button
                        type="button"
                        className={`v2-grid-cell${canWrite && cell.status !== 'excluded' ? ' clickable' : ''}`}
                        disabled={!canWrite || cell.status === 'excluded' || busy}
                        onClick={() => toggleCell(row.icp_id, cell.offering, cell.status)}
                        title={canWrite && cell.status !== 'excluded' ? 'Click to toggle applicability' : undefined}
                      >
                        <span className={`v2-badge ${meta.badge}`}>{busy ? 'Saving…' : meta.label}</span>
                        {cell.status === 'applicable' && (
                          <span className="v2-grid-cell-count">{cell.matched_account_count} matched account{cell.matched_account_count === 1 ? '' : 's'}</span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="v2-placeholder-note" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
        {canWrite ? 'Click an unconfigured or applicable cell to toggle it. Excluded cells are edited from the Offerings tab. ' : ''}
        "Applicable" is a configuration fact, not a claim that demand exists -- see the real matched-account
        count on each applicable cell, and the full grid at <Link to="/v2/demand-grid">Demand Grid</Link>.
      </p>
    </div>
  )
}

// ---------- GTM Motion ----------

function MotionEditForm({ motion, allIcps, allOfferings, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(motion)
  const dirty = JSON.stringify(form) !== JSON.stringify(motion)

  return (
    <div>
      <FormMessage error={error} />
      <div className="v2-field">
        <label className="v2-chip-option checked" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} style={{ display: 'none' }} />
          {form.enabled && <IconCheck width={11} height={11} />}
          Enabled
        </label>
      </div>
      <div className="v2-field">
        <label className="v2-field-label">Applicable ICPs</label>
        <ChipCheckboxGroup
          options={allIcps}
          selected={form.applicable_icps || []}
          getKey={i => i.id}
          getLabel={i => i.name}
          onToggle={id => setForm({ ...form, applicable_icps: (form.applicable_icps || []).includes(id) ? form.applicable_icps.filter(x => x !== id) : [...(form.applicable_icps || []), id] })}
        />
      </div>
      <div className="v2-field">
        <label className="v2-field-label">Applicable offerings</label>
        <ChipCheckboxGroup
          options={allOfferings.map(o => o.name)}
          selected={form.applicable_offerings || []}
          onToggle={name => setForm({ ...form, applicable_offerings: (form.applicable_offerings || []).includes(name) ? form.applicable_offerings.filter(x => x !== name) : [...(form.applicable_offerings || []), name] })}
        />
      </div>
      <TextField label="Priority" type="number" value={form.priority} onChange={v => setForm({ ...form, priority: v })} placeholder="Not set" />
      <ListField label="Rationale" value={form.rationale ? [form.rationale] : []} onChange={arr => setForm({ ...form, rationale: arr.join(' ') || null })} />
      <div className="v2-btn-row">
        <button type="button" className="v2-btn v2-btn-primary" disabled={!dirty || saving} onClick={() => onSave(form)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="v2-btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  )
}

function MotionCard({ motion, allMotions, allIcps, allOfferings, onSaved, canWrite }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async (form) => {
    setSaving(true)
    setError(null)
    try {
      const updated = allMotions.map(m => (m.motion === motion.motion ? { ...form } : m))
      const data = await putGtmMotions(updated)
      onSaved(data)
      setEditing(false)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const isConfigured = (motion.applicable_icps?.length > 0) || (motion.applicable_offerings?.length > 0)

  return (
    <div className="v2-card" style={{ marginBottom: '1rem' }}>
      <div className="v2-config-card-head">
        <span className="v2-config-card-title" style={{ textTransform: 'capitalize' }}>{motion.motion}</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {!motion.enabled && <span className="v2-badge v2-badge-neutral">Disabled</span>}
          <StatusPill complete={isConfigured} />
          {canWrite && !editing && (
            <button type="button" className="v2-btn" onClick={() => setEditing(true)}>
              <IconEdit width={13} height={13} /> Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <MotionEditForm motion={motion} allIcps={allIcps} allOfferings={allOfferings} onSave={save} onCancel={() => { setEditing(false); setError(null) }} saving={saving} error={error} />
      ) : !isConfigured ? (
        <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>Motion not configured -- no ICP or offering rule set yet.</p>
      ) : (
        <div className="v2-kv-grid">
          <div>
            <div className="v2-kv-label">Applicable ICPs</div>
            <div className="v2-kv-value" style={{ fontSize: '0.82rem' }}>{motion.applicable_icps?.length > 0 ? motion.applicable_icps.map(id => allIcps.find(i => i.id === id)?.name || id).join(', ') : 'Not configured'}</div>
          </div>
          <div>
            <div className="v2-kv-label">Applicable offerings</div>
            <div className="v2-kv-value" style={{ fontSize: '0.82rem' }}>{motion.applicable_offerings?.length > 0 ? motion.applicable_offerings.join(', ') : 'Not configured'}</div>
          </div>
          <div>
            <div className="v2-kv-label">Priority</div>
            <div className="v2-kv-value">{motion.priority ?? 'Not set'}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function GtmMotionTab({ data, onSaved, canWrite }) {
  if (data.gtm_motions.length === 0) {
    return <div className="v2-card"><div className="v2-state">No GTM motions are configured yet.</div></div>
  }
  return data.gtm_motions.map(m => (
    <MotionCard key={m.motion} motion={m} allMotions={data.gtm_motions} allIcps={data.icps} allOfferings={data.offerings} onSaved={onSaved} canWrite={canWrite} />
  ))
}

// ---------- Page ----------

// "Who are our ICPs, what do we offer them, and how are those relationships configured" (Part 3)
// -- a business CONFIGURATION page, not analytics. Every write reuses set_icp_config()/
// set_offering_config()/set_gtm_motion_config() verbatim through their own API routes; nothing
// here re-implements validation or invents a business rule the lead hasn't confirmed yet (every
// list still defaults to whatever the backend's own DEFAULT_*_CONFIG seeds, unconfigured fields
// stay honestly "Not configured").
export default function IcpOfferings() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(TAB_SLUGS[searchParams.get('tab')] || CONFIG_TABS[0])

  useEffect(() => {
    getIcpsOfferings().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  // Writes go through the same session-cookie auth every other authenticated call in this app
  // uses (see api.py's PUT route docstrings) -- there is no finer-grained role system in this
  // codebase to gate on, so editing is available to any signed-in user, same as Settings today.
  const canWrite = true

  return (
    <div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load configuration: {error}</div>
          </div>
        </div>
      ) : data === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 240 }} />
      ) : (
        <>
          <div className="v2-config-tabs">
            {CONFIG_TABS.map(t => (
              <button key={t} type="button" className={`v2-config-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'ICPs' && <IcpsTab data={data} onSaved={setData} canWrite={canWrite} />}
          {tab === 'Offerings' && <OfferingsTab data={data} onSaved={setData} canWrite={canWrite} />}
          {tab === 'Matrix' && <MatrixTab data={data} onSaved={setData} canWrite={canWrite} />}
          {tab === 'GTM Motion' && <GtmMotionTab data={data} onSaved={setData} canWrite={canWrite} />}
        </>
      )}
    </div>
  )
}
