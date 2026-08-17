import { useEffect, useState } from 'react'
import { getBriefingGovernance, formatApiError } from '../api.js'
import { IconAlertTriangle } from '../icons.jsx'
import { CheckRow, PreviewSection, Section, CATEGORY_LINK, STAGE_LINK } from '../briefingHelpers.jsx'

const PREVIEW_LIMIT = 3

// "Is this account configured well enough to safely generate a GTM briefing?" -- answered
// entirely from evaluate_gtm_governance()'s real output (Batch 14). No score, allocation, or
// recommendation is computed in this file: the only derived value is `overallLabel` below, a
// plain-English restatement of whether configuration_gaps/data_gaps/operational_issues are
// empty -- counting, not scoring, and shown as exactly that (see the hero card's own caption).
// Each list below shows at most 3 items inline + a real "View all N" link to
// /v2/briefing/:category (BriefingCategoryDetail.jsx) instead of unrolling every gap onto this
// page -- the full, untruncated list is always one click away, never hidden.
export default function Briefing() {
  const [gov, setGov] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getBriefingGovernance().then(setGov).catch(err => setError(formatApiError(err)))
  }, [])

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load governance: {error}</div>
        </div>
      </div>
    )
  }

  if (gov === null) {
    return (
      <div>
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 140, marginBottom: '1.5rem' }} />
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 300 }} />
      </div>
    )
  }

  const configGaps = gov.configuration_gaps || []
  const dataGaps = gov.data_gaps || []
  const opsIssues = gov.operational_issues || []
  const humanAttention = gov.human_attention || []
  const bottleneck = gov.bottlenecks?.[0]

  const heroTone = opsIssues.length > 0 ? 'has-blockers' : (configGaps.length + dataGaps.length > 0 ? 'has-warnings' : 'clear')
  const overallLabel = opsIssues.length > 0 ? 'Blocked' : (configGaps.length + dataGaps.length > 0 ? 'Needs configuration' : 'Ready')

  return (
    <div>
      <div className={`v2-readiness-hero v2-spotlight ${heroTone}`}>
        <div style={{ fontSize: '0.76rem', color: 'var(--v2-spot-text-faint)' }}>Overall readiness (derived from the real counts below -- not a backend score)</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0.3rem 0 0.5rem', color: 'var(--v2-spot-text)' }}>{overallLabel}</div>
        <p style={{ marginBottom: 0, color: 'var(--v2-spot-text-muted)', fontSize: '0.9rem', lineHeight: 1.55, maxWidth: '60ch' }}>
          {opsIssues.length > 0 && `${opsIssues.length} operational issue${opsIssues.length === 1 ? '' : 's'} recorded. `}
          {configGaps.length > 0 && `${configGaps.length} configuration gap${configGaps.length === 1 ? '' : 's'}. `}
          {dataGaps.length > 0 && `${dataGaps.length} data gap${dataGaps.length === 1 ? '' : 's'}. `}
          {configGaps.length === 0 && dataGaps.length === 0 && opsIssues.length === 0 && 'No configuration, data, or operational gaps were found by the governance evaluator.'}
        </p>
        <div className="v2-stat-row" style={{ marginTop: '1rem', marginBottom: 0 }}>
          <div className="v2-stat-tile">
            <div className="v2-stat-label">Companies evaluated</div>
            <div className="v2-stat-value">{gov.overview?.total_companies ?? 0}</div>
          </div>
          <div className="v2-stat-tile">
            <div className="v2-stat-label">Opportunities evaluated</div>
            <div className="v2-stat-value">{gov.overview?.opportunities_evaluated ?? 0}</div>
          </div>
          <div className="v2-stat-tile">
            <div className="v2-stat-label">Needs your attention</div>
            <div className="v2-stat-value">{humanAttention.length}</div>
          </div>
        </div>
      </div>

      <PreviewSection
        title="Needs your attention"
        items={humanAttention}
        limit={PREVIEW_LIMIT}
        emptyText="Nothing currently needs attention."
        viewAllTo="/v2/briefing/attention"
        renderItem={(item, i) => (
          <CheckRow
            key={i}
            severity={item.category === 'operational' ? 'danger' : 'warning'}
            description={item.description}
            link={CATEGORY_LINK[item.category]}
          />
        )}
      />

      <PreviewSection
        title="Configuration gaps"
        items={configGaps}
        limit={PREVIEW_LIMIT}
        emptyText="No configuration gaps -- every offering/motion this evaluator checks has at least one applicable_icps/applicable_offerings rule set."
        viewAllTo="/v2/briefing/configuration"
        renderItem={(gap, i) => (
          <CheckRow
            key={i}
            severity="warning"
            description={gap.description}
            meta={`source: ${gap.source}`}
            link={STAGE_LINK[gap.relates_to_stage] || CATEGORY_LINK.configuration}
          />
        )}
      />

      <PreviewSection
        title="Data gaps"
        items={dataGaps}
        limit={PREVIEW_LIMIT}
        emptyText="No data gaps found on the fields this evaluator checks."
        viewAllTo="/v2/briefing/data"
        renderItem={(gap, i) => (
          <CheckRow
            key={i}
            severity="warning"
            description={`${gap.missing_count}/${gap.denominator} companies missing ${gap.field}`}
            meta={`source: ${gap.source}`}
            link={CATEGORY_LINK.data}
          />
        )}
      />

      {opsIssues.length > 0 && (
        <PreviewSection
          title="Operational issues"
          items={opsIssues}
          limit={PREVIEW_LIMIT}
          viewAllTo="/v2/briefing/operational"
          renderItem={(issue, i) => (
            <CheckRow
              key={i}
              severity="danger"
              description={issue.error_message}
              meta={`run #${issue.run_id} · ${issue.started_at ? new Date(issue.started_at).toLocaleString() : ''}`}
            />
          )}
        />
      )}

      {bottleneck && (
        <Section title="Largest observed bottleneck">
          <div className="v2-card">
            <div className="v2-config-card-title" style={{ marginBottom: 6 }}>{bottleneck.from} → {bottleneck.to}</div>
            <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>
              {bottleneck.drop_count} account{bottleneck.drop_count === 1 ? '' : 's'} drop off between these stages. {bottleneck.reason}
            </p>
          </div>
        </Section>
      )}
    </div>
  )
}
