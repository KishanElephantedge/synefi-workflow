import { useEffect, useState } from 'react'
import { getPartnerEngagementLeads, formatApiError } from '../v2/api.js'

const PAGE_SIZE = 25

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Real, human labels for the categories classify_engagement_intent (app/gtm_os/intelligence/
// engagement_intent.py) can return -- kept in sync with that module's own CATEGORY_* constants.
const CATEGORY_LABEL = {
  direct_interest: 'Direct interest',
  attendance_signal: 'Attendance signal',
  pain_signal: 'Pain signal',
}

// Engagement mining's own output page (2026-09-22, explicit instruction after majji asked to
// see "how many each objective gets us"). Deliberately NOT the Accounts table -- these people
// don't have a Company row at all (the comment-harvest actor doesn't pre-enrich an employer),
// so this is a straight, honest list of what THIS objective found, qualified or not -- "never
// discard purchased data" applies to what's shown here too, not just what's stored.
export default function PartnerEngagementLeads() {
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [qualifiedTotal, setQualifiedTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [qualifiedOnly, setQualifiedOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getPartnerEngagementLeads({ page, pageSize: PAGE_SIZE, qualifiedOnly })
      .then((data) => {
        if (cancelled) return
        setLeads(data.leads || [])
        setTotal(data.total || 0)
        setQualifiedTotal(data.qualified_total || 0)
      })
      .catch((err) => {
        if (cancelled) return
        setError(formatApiError(err))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [page, qualifiedOnly])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="partnerAccountsHeader">
        <h1>Engagement Leads</h1>
        <p>People who commented on relevant LinkedIn posts, found by phrase search across your ICP's real buying language.</p>
      </div>

      <div className="partnerPeriodStats">
        <div><strong>{total}</strong> people found</div>
        <div><strong>{qualifiedTotal}</strong> qualified (real intent match)</div>
      </div>

      <div className="partnerSearchRow">
        <label className="partnerCheckboxLabel">
          <input
            type="checkbox"
            checked={qualifiedOnly}
            onChange={(e) => { setPage(1); setQualifiedOnly(e.target.checked) }}
          />
          Qualified only
        </label>
      </div>

      {loading ? (
        <div className="partnerLoadingState">Loading...</div>
      ) : error ? (
        <div className="partnerErrorState">{error}</div>
      ) : leads.length === 0 ? (
        <div className="partnerCardWrap">
          <div className="partnerEmptyState">
            {qualifiedOnly ? 'No qualified leads yet -- check back after the next run.' : 'No engagement leads found yet -- check back soon.'}
          </div>
        </div>
      ) : (
        <div className="partnerTableWrap">
          <table className="partnerTable">
            <thead>
              <tr>
                <th>Person</th>
                <th>Comment</th>
                <th>Post</th>
                <th>Intent</th>
                <th>Found</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="partnerAccountName">{l.person_name || '—'}</div>
                  </td>
                  <td className="partnerTableMuted" style={{ maxWidth: 320 }}>
                    {l.comment_text || '—'}
                  </td>
                  <td className="partnerTableMuted" style={{ maxWidth: 220 }}>
                    {l.post_author_name ? `${l.post_author_name}'s post` : 'Post'}
                    {l.post_text && <div title={l.post_text} style={{ marginTop: 2 }}>{l.post_text.slice(0, 60)}{l.post_text.length > 60 ? '…' : ''}</div>}
                  </td>
                  <td>
                    {l.intent_qualified ? (
                      <span className="partnerTag partnerTagPrimary">
                        {(l.intent_categories || []).map((c) => CATEGORY_LABEL[c] || c).join(', ') || 'Qualified'}
                      </span>
                    ) : (
                      <span className="partnerTag partnerTagWarn">Not qualified</span>
                    )}
                  </td>
                  <td className="partnerTableMuted">{formatDate(l.found_at) || '—'}</td>
                  <td>
                    {l.profile_url && (
                      <a className="partnerTableAction" href={l.profile_url} target="_blank" rel="noreferrer">
                        View profile <span className="partnerAccountArrow">→</span>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && total > PAGE_SIZE && (
        <div className="partnerPagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
