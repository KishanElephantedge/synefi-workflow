import { useEffect, useMemo, useState } from 'react'
import { useTenant } from '../../context/TenantContext.jsx'
import { getPartnerFeatures, savePartnerFeatures, formatApiError } from '../api.js'

// Admin-side per-partner feature configuration (2026-10-07).
//
// Partners don't all want the same modules -- one asks for webinars, another for email marketing,
// and two who want "the same" feature usually want it pointed at different campaigns. That was
// starting to be handled by hardcoding a tenant id in the backend, which made every new partner a
// code change. Now it is data: a flag for which modules a partner sees, and config rows for what
// those modules point at.
//
// This lives on the ADMIN side on purpose -- Elephant Edge runs the partner's back office today.
// Partner self-serve arrives when the product becomes subscription-based; the same API will back
// it, so this screen is not throwaway.
//
// Every field below is rendered from the backend's own `config_schema`. Adding a feature or a
// setting server-side makes it appear here with no frontend change, which is the point: a new
// partner requirement should not need a deploy of two repos.

function ConfigField({ field, value, onChange }) {
  const isStructured = field.type === 'object_list'
  const asText = isStructured
    ? (value == null ? '' : JSON.stringify(value, null, 2))
    : (value ?? '')

  return (
    <div className="v2-field">
      <label className="v2-field-label">
        {field.label}
        {field.required && <span style={{ color: 'var(--v2-danger, #d33)' }}> *</span>}
      </label>
      {isStructured ? (
        <textarea
          className="v2-textarea"
          rows={5}
          value={asText}
          placeholder={field.example || ''}
          onChange={e => onChange(field.key, e.target.value, true)}
        />
      ) : (
        <input
          className="v2-input"
          type={field.type === 'integer' ? 'number' : 'text'}
          value={asText}
          placeholder={field.example || ''}
          onChange={e => onChange(field.key, e.target.value, false)}
        />
      )}
      {field.help && <div className="v2-field-hint">{field.help}</div>}
    </div>
  )
}

function ReadinessBadge({ feature }) {
  if (!feature.enabled) return <span className="v2-pill">Off</span>
  if (feature.ready) return <span className="v2-pill v2-pill-good">Ready</span>
  const missing = [...feature.missing_config, ...feature.missing_credentials]
  return <span className="v2-pill v2-pill-warn">Needs: {missing.join(', ')}</span>
}

export default function PartnerFeatures() {
  const { tenants } = useTenant()
  const partners = useMemo(
    () => (tenants || []).filter(t => t.slug !== 'elephant-edge'),
    [tenants],
  )

  const [tenantId, setTenantId] = useState(null)
  const [data, setData] = useState(null)
  const [drafts, setDrafts] = useState({})     // { featureKey: { configKey: rawValue } }
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (tenantId == null && partners.length) setTenantId(partners[0].id)
  }, [partners, tenantId])

  useEffect(() => {
    if (tenantId == null) return
    setData(null)
    setDrafts({})
    setError(null)
    getPartnerFeatures(tenantId).then(setData).catch(err => setError(formatApiError(err)))
  }, [tenantId])

  const toggleFeature = (key) => {
    setData(d => ({
      ...d,
      features: d.features.map(f => (f.key === key ? { ...f, enabled: !f.enabled } : f)),
    }))
    setSaved(false)
  }

  const editConfig = (featureKey) => (configKey, raw, structured) => {
    setDrafts(d => ({
      ...d,
      [featureKey]: { ...(d[featureKey] || {}), [configKey]: { raw, structured } },
    }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      // Only send what was actually edited. The backend merges rather than replacing, so a field
      // this screen never showed can't be wiped -- the exact failure that hit the partner ICP form.
      const config = {}
      for (const [featureKey, fields] of Object.entries(drafts)) {
        const values = {}
        for (const [configKey, { raw, structured }] of Object.entries(fields)) {
          if (structured) {
            if (raw.trim() === '') continue
            try {
              values[configKey] = JSON.parse(raw)
            } catch {
              throw new Error(`${configKey}: not valid JSON`)
            }
          } else {
            values[configKey] = raw
          }
        }
        if (Object.keys(values).length) config[featureKey] = values
      }

      const body = {
        enabled_features: data.features.filter(f => f.enabled).map(f => f.key),
        config,
      }
      const updated = await savePartnerFeatures(tenantId, body)
      setData(updated)
      setDrafts({})
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error && err.message.includes('not valid JSON')
        ? err.message
        : formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  if (!partners.length) return <div className="v2-empty">No partner tenants yet.</div>

  return (
    <div>
      <div className="v2-field" style={{ maxWidth: 360 }}>
        <label className="v2-field-label">Partner</label>
        <select
          className="v2-input"
          value={tenantId ?? ''}
          onChange={e => setTenantId(Number(e.target.value))}
        >
          {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {error && <div className="v2-error">{error}</div>}
      {!data && !error && <div className="v2-loading">Loading...</div>}

      {data && (
        <>
          {data.features.map(feature => {
            const draft = drafts[feature.key] || {}
            return (
              <div key={feature.key} className="v2-config-card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={feature.enabled}
                      onChange={() => toggleFeature(feature.key)}
                    />
                    <span className="v2-config-card-title">{feature.label}</span>
                  </label>
                  <ReadinessBadge feature={feature} />
                </div>

                <div className="v2-field-hint" style={{ marginTop: 6 }}>{feature.description}</div>
                {feature.note && <div className="v2-field-hint"><em>{feature.note}</em></div>}

                {feature.enabled && feature.config_schema.map(field => (
                  <ConfigField
                    key={field.key}
                    field={field}
                    value={draft[field.key] !== undefined ? draft[field.key].raw : feature.config[field.key]}
                    onChange={editConfig(feature.key)}
                  />
                ))}
              </div>
            )
          })}

          <div className="v2-field" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="v2-button" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            {saved && <span className="v2-field-hint">Saved</span>}
          </div>
        </>
      )}
    </div>
  )
}
