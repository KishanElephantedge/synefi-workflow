import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  getBusinessContext, putBusinessContext, getEfficiencyBenchmarks, putEfficiencyBenchmarks,
  getLearningReadout, getCredentials, formatApiError,
} from '../api.js'
import { IconAlertTriangle, IconEdit, IconCheck } from '../icons.jsx'

const TABS = ['Strategy', 'Playbook', 'Connections', 'Performance', 'Efficiency']

// Slug <-> tab-label mapping so other pages (Efficiency) can deep-link to a specific tab, e.g.
// /v2/settings?tab=efficiency -- same pattern IcpOfferings.jsx already uses.
const TAB_SLUGS = { strategy: 'Strategy', playbook: 'Playbook', connections: 'Connections', performance: 'Performance', efficiency: 'Efficiency' }

// ---------- shared field primitives ----------

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

// Array-of-strings fields, one line per item -- a value that legitimately contains a comma is
// never silently mangled.
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
      <div className="v2-kv-value v2-set-kv-small">
        {value && value.length > 0 ? value.join(', ') : 'Not configured'}
      </div>
    </div>
  )
}

function NotAvailableCard({ title, children }) {
  return (
    <div className="v2-card v2-set-card">
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">{title}</span>
        <span className="v2-status-pill tone-neutral">Not available yet</span>
      </div>
      <p className="v2-placeholder-note v2-set-note">{children}</p>
    </div>
  )
}

// Marks a field as a real, live input into another real system, vs. reference-only text with no
// downstream effect -- both are honest states, this just makes the difference visible instead of
// every field looking equally "important." Never invented: only used where a real backend
// consumer was directly code-traced (see the Settings audit this was built from).
function ConsumedByNote({ children }) {
  return <div className="v2-set-consumed"><span className="v2-status-pill tone-info-soft">Live input</span> {children}</div>
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
      // field-level validation of its own, so the frontend never sends a partial payload that
      // could silently drop the fields it isn't touching right now.
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
    <div className="v2-card v2-set-card">
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">Goals</span>
        {canWrite && !editing && (
          <button type="button" className="v2-btn" onClick={startEdit}><IconEdit width={13} height={13} /> Edit</button>
        )}
      </div>
      <ConsumedByNote>Revenue goal is the real target <Link to="/v2/revenue-pace">Revenue Pace</Link> measures against.</ConsumedByNote>
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
    <div className="v2-card v2-set-card">
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">TAM</span>
        <div className="v2-set-head-actions">
          <span className="v2-status-pill tone-warning-soft">{tam.unit || 'Unconfirmed'}</span>
          {canWrite && !editing && (
            <button type="button" className="v2-btn" onClick={startEdit}><IconEdit width={13} height={13} /> Edit</button>
          )}
        </div>
      </div>
      <p className="v2-placeholder-note v2-set-note">
        Reference only -- no backend consumer reads this. "segment_values_unconfirmed" is the
        backend's own field name: these figures have not been confirmed against a real source.
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

function ListCard({ title, fieldKey, hint, context, onSaved, canWrite, consumedNote }) {
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
    <div className="v2-card v2-set-card">
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">{title}</span>
        {canWrite && !editing && (
          <button type="button" className="v2-btn" onClick={startEdit}><IconEdit width={13} height={13} /> Edit</button>
        )}
      </div>
      {consumedNote && <ConsumedByNote>{consumedNote}</ConsumedByNote>}
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
        <ul className="v2-set-list">
          {value.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      ) : (
        <p className="v2-placeholder-note v2-set-note">Not configured.</p>
      )}
    </div>
  )
}

// ---------- Strategy tab ----------

