import { useEffect, useState } from 'react'
import { createLink, getLink, listLinks, shortUrlFor, toggleArchiveLink } from '../../api/links'
import { formatApiError } from '../api.js'
import { formatRecency } from '../format.js'
import { IconAlertTriangle, IconCheck, IconChevronDown, IconChevronRight } from '../icons.jsx'

// Click tracking for anything we send out. Until now a link in an outbound message was
// completely invisible once sent -- the Gumroad playbook links, for instance, produce no signal
// at all about who opened them.
//
// Bot fetches are reported separately rather than folded into the headline number: LinkedIn,
// mail scanners and chat previewers all fetch a URL the moment it is sent, so counting them
// would make every link look like it got instant engagement.

function ClickDetail({ linkId }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getLink(linkId).then(setDetail).catch((err) => setError(formatApiError(err)))
  }, [linkId])

  if (error) return <div className="v2-table-muted" style={{ padding: '0.6rem 1rem' }}>Couldn't load clicks: {error}</div>
  if (!detail) return <div className="v2-table-muted" style={{ padding: '0.6rem 1rem' }}>Loading clicks…</div>
  if (!detail.recent?.length) {
    return <div className="v2-table-muted" style={{ padding: '0.6rem 1rem' }}>No clicks recorded yet.</div>
  }

  return (
    <div className="v2-table-wrap" style={{ margin: '0.4rem 1rem 0.8rem', maxHeight: 260, overflowY: 'auto' }}>
      <table className="v2-table">
        <thead><tr><th>When</th><th>Sent to</th><th>From</th><th>Type</th></tr></thead>
        <tbody>
          {detail.recent.map((c, i) => {
            const when = formatRecency(c.created_at)
            return (
              <tr key={i}>
                <td className="v2-table-muted" title={when?.exact}>{when ? when.label : '—'}</td>
                <td className={c.recipient ? '' : 'v2-table-muted'}>{c.recipient || '—'}</td>
                <td className={c.country ? '' : 'v2-table-muted'}>{c.country || '—'}</td>
                <td>
                  <span className={`v2-status-pill tone-${c.is_bot ? 'neutral' : 'success-solid'}`}>
                    {c.is_bot ? 'Bot / preview' : 'Person'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CreateForm({ onCreated }) {
  const [destinationUrl, setDestinationUrl] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = (e) => {
    e.preventDefault()
    if (!destinationUrl.trim()) return
    setSaving(true)
    setError(null)
    createLink({ destinationUrl: destinationUrl.trim(), label: label.trim() })
      .then((link) => {
        setDestinationUrl('')
        setLabel('')
        onCreated(link)
      })
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setSaving(false))
  }

  return (
    <form className="v2-card" onSubmit={submit} style={{ marginBottom: 16 }}>
      <div className="v2-section-title">Create a tracked link</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <input
          className="v2-input"
          style={{ flex: '2 1 320px' }}
          placeholder="Destination URL (https://…)"
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
        />
        <input
          className="v2-input"
          style={{ flex: '1 1 200px' }}
          placeholder="Label (what is this link?)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="submit" className="v2-btn" disabled={saving || !destinationUrl.trim()}>
          {saving ? 'Creating…' : 'Create'}
        </button>
      </div>
      {error && <div className="v2-table-muted" style={{ marginTop: 8, color: 'var(--v2-danger)' }}>{error}</div>}
      <div className="v2-table-muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
        To see <em>who</em> clicked, add <code>?r=</code> to the end of the short link when you send
        it — e.g. <code>…/l/abc123?r=&#123;&#123;firstName&#125;&#125;</code> in a SalesRobot sequence, so each
        recipient's click is attributed to them.
      </div>
    </form>
  )
}

export default function Links() {
  const [links, setLinks] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [copied, setCopied] = useState(null)
  const [includeArchived, setIncludeArchived] = useState(false)

  const load = () => {
    listLinks(includeArchived)
      .then((data) => {
        setLinks(data.links)
        setError(null)
      })
      .catch((err) => setError(formatApiError(err)))
  }

  useEffect(load, [includeArchived])

  const copy = (slug) => {
    navigator.clipboard
      ?.writeText(shortUrlFor(slug))
      .then(() => {
        setCopied(slug)
        setTimeout(() => setCopied((s) => (s === slug ? null : s)), 1800)
      })
      .catch(() => {})
  }

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load links: {error}</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <CreateForm onCreated={load} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="v2-stat-label">{links ? `${links.length} link${links.length === 1 ? '' : 's'}` : ''}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      {links === null ? (
        <div className="v2-card"><div className="v2-state">Loading links…</div></div>
      ) : links.length === 0 ? (
        <div className="v2-card"><div className="v2-state">No tracked links yet. Create one above.</div></div>
      ) : (
        <div className="v2-table-wrap">
          <table className="v2-table">
            <thead>
              <tr>
                <th></th>
                <th>Link</th>
                <th>Destination</th>
                <th>Clicks</th>
                <th>Bot / preview</th>
                <th>Last clicked</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const last = formatRecency(link.last_clicked_at)
                const isOpen = expanded === link.id
                return [
                  <tr key={link.id} style={link.archived_at ? { opacity: 0.55 } : undefined}>
                    <td>
                      <button
                        type="button"
                        className="v2-btn"
                        style={{ padding: '0.25rem 0.4rem' }}
                        onClick={() => setExpanded(isOpen ? null : link.id)}
                        aria-label={isOpen ? 'Hide clicks' : 'Show clicks'}
                      >
                        {isOpen ? <IconChevronDown width={12} height={12} /> : <IconChevronRight width={12} height={12} />}
                      </button>
                    </td>
                    <td>
                      <div className="v2-account-name">{link.label || '(no label)'}</div>
                      <button
                        type="button"
                        onClick={() => copy(link.slug)}
                        title="Copy short link"
                        // Colour set from the token directly, NOT via .v2-table-muted: that rule is
                        // scoped to `td`, so on a <button> it silently loses to the app's own button
                        // default and renders white-on-white (found live, 2026-09-13).
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          font: 'inherit',
                          color: 'var(--v2-text-muted)',
                        }}
                      >
                        /l/{link.slug}{' '}
                        {copied === link.slug ? <IconCheck width={11} height={11} /> : <span>· copy</span>}
                      </button>
                    </td>
                    <td className="v2-table-muted" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {link.destination_url}
                    </td>
                    <td style={{ fontWeight: 700 }}>{link.clicks}</td>
                    <td className="v2-table-muted">{link.bot_clicks}</td>
                    <td className="v2-table-muted" title={last?.exact}>{last ? last.label : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="v2-btn"
                        style={{ padding: '0.3rem 0.5rem' }}
                        onClick={() => toggleArchiveLink(link.id).then(load)}
                      >
                        {link.archived_at ? 'Restore' : 'Archive'}
                      </button>
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={`${link.id}-detail`}>
                      <td colSpan={7} style={{ padding: 0 }}><ClickDetail linkId={link.id} /></td>
                    </tr>
                  ),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
