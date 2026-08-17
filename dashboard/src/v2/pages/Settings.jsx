import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getBusinessContext, putBusinessContext, getEfficiencyBenchmarks, putEfficiencyBenchmarks, formatApiError } from '../api.js'
import { IconAlertTriangle, IconEdit, IconCheck } from '../icons.jsx'

const TABS = ['Strategy', 'Playbook', 'Connections', 'Performance', 'Efficiency']

// Slug <-> tab-label mapping so other pages (Efficiency) can deep-link to a specific tab, e.g.
// /v2/settings?tab=efficiency -- same pattern IcpOfferings.jsx already uses.
const TAB_SLUGS = { strategy: 'Strategy', playbook: 'Playbook', connections: 'Connections', performance: 'Performance', efficiency: 'Efficiency' }

// ---------- shared field primitives (same visual language as Phase 5's IcpOfferings.jsx) ----------

function TextField({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="v2-field">
      <label className="v2-field-label">{label}</label>
      <input
        className="v2-input"
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

// Array-of-strings fields, one line per item -- identical convention to Phase 5's ListField,
// so a value that legitimately contains a comma is never silently mangled.
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

function FormMessage({ error, success }) {
  if (error) return <div className="v2-form-message error">{error}</div>
  if (success) return <div className="v2-form-message success">{success}</div>
  return null
}

function ReadRow({ label, value }) {
  return (
    <div>
      <div className="v2-kv-label">{label}</div>
      <div className="v2-kv-value">{value || 'Not configured'}</div>
    </div>
  )
}

function ReadList({ label, value }) {
  return (
    <div>
      <div className="v2-kv-label">{label}</div>
      <div className="v2-kv-value" style={{ fontSize: '0.82rem' }}>
        {value && value.length > 0 ? value.join(', ') : 'Not configured'}
      </div>
    </div>
  )
}

function NotAvailableCard({ title, children }) {
  return (
    <div className="v2-card" style={{ marginBottom: '1rem' }}>
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">{title}</span>
        <span className="v2-badge v2-badge-neutral">Not available yet</span>
      </div>
      <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{children}</p>
    </div>
  )
}

// ---------- Goals card (Strategy tab) ----------

function GoalsCard({ context, onSaved, canWrite }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const goals = context.goals || {}
  const TEXT_FIELDS = [
    ['partnership_goals', 'Partnership goals'],
    ['meetings_goals', 'Meetings goals'],
    ['long_term_goal', 'Long-term goal'],
    ['short_term_goal', 'Short-term goal'],
  ]

  const startEdit = () => {
    setForm({ ...goals })
    setError(null)
    setEditing(true)
  }

  const dirty = form && JSON.stringify(form) !== JSON.stringify(goals)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      // Full context object, only `goals` overridden -- set_business_context() has no
      // field-level validation of its own (Part 11), so the frontend never sends a partial
      // payload that could silently drop the fields it isn't touching right now.
      const payload = { ...context, goals: form }
      await putBusinessContext(payload)
      onSaved(payload)
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
        <span className="v2-config-card-title">Goals</span>
        {canWrite && !editing && (
          <button type="button" className="v2-btn" onClick={startEdit}><IconEdit width={13} height={13} /> Edit</button>
        )}
      </div>
      {editing ? (
        <>
          <FormMessage error={error} />
          <TextField
            label="Revenue goal (USD, monthly)"
            type="number"
            value={form.revenue_goal}
            onChange={v => setForm({ ...form, revenue_goal: v === '' ? null : Number(v) })}
            placeholder="Not configured"
          />
          <div className="v2-field-hint" style={{ marginTop: -8, marginBottom: 14 }}>
            This is the target Revenue Pace measures against -- see that page.
          </div>
          {TEXT_FIELDS.map(([key, label]) => (
            <TextField key={key} label={label} value={form[key]} onChange={v => setForm({ ...form, [key]: v || null })} placeholder="Not configured" />
          ))}
          <div className="v2-btn-row">
            <button type="button" className="v2-btn v2-btn-primary" disabled={!dirty || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="v2-btn" onClick={() => { setEditing(false); setError(null) }} disabled={saving}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="v2-kv-grid">
          <ReadRow label="Revenue goal" value={typeof goals.revenue_goal === 'number' ? `$${goals.revenue_goal.toLocaleString()}` : goals.revenue_goal} />
          {TEXT_FIELDS.map(([key, label]) => <ReadRow key={key} label={label} value={goals[key]} />)}
        </div>
      )}
    </div>
  )
}

// ---------- TAM card (Strategy tab) ----------

function TamCard({ context, onSaved, canWrite }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const tam = context.tam || {}
  const baseline = { segments: tam.segments || [], unit: tam.unit || '', segment_values_unconfirmed: tam.segment_values_unconfirmed || {} }

  const startEdit = () => {
    setForm({ segments: [...baseline.segments], unit: baseline.unit, segment_values_unconfirmed: { ...baseline.segment_values_unconfirmed } })
    setError(null)
    setEditing(true)
  }

  const dirty = form && JSON.stringify(form) !== JSON.stringify(baseline)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = { ...context, tam: { ...tam, segments: form.segments, unit: form.unit || null, segment_values_unconfirmed: form.segment_values_unconfirmed } }
      await putBusinessContext(payload)
      onSaved(payload)
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
        <span className="v2-config-card-title">TAM</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span className="v2-badge v2-badge-warning">{tam.unit || 'Unconfirmed'}</span>
          {canWrite && !editing && (
            <button type="button" className="v2-btn" onClick={startEdit}><IconEdit width={13} height={13} /> Edit</button>
          )}
        </div>
      </div>
      <p className="v2-placeholder-note" style={{ marginTop: 0 }}>
        "segment_values_unconfirmed" is the backend's own field name -- these figures have not
        been confirmed against a real source (see app/gtm_os/context/business_context.py).
      </p>
      {editing ? (
        <>
          <FormMessage error={error} />
          <ListField label="Segments" value={form.segments} onChange={v => setForm({ ...form, segments: v })} />
          <TextField label="Unit" value={form.unit} onChange={v => setForm({ ...form, unit: v })} placeholder="Not configured" />
          {form.segments.map(seg => (
            <TextField
              key={seg}
              label={`${seg} value (unconfirmed)`}
              type="number"
              value={form.segment_values_unconfirmed[seg] ?? ''}
              onChange={v => setForm({ ...form, segment_values_unconfirmed: { ...form.segment_values_unconfirmed, [seg]: v === '' ? null : Number(v) } })}
              placeholder="Not configured"
            />
          ))}
          <div className="v2-btn-row">
            <button type="button" className="v2-btn v2-btn-primary" disabled={!dirty || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="v2-btn" onClick={() => { setEditing(false); setError(null) }} disabled={saving}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="v2-kv-grid">
          <ReadList label="Segments" value={tam.segments} />
          {(tam.segments || []).map(seg => (
            <ReadRow key={seg} label={seg} value={tam.segment_values_unconfirmed?.[seg] != null ? String(tam.segment_values_unconfirmed[seg]) : null} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- generic single-list-field card (strategic_flow, business_model_history,
// sales_methodology, messaging_objections, integrations_mentioned all use this shape) ----------

function ListCard({ title, fieldKey, hint, context, onSaved, canWrite, badge }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const value = context[fieldKey] || []

  const startEdit = () => {
    setForm([...value])
    setError(null)
    setEditing(true)
  }

  const dirty = form && JSON.stringify(form) !== JSON.stringify(value)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = { ...context, [fieldKey]: form }
      await putBusinessContext(payload)
      onSaved(payload)
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
        <span className="v2-config-card-title">{title}</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {badge}
          {canWrite && !editing && (
            <button type="button" className="v2-btn" onClick={startEdit}><IconEdit width={13} height={13} /> Edit</button>
          )}
        </div>
      </div>
      {editing ? (
        <>
          <FormMessage error={error} />
          <ListField label={title} hint={hint} value={form} onChange={setForm} />
          <div className="v2-btn-row">
            <button type="button" className="v2-btn v2-btn-primary" disabled={!dirty || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="v2-btn" onClick={() => { setEditing(false); setError(null) }} disabled={saving}>Cancel</button>
          </div>
        </>
      ) : value.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--v2-text)', fontSize: '0.88rem', lineHeight: 1.7 }}>
          {value.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      ) : (
        <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>Not configured.</p>
      )}
    </div>
  )
}

// ---------- Strategy tab ----------

function StrategyTab({ context, onSaved, canWrite }) {
  return (
    <div>
      <GoalsCard context={context} onSaved={onSaved} canWrite={canWrite} />
      <TamCard context={context} onSaved={onSaved} canWrite={canWrite} />
      <ListCard title="Strategic flow" fieldKey="strategic_flow" context={context} onSaved={onSaved} canWrite={canWrite} />
      <ListCard title="Business model history" fieldKey="business_model_history" context={context} onSaved={onSaved} canWrite={canWrite} />
      <div className="v2-card">
        <div className="v2-config-card-head">
          <span className="v2-config-card-title">Offerings &amp; ICP bands</span>
        </div>
        <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>
          Business Context also stores its own "offerings" and "icp_bands" lists, but those are an
          older, unstructured duplicate of the real ICP and Offering configuration -- editing them
          here would create two disagreeing sources of truth. The canonical, editable surface is{' '}
          <Link to="/v2/icps-offerings">ICPs &amp; Offerings</Link>.
        </p>
      </div>
    </div>
  )
}

// ---------- Playbook tab ----------

function PlaybookTab({ context, onSaved, canWrite }) {
  return (
    <div>
      <ListCard title="Sales methodology" fieldKey="sales_methodology" context={context} onSaved={onSaved} canWrite={canWrite} />
      <ListCard title="Messaging objections" fieldKey="messaging_objections" context={context} onSaved={onSaved} canWrite={canWrite} />
      <NotAvailableCard title="Qualification framework, message framework, discovery questions">
        The backend stores "sales_methodology" as a flat list (shown above as exactly that -- e.g.
        MEDDIC, AIDA) and nothing more structured. There is no field-by-field MEDDIC/AIDA scoring
        engine, no message-framework rule engine, and no discovery-question database anywhere in
        the backend, so those reference concepts are not shown here rather than invented. Per-offering
        positioning and typical objections DO already exist, but as part of offering configuration --
        see <Link to="/v2/icps-offerings">ICPs &amp; Offerings</Link> for that, edited there only, not
        duplicated on this page.
      </NotAvailableCard>
    </div>
  )
}

// ---------- Connections tab ----------

function ConnectionsTab({ context, onSaved, canWrite }) {
  return (
    <div>
      <ListCard
        title="Integrations mentioned"
        fieldKey="integrations_mentioned"
        hint="Names mentioned in business notes -- not a connection/credential status."
        context={context}
        onSaved={onSaved}
        canWrite={canWrite}
      />
      <NotAvailableCard title="Connection management">
        No V2 connection settings (OAuth flows, credential/health status) are configured yet. The
        list above is business-context reference text only, not a live integration.
      </NotAvailableCard>
    </div>
  )
}

// ---------- Performance tab ----------

function PerformanceTab() {
  return (
    <NotAvailableCard title="Performance">
      Not available yet. The system has real governance and learning data elsewhere (see{' '}
      <Link to="/v2/briefing">Briefing</Link>), but there is no backend concept of run history,
      overrides, or evals to summarize here -- nothing is fabricated to fill this tab.
    </NotAvailableCard>
  )
}

// ---------- Efficiency tab (own data source -- gtm_os_efficiency_benchmarks Parameter, not
// business_context) ----------

function EfficiencyTab() {
  const [benchmarks, setBenchmarks] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    getEfficiencyBenchmarks().then(setBenchmarks).catch(err => setError(formatApiError(err)))
  }, [])

  const startEdit = () => {
    setForm(benchmarks.map(b => ({ ...b })))
    setSaveError(null)
    setEditing(true)
  }

  const dirty = form && JSON.stringify(form) !== JSON.stringify(benchmarks)

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await putEfficiencyBenchmarks(form)
      setBenchmarks(updated)
      setEditing(false)
    } catch (err) {
      setSaveError(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const updateRow = (activityType, patch) => {
    setForm(prev => prev.map(b => (b.activity_type === activityType ? { ...b, ...patch } : b)))
  }

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load efficiency benchmarks: {error}</div>
        </div>
      </div>
    )
  }
  if (benchmarks === null) {
    return <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 200 }} />
  }

  const rows = editing ? form : benchmarks

  return (
    <div className="v2-card">
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">Time benchmarks</span>
        {!editing && (
          <button type="button" className="v2-btn" onClick={startEdit}><IconEdit width={13} height={13} /> Edit</button>
        )}
      </div>
      <p className="v2-placeholder-note" style={{ marginTop: 0 }}>
        How many minutes a human would take to do one unit of each activity by hand -- used to
        convert real recorded automation volume into hours saved on the{' '}
        <Link to="/v2/efficiency">Efficiency</Link> page. Only Contact enrichment, Message
        drafting, and CRM dedup check have a real number from the reference material; everything
        else is intentionally left unconfigured until a real estimate is supplied.
      </p>
      {editing && <FormMessage error={saveError} />}
      <div style={{ overflowX: 'auto' }}>
        <table className="v2-demand-grid">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Manual minutes</th>
              <th>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.activity_type}>
                <th scope="row">{b.label}</th>
                <td>
                  {editing ? (
                    <input
                      className="v2-input"
                      type="number"
                      min="0"
                      style={{ maxWidth: 100 }}
                      value={b.manual_minutes ?? ''}
                      placeholder="Not configured"
                      onChange={e => updateRow(b.activity_type, { manual_minutes: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  ) : b.manual_minutes != null ? (
                    `${b.manual_minutes} min`
                  ) : (
                    <span className="v2-badge v2-badge-neutral">Missing</span>
                  )}
                </td>
                <td>
                  {editing ? (
                    <label className={`v2-chip-option${b.enabled ? ' checked' : ''}`} style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={b.enabled} onChange={e => updateRow(b.activity_type, { enabled: e.target.checked })} style={{ display: 'none' }} />
                      {b.enabled && <IconCheck width={11} height={11} />}
                      {b.enabled ? 'Enabled' : 'Disabled'}
                    </label>
                  ) : (
                    <span className={`v2-badge ${b.enabled ? 'v2-badge-success' : 'v2-badge-neutral'}`}>{b.enabled ? 'Enabled' : 'Disabled'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="v2-btn-row" style={{ marginTop: '0.9rem' }}>
          <button type="button" className="v2-btn v2-btn-primary" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="v2-btn" onClick={() => { setEditing(false); setSaveError(null) }} disabled={saving}>Cancel</button>
        </div>
      )}
    </div>
  )
}

// ---------- Page ----------

// "The company's own operating context, as the backend already understands it" (Phase 9) -- every
// read/write goes through the pre-existing get_business_context()/set_business_context() and the
// pre-existing GET/PUT /gtm-os/business-context (the one gtm_os route that predates Phase 2), never
// a new table, a new Parameter, or a duplicate of ICP/Offering configuration. Reference concepts
// with no backing data (qualification scoring, message-framework rules, discovery questions,
// connection management, performance metrics) show an honest "Not available yet" state instead.
export default function Settings() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(TAB_SLUGS[searchParams.get('tab')] || TABS[0])

  useEffect(() => {
    getBusinessContext().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  // Same session-cookie auth as every other authenticated write in this app -- there is no
  // finer-grained role system in this codebase to gate on (see api.py's PUT route docstrings).
  const canWrite = true

  return (
    <div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load business context: {error}</div>
          </div>
        </div>
      ) : data === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 240 }} />
      ) : (
        <>
          <div className="v2-config-tabs">
            {TABS.map(t => (
              <button key={t} type="button" className={`v2-config-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'Strategy' && <StrategyTab context={data} onSaved={setData} canWrite={canWrite} />}
          {tab === 'Playbook' && <PlaybookTab context={data} onSaved={setData} canWrite={canWrite} />}
          {tab === 'Connections' && <ConnectionsTab context={data} onSaved={setData} canWrite={canWrite} />}
          {tab === 'Performance' && <PerformanceTab />}
          {tab === 'Efficiency' && <EfficiencyTab />}
        </>
      )}
    </div>
  )
}