function StrategyTab({ context, onSaved, canWrite }) {
  const gtmMotions = context.gtm_motions || []
  return (
    <div>
      <GoalsCard context={context} onSaved={onSaved} canWrite={canWrite} />
      <TamCard context={context} onSaved={onSaved} canWrite={canWrite} />
      <ListCard title="Strategic flow" fieldKey="strategic_flow" context={context} onSaved={onSaved} canWrite={canWrite} />
      <ListCard title="Business model history" fieldKey="business_model_history" context={context} onSaved={onSaved} canWrite={canWrite} />
      <div className="v2-card v2-set-card">
        <div className="v2-config-card-head">
          <span className="v2-config-card-title">GTM motions</span>
        </div>
        <ConsumedByNote>Passed as reference context into real message drafting, alongside sales methodology and messaging objections.</ConsumedByNote>
        <p className="v2-placeholder-note v2-set-note">
          This flat list predates the structured, per-ICP/offering motion configuration -- edit the
          canonical version at <Link to="/v2/icps-offerings?tab=motion">ICPs &amp; Offerings → GTM Motion</Link>.
          Not editable here to avoid two disagreeing sources of truth.
        </p>
        {gtmMotions.length > 0 ? (
          <ul className="v2-set-list">{gtmMotions.map((m, i) => <li key={i}>{m}</li>)}</ul>
        ) : (
          <p className="v2-placeholder-note v2-set-note">Not configured.</p>
        )}
      </div>
      <div className="v2-card v2-set-card">
        <div className="v2-config-card-head">
          <span className="v2-config-card-title">Offerings &amp; ICP bands</span>
        </div>
        <p className="v2-placeholder-note v2-set-note">
          Business Context also stores its own "offerings" and "icp_bands" lists. "offerings" is an
          older, unused duplicate -- the canonical, editable surface is{' '}
          <Link to="/v2/icps-offerings">ICPs &amp; Offerings</Link>. "icp_bands" is not a pure
          duplicate: its <code>profile</code> text is a real input to{' '}
          <Link to="/v2/market-intelligence">Market Intelligence</Link>'s default topic detection --
          not editable here yet, to avoid a second disagreeing source of truth for ICP config.
        </p>
      </div>
    </div>
  )
}

// ---------- Playbook tab ----------

function PlaybookTab({ context, onSaved, canWrite }) {
  return (
    <div>
      <ListCard
        title="Sales methodology"
        fieldKey="sales_methodology"
        context={context}
        onSaved={onSaved}
        canWrite={canWrite}
        consumedNote="Passed as reference context into real message drafting."
      />
      <ListCard
        title="Messaging objections"
        fieldKey="messaging_objections"
        context={context}
        onSaved={onSaved}
        canWrite={canWrite}
        consumedNote="Passed as reference context into real message drafting."
      />
      <NotAvailableCard title="Qualification framework, message framework, discovery questions">
        No field-by-field MEDDIC/AIDA scoring engine, message-framework rule engine, or
        discovery-question store exists in the backend, so those reference concepts aren't shown
        here rather than invented. Per-offering positioning and typical objections DO already
        exist, as part of offering configuration -- see{' '}
        <Link to="/v2/icps-offerings">ICPs &amp; Offerings</Link>, edited there only.
      </NotAvailableCard>
    </div>
  )
}

// ---------- Connections tab (real credential status, GET /credentials -- same route V1's
// Settings page already uses; V2 simply hadn't been wired to it) ----------

// Curated to real GTM-relevant integrations only -- deliberately excludes infra-only credentials
// this backend also stores under the same table (smtp_*, notify_email, llm api keys) since those
// aren't "connections" in the product sense this tab represents.
const CONNECTION_GROUPS = [
  { label: 'LinkedIn / Apify', names: ['apify_api_key'], note: 'Powers LinkedIn monitoring and enrichment.' },
  { label: 'HubSpot', names: ['hubspot_api_key'], note: 'CRM sync.' },
  { label: 'SmartLead', names: ['smartlead_api_key'], note: 'Outbound email sending.' },
  { label: 'HeyReach', names: ['heyreach_api_key'], note: 'LinkedIn outreach.' },
  { label: 'SalesRobot', names: ['salesrobot_api_key'], note: 'LinkedIn outreach.' },
  { label: 'Slack', names: ['slack_webhook_url', 'slack_webhook_url_2'], note: 'Notifications.' },
  { label: 'Google Calendar', names: ['google_calendar_client_id', 'google_calendar_client_secret', 'google_calendar_refresh_token', 'google_calendar_id'], note: 'Meeting sync -- see Meetings.' },
]

