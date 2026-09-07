import { useEffect, useState } from 'react'
import client from '../../api/client'
import { formatApiError } from '../api.js'
import { IconAlertTriangle, IconCheck } from '../icons.jsx'

// Admin surface for the partner-onboarding feature (2026-09-07): give a partner (Sandy Yu,
// and whoever Majji pitches next) their own login, restricted to their own tenant, seeing
// only the stage of the product that's actually built for them today ("accounts"). Every call
// here hits the GATEWAY directly (tenantScoped: false) -- these are gateway-owned concepts
// (User, Tenant, auth) that this product backend has no model for, same as /auth/me and
// /api/tenants already do in TenantContext.jsx.

const FEATURE_OPTIONS = [
  { key: 'accounts', label: 'Accounts', hint: 'The companies fetched for their ICP.' },
  // Add the next stage here when it's actually built -- never enable one ahead of the real
  // feature existing, per the explicit stage-by-stage instruction.
]

function useUsers() {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)

  const reload = () => {
    client.get('/api/admin/users', { tenantScoped: false })
      .then(res => setUsers(res.data))
      .catch(err => setError(formatApiError(err)))
  }

  useEffect(reload, [])
  return { users, error, reload }
}

function TenantPicker({ mode, setMode, newName, setNewName, query, setQuery, results, setResults, selected, setSelected }) {
  useEffect(() => {
    if (mode !== 'existing' || !query.trim()) { setResults([]); return }
    let cancelled = false
    const t = setTimeout(() => {
      client.get('/api/admin/tenants/search', { tenantScoped: false, params: { q: query } })
        .then(res => !cancelled && setResults(res.data))
        .catch(() => !cancelled && setResults([]))
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [mode, query])

  return (
    <div>
      <div className="v2-btn-row" style={{ marginBottom: '0.75rem' }}>
        <button type="button" className={`v2-btn${mode === 'new' ? ' v2-btn-primary' : ''}`} onClick={() => { setMode('new'); setSelected(null) }}>
          Create a new tenant
        </button>
        <button type="button" className={`v2-btn${mode === 'existing' ? ' v2-btn-primary' : ''}`} onClick={() => setMode('existing')}>
          Attach to an existing tenant
        </button>
      </div>

      {mode === 'new' ? (
        <div className="v2-field">
          <label className="v2-field-label">Tenant / workspace name</label>
          <input className="v2-input" type="text" placeholder="e.g. Sandy Yu" value={newName} onChange={e => setNewName(e.target.value)} />
        </div>
      ) : (
        <div className="v2-field">
          <label className="v2-field-label">Search by name</label>
          <input className="v2-input" type="text" placeholder="e.g. Sandy" value={query} onChange={e => setQuery(e.target.value)} />
          {results.length > 0 && (
            <div style={{ marginTop: '0.5rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius)' }}>
              {results.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelected(t)}
                  style={{
                    padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: 13.5,
                    background: selected?.id === t.id ? 'var(--v2-accent-soft, #eef2ff)' : 'transparent',
                    borderBottom: '1px solid var(--v2-border-soft, #eee)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>{t.name}</span>
                  {t.hasLogin && <span style={{ fontSize: 11, color: 'var(--v2-text-muted)' }}>already has a login</span>}
                </div>
              ))}
            </div>
          )}
          {selected && (
            <div style={{ marginTop: '0.5rem', fontSize: 13 }}>
              Selected: <strong>{selected.name}</strong>
              {selected.hasLogin && (
                <span style={{ color: 'var(--v2-warning, #a15c00)' }}> — this tenant already has a login. A second one is unusual; make sure that's intended.</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddUserWizard({ onDone, onCancel }) {
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Step 1
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  // Step 2
  const [tenantMode, setTenantMode] = useState('new')
  const [newTenantName, setNewTenantName] = useState('')
  const [tenantQuery, setTenantQuery] = useState('')
  const [tenantResults, setTenantResults] = useState([])
  const [selectedTenant, setSelectedTenant] = useState(null)

  // Step 3 (optional -- "maybe" per the original instruction, so it can be skipped)
  const [industries, setIndustries] = useState('')
  const [geographies, setGeographies] = useState('')
  const [revenueMin, setRevenueMin] = useState('')
  const [revenueMax, setRevenueMax] = useState('')

  const step1Valid = email.trim() && password.trim().length >= 8
  const step2Valid = tenantMode === 'new' ? newTenantName.trim() : !!selectedTenant

  const finish = async () => {
    setBusy(true)
    setError(null)
    try {
      let tenant
      if (tenantMode === 'new') {
        const res = await client.post('/api/admin/tenants', { name: newTenantName.trim() }, { tenantScoped: false })
        tenant = res.data
      } else {
        tenant = selectedTenant
      }

      await client.post('/api/admin/users', {
        email: email.trim().toLowerCase(), password, name: name.trim() || null, tenant_id: tenant.id,
      }, { tenantScoped: false })

      // ICP is stored against the product backend, not the gateway -- reached through the
      // tenant-scoped proxy, which now works for a fresh tenant because create_tenant/
      // create_partner_user (gateway) just gave it a real backend_url. Best-effort: a partner
      // login and tenant already exist even if this one PUT fails, so a failure here is
      // surfaced but does not undo the two steps that already succeeded.
      const hasIcp = industries.trim() || geographies.trim() || revenueMin || revenueMax
      if (hasIcp) {
        // Built as a full path with tenantScoped:false, rather than the usual relative-path
        // + setActiveTenant() pattern -- this wizard is being run by an INTERNAL admin who
        // may have some other tenant already active elsewhere on the page (or in another
        // tab sharing this module's state); mutating the shared activeTenantSlug here just to
        // make one call would be a real, if narrow, race with whatever else is using it.
        await client.put(`/api/${tenant.slug}/gtm-os/partner/icp`, {
          industries: industries.split(',').map(s => s.trim()).filter(Boolean),
          geographies: geographies.split(',').map(s => s.trim()).filter(Boolean),
          revenue_min_usd: revenueMin ? Number(revenueMin) : null,
          revenue_max_usd: revenueMax ? Number(revenueMax) : null,
        }, { tenantScoped: false })
          .catch(err => setError(`User created, but saving the ICP failed: ${formatApiError(err)}`))
      }

      onDone()
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="v2-card" style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: 12.5, fontWeight: 600, color: 'var(--v2-text-muted)' }}>
        {['Login details', 'Tenant', 'ICP (optional)'].map((label, i) => (
          <span key={label} style={{ color: step === i + 1 ? 'var(--v2-text)' : undefined }}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {error && (
        <div className="v2-state v2-state-error" style={{ marginBottom: '1rem' }}>
          <IconAlertTriangle width={16} height={16} /> {error}
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="v2-field">
            <label className="v2-field-label">Email</label>
            <input className="v2-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="sandy@revenueretention.net" />
          </div>
          <div className="v2-field">
            <label className="v2-field-label">Password</label>
            <input className="v2-input" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div className="v2-field">
            <label className="v2-field-label">Name (optional)</label>
            <input className="v2-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Sandy Yu" />
          </div>
        </div>
      )}

      {step === 2 && (
        <TenantPicker
          mode={tenantMode} setMode={setTenantMode}
          newName={newTenantName} setNewName={setNewTenantName}
          query={tenantQuery} setQuery={setTenantQuery}
          results={tenantResults} setResults={setTenantResults}
          selected={selectedTenant} setSelected={setSelectedTenant}
        />
      )}

      {step === 3 && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--v2-text-muted)', marginTop: 0 }}>
            Optional. Skip this if their ICP isn&apos;t settled yet -- it can be added later.
          </p>
          <div className="v2-field">
            <label className="v2-field-label">Industries (comma-separated)</label>
            <input className="v2-input" type="text" value={industries} onChange={e => setIndustries(e.target.value)} placeholder="Software, SaaS" />
          </div>
          <div className="v2-field">
            <label className="v2-field-label">Geographies (comma-separated)</label>
            <input className="v2-input" type="text" value={geographies} onChange={e => setGeographies(e.target.value)} placeholder="United States" />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="v2-field" style={{ flex: 1 }}>
              <label className="v2-field-label">Revenue min (USD)</label>
              <input className="v2-input" type="number" value={revenueMin} onChange={e => setRevenueMin(e.target.value)} placeholder="25000000" />
            </div>
            <div className="v2-field" style={{ flex: 1 }}>
              <label className="v2-field-label">Revenue max (USD)</label>
              <input className="v2-input" type="number" value={revenueMax} onChange={e => setRevenueMax(e.target.value)} placeholder="100000000" />
            </div>
          </div>
        </div>
      )}

      <div className="v2-btn-row" style={{ marginTop: '1rem' }}>
        {step > 1 && <button type="button" className="v2-btn" onClick={() => setStep(step - 1)} disabled={busy}>Back</button>}
        <button type="button" className="v2-btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <span style={{ flex: 1 }} />
        {step < 3 && (
          <button
            type="button" className="v2-btn v2-btn-primary"
            disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
            onClick={() => setStep(step + 1)}
          >
            Next
          </button>
        )}
        {step === 3 && (
          <button type="button" className="v2-btn v2-btn-primary" onClick={finish} disabled={busy}>
            {busy ? 'Creating...' : 'Create user'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Users() {
  const { users, error, reload } = useUsers()
  const [adding, setAdding] = useState(false)
  const [justCreated, setJustCreated] = useState(null)

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error"><IconAlertTriangle width={20} height={20} /> {error}</div>
      </div>
    )
  }

  return (
    <div className="v2-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0 }}>Users &amp; partner access</h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: 13, color: 'var(--v2-text-muted)' }}>
            Internal team members see everything. A partner login is restricted to their own
            workspace and to whichever stage is enabled for them (accounts today).
          </p>
        </div>
        {!adding && (
          <button type="button" className="v2-btn v2-btn-primary" onClick={() => setAdding(true)}>+ Add user</button>
        )}
      </div>

      {justCreated && (
        <div className="v2-state" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCheck width={16} height={16} /> Created {justCreated.email} on {justCreated.tenant?.name}.
        </div>
      )}

      {users === null ? (
        <div className="v2-skeleton-row" style={{ height: 120 }} />
      ) : users.length === 0 ? (
        <div className="v2-state">No users yet.</div>
      ) : (
        <table className="v2-table">
          <thead>
            <tr><th>Email</th><th>Name</th><th>Role</th><th>Workspace</th><th>Created</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name || '—'}</td>
                <td>{u.role}</td>
                <td>{u.tenant ? u.tenant.name : '—'}</td>
                <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adding && (
        <AddUserWizard
          onCancel={() => setAdding(false)}
          onDone={() => { setAdding(false); reload() }}
        />
      )}
    </div>
  )
}