function formatDateTime(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function ConnectionsTab({ context, onSaved, canWrite }) {
  const [creds, setCreds] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCredentials().then(setCreds).catch(err => setError(formatApiError(err)))
  }, [])

  const byName = {}
  ;(creds || []).forEach(c => { byName[c.name] = c })

  return (
    <div>
      <div className="v2-card v2-set-card">
        <div className="v2-config-card-head">
          <span className="v2-config-card-title">Connections</span>
        </div>
        <p className="v2-placeholder-note v2-set-note">
          Real credential presence for this tenant, read-only. Values themselves are never shown
          or editable here.
        </p>
        {error ? (
          <div className="v2-state v2-state-error"><IconAlertTriangle width={16} height={16} /> {error}</div>
        ) : creds === null ? (
          <div className="v2-skeleton-row" style={{ height: 120 }} />
        ) : (
          <div className="v2-set-conn-list">
            {CONNECTION_GROUPS.map(group => {
              const rows = group.names.map(n => byName[n]).filter(Boolean)
              const connected = group.names.every(n => byName[n]?.is_set)
              const lastUpdated = rows.map(r => r.updated_at).filter(Boolean).sort().slice(-1)[0]
              return (
                <div key={group.label} className="v2-set-conn-row">
                  <div>
                    <div className="v2-set-conn-name">{group.label}</div>
                    <div className="v2-set-conn-hint">{group.note}</div>
                  </div>
                  <div className="v2-set-conn-status">
                    <span className={`v2-status-pill ${connected ? 'tone-success-solid' : 'tone-neutral'}`}>
                      {connected ? 'Connected' : 'Not connected'}
                    </span>
                    {connected && lastUpdated && <span className="v2-set-conn-updated">Updated {formatDateTime(lastUpdated)}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <ListCard
        title="Integrations mentioned"
        fieldKey="integrations_mentioned"
        hint="Names mentioned in business notes -- not a connection/credential status."
        context={context}
        onSaved={onSaved}
        canWrite={canWrite}
      />
    </div>
  )
}

// ---------- Performance tab (real message-funnel/reply-outcome/strategy-type readout,
// GET /gtm-os/learning-readout -- the same real computation Briefing's governance snapshot
// already uses internally, just not previously exposed anywhere) ----------

function PerformanceTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getLearningReadout().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  if (error) {
    return <div className="v2-card"><div className="v2-state v2-state-error"><IconAlertTriangle width={16} height={16} /> {error}</div></div>
  }
  if (data === null) {
    return <div className="v2-skeleton-row" style={{ height: 200 }} />
  }

  const outcomeEntries = Object.entries(data.outcomes_by_category)
  const strategyEntries = Object.entries(data.outcomes_by_strategy_type)

  return (
    <div>
      <div className="v2-card v2-set-card">
        <div className="v2-config-card-head">
          <span className="v2-config-card-title">Message pipeline</span>
        </div>
        <div className="v2-stat-row">
          <div className="v2-stat-tile">
            <div className="v2-stat-label">Prepared</div>
            <div className="v2-stat-value">{data.prepared_messages_count}</div>
          </div>
          <div className="v2-stat-tile">
            <div className="v2-stat-label">Ready for review</div>
            <div className="v2-stat-value">{data.ready_for_review_count}</div>
          </div>
          <div className="v2-stat-tile">
            <div className="v2-stat-label">Approved</div>
            <div className="v2-stat-value">{data.approved_messages_count}</div>
          </div>
          <div className="v2-stat-tile">
            <div className="v2-stat-label">Replies</div>
            <div className="v2-stat-value">{data.replies_count}</div>
          </div>
          <div className="v2-stat-tile">
            <div className="v2-stat-label">Traced to an opportunity</div>
            <div className="v2-stat-value">{data.outcomes_linked_to_opportunity_count}</div>
          </div>
        </div>
      </div>

      <div className="v2-card v2-set-card">
        <div className="v2-config-card-head">
          <span className="v2-config-card-title">Replies by outcome</span>
        </div>
        {outcomeEntries.length === 0 ? (
          <p className="v2-placeholder-note v2-set-note">No replies recorded yet.</p>
        ) : (
          <div className="v2-set-tag-row">
            {outcomeEntries.map(([category, count]) => (
              <span key={category} className="v2-status-pill tone-neutral">{category.replace(/_/g, ' ')}: {count}</span>
            ))}
          </div>
        )}
      </div>

      <div className="v2-card v2-set-card">
        <div className="v2-config-card-head">
          <span className="v2-config-card-title">Outcomes by strategy type</span>
        </div>
        {strategyEntries.length === 0 ? (
          <p className="v2-placeholder-note v2-set-note">No outcomes traced to a strategy yet.</p>
        ) : (
          <div className="v2-set-tag-row">
            {strategyEntries.map(([type, count]) => (
              <span key={type} className="v2-status-pill tone-neutral">{type.replace(/_/g, ' ')}: {count}</span>
            ))}
          </div>
        )}
      </div>

      <NotAvailableCard title="Accuracy / hit rate">
        No ground-truth "correct recommendation" concept exists anywhere in this backend, so no
        accuracy or success percentage is computed or shown -- see{' '}
        <Link to="/v2/overrides-evals">Overrides &amp; Evals</Link> for the same honesty rule
        applied to message overrides and lost meetings. Real operational detail also lives at{' '}
        <Link to="/v2/efficiency">Efficiency</Link> and <Link to="/v2/briefing">Briefing</Link>.
      </NotAvailableCard>
    </div>
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
    <div className="v2-card v2-set-card">
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">Time benchmarks</span>
        {!editing && (
          <button type="button" className="v2-btn" onClick={startEdit}><IconEdit width={13} height={13} /> Edit</button>
        )}
      </div>
      <ConsumedByNote>Converts real recorded automation volume into hours saved on the <Link to="/v2/efficiency">Efficiency</Link> page.</ConsumedByNote>
      <p className="v2-placeholder-note v2-set-note">
        Only Contact enrichment, Message drafting, and CRM dedup check have a real number from the
        reference material; everything else is intentionally left unconfigured until a real
        estimate is supplied.
      </p>
      {editing && <FormMessage error={saveError} />}
      <div className="v2-set-ledger">
        <div className="v2-set-ledger-head">
          <span>Activity</span>
          <span>Manual minutes</span>
          <span>Enabled</span>
        </div>
        {rows.map(b => (
          <div key={b.activity_type} className="v2-set-ledger-row">
            <span className="v2-set-ledger-label">{b.label}</span>
            <span>
              {editing ? (
                <input
                  className="v2-input v2-set-ledger-input"
                  type="number"
                  min="0"
                  value={b.manual_minutes ?? ''}
                  placeholder="Not configured"
                  onChange={e => updateRow(b.activity_type, { manual_minutes: e.target.value === '' ? null : Number(e.target.value) })}
                />
              ) : b.manual_minutes != null ? (
                `${b.manual_minutes} min`
              ) : (
                <span className="v2-status-pill tone-neutral">Not configured</span>
              )}
            </span>
            <span>
              {editing ? (
                <label className={`v2-chip-option${b.enabled ? ' checked' : ''}`}>
                  <input type="checkbox" checked={b.enabled} onChange={e => updateRow(b.activity_type, { enabled: e.target.checked })} className="v2-set-hidden-checkbox" />
                  {b.enabled && <IconCheck width={11} height={11} />}
                  {b.enabled ? 'Enabled' : 'Disabled'}
                </label>
              ) : (
                <span className={`v2-status-pill ${b.enabled ? 'tone-success-solid' : 'tone-neutral'}`}>{b.enabled ? 'Enabled' : 'Disabled'}</span>
              )}
            </span>
          </div>
        ))}
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

// "The company's own operating context, as the backend already understands it" -- every
// read/write goes through the pre-existing get_business_context()/set_business_context() (the
// one gtm_os route that predates the rest of V2), never a new table or a duplicate of ICP/
// Offering configuration. Connections and Performance now surface real, already-computed backend
// data (GET /credentials, GET /gtm-os/learning-readout) that existed but wasn't reachable from
// V2 before. Reference concepts with no backing data (qualification scoring, message-framework
// rules, discovery questions, accuracy/hit-rate) still show an honest "Not available yet" state
// instead of being invented.
export default function Settings() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(TAB_SLUGS[searchParams.get('tab')] || TABS[0])

  useEffect(() => {
    getBusinessContext().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  // Same session-cookie auth as every other authenticated write in this app -- there is no
  // finer-grained role system in this codebase to gate on.
  const canWrite = true

  return (
    <div className="v2-set-page">
      <div className="v2-page-eyebrow">The company's own operating context -- goals, playbook, connections and real performance data.</div>

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
