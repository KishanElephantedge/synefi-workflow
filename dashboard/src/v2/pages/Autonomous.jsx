import { useEffect, useState } from 'react'
import {
  getControlConfig, putControlConfig, getControlStatus, getIntelligenceRuns,
  triggerIntelligenceRun, getIntelligenceSchedule, putIntelligenceSchedule, formatApiError,
} from '../api.js'
import { IconActivity, IconPlay, IconPause, IconStopCircle, IconAlertTriangle, IconChevronRight } from '../icons.jsx'
import { timeAgo } from '../briefingHelpers.jsx'

// Real vocabulary only -- app/gtm_os/orchestration/control.py's own three states.
const STATE_META = {
  running: { label: 'Running', tone: 'tone-success-solid' },
  paused: { label: 'Paused', tone: 'tone-warning-soft' },
  stopped: { label: 'Stopped', tone: 'tone-neutral' },
}

// GtmIntelligenceRun.status -- same vocabulary Pipeline.jsx's SystemStatusPanel already uses,
// reused verbatim rather than inventing a second run-status badge scheme.
const RUN_STATUS_LABEL = { running: 'Running', completed: 'Completed', partial: 'Partial', failed: 'Failed' }
const RUN_STATUS_BADGE = { running: 'v2-badge-info', completed: 'v2-badge-success', partial: 'v2-badge-warning', failed: 'v2-badge-danger' }

// The real S7 stage order, exactly as sweep.py/investigation_cycle.py execute them -- never
// reordered or renamed to match a nicer narrative.
const STAGE_ORDER = [
  { key: 'investigation_cycle', label: 'S2-S6 Investigation' },
  { key: 'interpretation', label: 'Interpretation' },
  { key: 'problem_detection', label: 'Problem Detection' },
  { key: 'demand_detection', label: 'Demand Detection' },
  { key: 'opportunity', label: 'Opportunity' },
  { key: 'icp_matching', label: 'ICP Matching' },
  { key: 'gtm_strategy', label: 'Strategy (outbound-gated)' },
  { key: 'contact_discovery', label: 'Contact Discovery (outbound-gated)' },
  { key: 'message_generation', label: 'Message Generation (outbound-gated)' },
  { key: 'send', label: 'Send (outbound-gated)' },
  { key: 'outreach_sequencing', label: 'Outreach Sequencing (outbound-gated)' },
  { key: 'sales_readiness', label: 'Sales Readiness' },
  { key: 'outcome_detection', label: 'Outcome Detection' },
]

function formatExact(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// UTC-explicit, to sit next to "Runs daily at (UTC)" without contradicting it -- formatExact()
// above renders in the browser's LOCAL timezone (right for a "when did this actually happen"
// hover), which previously made "Next run" silently disagree with the adjacent UTC schedule
// fields whenever the viewer wasn't in UTC themselves (e.g. a 10:00 UTC schedule showing as
// "15:30" for an IST browser, no indication why).
function formatExactUtc(date) {
  return date.toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' UTC'
}

// Next real UTC fire time for a fixed daily hour:minute -- today if that time hasn't passed yet
// (UTC "now"), otherwise tomorrow. Mirrors exactly what the CronTrigger itself will do.
function nextDailyFireUtc(hour, minute) {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0))
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return null
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (ms < 0) return null
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  return `${minutes}m`
}

// Only ever reads real fields already confirmed to exist on investigation_cycle's stage_results
// (app/gtm_os/intelligence/investigation_cycle.py) -- never a fabricated total.
function summarizeInvestigation(stageResults) {
  const ic = stageResults?.investigation_cycle
  if (!ic) return null
  const results = Array.isArray(ic.results) ? ic.results : []
  const blocked = results.filter(r => typeof r.exec_status === 'string' && r.exec_status.startsWith('blocked_by')).length
  return {
    status: ic.status,
    reason: ic.reason || null,
    considered: (ic.gap_identification?.created ?? 0) + (ic.gap_identification?.reused ?? 0),
    executed: ic.objectives_processed ?? results.length,
    blocked,
  }
}

function StagePanel({ stageKey, label, stage }) {
  if (!stage) {
    return (
      <div className="v2-auto-stage v2-auto-stage-empty">
        <span className="v2-auto-stage-label">{label}</span>
        <span className="v2-badge v2-badge-neutral">not reached</span>
      </div>
    )
  }
  const status = stage.status || 'unknown'
  const badge = status === 'succeeded' ? 'v2-badge-success' : status === 'skipped' || status === 'configuration_required' ? 'v2-badge-neutral' : status === 'failed' ? 'v2-badge-danger' : 'v2-badge-warning'
  const reason = stage.reason || stage.error || null

  return (
    <div className="v2-auto-stage">
      <div className="v2-auto-stage-head">
        <span className="v2-auto-stage-label">{label}</span>
        <span className={`v2-badge ${badge}`}>{status.replace(/_/g, ' ')}</span>
      </div>
      {stageKey === 'investigation_cycle' && status !== 'configuration_required' && (
        <div className="v2-auto-stage-detail">
          Objectives considered {stage.gap_identification?.created ?? 0} created / {stage.gap_identification?.reused ?? 0} reused ·
          {' '}executed {stage.objectives_processed ?? 0}
        </div>
      )}
      {reason && <div className="v2-auto-stage-reason">{reason}</div>}
      {!reason && stageKey !== 'investigation_cycle' && (
        <div className="v2-auto-stage-detail">
          {Object.entries(stage).filter(([k]) => k !== 'status').map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}
        </div>
      )}
    </div>
  )
}

function RunRow({ run, expanded, onToggle }) {
  const summary = summarizeInvestigation(run.stage_results)
  const duration = formatDuration(run.started_at, run.completed_at)
  const opportunitiesCreated = run.stage_results?.opportunity?.created
  const messagesDrafted = run.stage_results?.message_generation?.drafted
  const sendsSubmitted = run.stage_results?.send?.request_submitted

  return (
    <div className="v2-auto-run">
      <button type="button" className="v2-auto-run-summary" onClick={onToggle}>
        <div className="v2-auto-run-summary-main">
          <span className="v2-auto-run-time" title={formatExact(run.started_at)}>{timeAgo(run.started_at)}</span>
          {duration && <span className="v2-auto-run-duration">{duration}</span>}
          <span className={`v2-badge ${RUN_STATUS_BADGE[run.status] || 'v2-badge-neutral'}`}>{RUN_STATUS_LABEL[run.status] || run.status}</span>
        </div>
        <div className="v2-auto-run-summary-stats">
          {summary && (
            <span className="v2-auto-run-stat">
              {summary.considered} considered · {summary.executed} executed{summary.blocked > 0 ? ` · ${summary.blocked} blocked` : ''}
            </span>
          )}
          {opportunitiesCreated != null && <span className="v2-auto-run-stat">{opportunitiesCreated} opp</span>}
          {messagesDrafted != null && <span className="v2-auto-run-stat">{messagesDrafted} msg</span>}
          {sendsSubmitted != null && <span className="v2-auto-run-stat">{sendsSubmitted} sent</span>}
          <IconChevronRight width={14} height={14} className={`v2-auto-run-chevron${expanded ? ' open' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="v2-auto-run-detail">
          {run.error_summary && (
            <div className="v2-auto-run-error">
              <IconAlertTriangle width={14} height={14} />
              {run.error_summary}
            </div>
          )}
          {STAGE_ORDER.map(({ key, label }) => (
            <StagePanel key={key} stageKey={key} label={label} stage={run.stage_results?.[key]} />
          ))}
        </div>
      )}
    </div>
  )
}

// Fixed daily UTC time the sensing cycle fires at -- editable inline, matches V1's own daily
// autonomous cycle schedule control pattern (Settings > autonomous schedule).
function ScheduleControl({ schedule, onChanged }) {
  const [hour, setHour] = useState(schedule.hour)
  const [minute, setMinute] = useState(schedule.minute)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { setHour(schedule.hour); setMinute(schedule.minute) }, [schedule.hour, schedule.minute])

  const dirty = hour !== schedule.hour || minute !== schedule.minute

  const save = () => {
    setSaving(true)
    setError(null)
    putIntelligenceSchedule(hour, minute).then(onChanged).catch(err => setError(formatApiError(err))).finally(() => setSaving(false))
  }

  return (
    <div className="v2-auto-hero-stat">
      <div className="v2-kv-label">Runs daily at (UTC)</div>
      <div className="v2-kv-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <input
          type="number" min="0" max="23" value={hour} onChange={e => setHour(Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)))}
          style={{ width: 48, padding: '0.3rem 0.4rem', borderRadius: 'var(--v2-radius)', border: '1px solid var(--v2-border)', background: 'var(--v2-surface)', color: 'var(--v2-text)' }}
        />
        :
        <input
          type="number" min="0" max="59" value={minute} onChange={e => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
          style={{ width: 48, padding: '0.3rem 0.4rem', borderRadius: 'var(--v2-radius)', border: '1px solid var(--v2-border)', background: 'var(--v2-surface)', color: 'var(--v2-text)' }}
        />
        {dirty && <button type="button" className="v2-btn v2-btn-primary" disabled={saving} style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={save}>{saving ? 'Saving...' : 'Save'}</button>}
      </div>
      {error && <div className="v2-form-message error">{error}</div>}
    </div>
  )
}

export default function Autonomous() {
  const [status, setStatus] = useState(null)
  const [config, setConfig] = useState(null)
  const [runs, setRuns] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [error, setError] = useState(null)
  const [actionPending, setActionPending] = useState(false)
  const [actionMessage, setActionMessage] = useState(null)
  const [expandedRunId, setExpandedRunId] = useState(null)

  function load() {
    Promise.all([getControlStatus(), getControlConfig(), getIntelligenceRuns(20), getIntelligenceSchedule()])
      .then(([s, c, r, sch]) => { setStatus(s); setConfig(c); setRuns(r); setSchedule(sch) })
      .catch(err => setError(formatApiError(err)))
  }

  useEffect(() => { load() }, [])

  function runAction(fn) {
    setActionPending(true)
    setActionMessage(null)
    return fn()
      .then(() => { load(); setActionMessage(null) })
      .catch(err => setActionMessage(formatApiError(err)))
      .finally(() => setActionPending(false))
  }

  function setState(newState) {
    runAction(() => putControlConfig({ ...config, state: newState }))
  }

  function runNow() {
    runAction(() => triggerIntelligenceRun(false))
  }

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load autonomous status: {error}</div>
        </div>
      </div>
    )
  }
  if (status === null || config === null || runs === null || schedule === null) {
    return <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 200 }} />
  }

  const stateMeta = STATE_META[status.state] || STATE_META.stopped
  const latestRun = status.latest_run
  const apifyConfigured = config.apify?.daily_budget_usd != null || config.apify?.monthly_budget_usd != null
  const investigationConfigured = config.investigation?.max_objectives_per_tick != null
  const outboundConfigured = config.outbound?.cadence_hours != null

  return (
    <div className="v2-auto-page">
      <div className="v2-page-eyebrow">Show what the autonomous system is doing and why.</div>

      <div className="v2-card v2-auto-hero">
        <div className="v2-auto-hero-top">
          <div className="v2-auto-hero-state">
            <IconActivity width={18} height={18} />
            <span className={`v2-status-pill ${stateMeta.tone}`}>{stateMeta.label}</span>
          </div>
          <div className="v2-btn-row">
            {status.state !== 'running' && (
              <button type="button" className="v2-btn v2-btn-primary" disabled={actionPending} onClick={() => setState('running')}>
                <IconPlay width={13} height={13} /> Resume
              </button>
            )}
            {status.state === 'running' && (
              <button type="button" className="v2-btn" disabled={actionPending} onClick={() => setState('paused')}>
                <IconPause width={13} height={13} /> Pause
              </button>
            )}
            {status.state !== 'stopped' && (
              <button type="button" className="v2-btn v2-btn-danger" disabled={actionPending} onClick={() => setState('stopped')}>
                <IconStopCircle width={13} height={13} /> Stop
              </button>
            )}
            <button type="button" className="v2-btn" disabled={actionPending} onClick={runNow}>
              Run now
            </button>
          </div>
        </div>

        {actionMessage && <div className="v2-auto-action-message">{actionMessage}</div>}

        <div className="v2-auto-hero-stats">
          <div className="v2-auto-hero-stat">
            <div className="v2-kv-label">Last run</div>
            <div className="v2-kv-value">
              {latestRun ? (
                <>
                  {timeAgo(latestRun.started_at)}{' '}
                  <span className={`v2-badge ${RUN_STATUS_BADGE[latestRun.status] || 'v2-badge-neutral'}`}>{RUN_STATUS_LABEL[latestRun.status] || latestRun.status}</span>
                </>
              ) : 'No runs yet'}
            </div>
          </div>
          <div className="v2-auto-hero-stat">
            <div className="v2-kv-label">Next run (UTC)</div>
            <div className="v2-kv-value">
              {status.state === 'running'
                ? formatExactUtc(nextDailyFireUtc(schedule.hour, schedule.minute))
                : 'Paused — no autonomous ticks'}
            </div>
          </div>
          <ScheduleControl schedule={schedule} onChanged={load} />
          <div className="v2-auto-hero-stat">
            <div className="v2-kv-label">Investigation cap</div>
            <div className="v2-kv-value">{investigationConfigured ? `${config.investigation.max_objectives_per_tick} / tick` : 'Not configured'}</div>
          </div>
          <div className="v2-auto-hero-stat">
            <div className="v2-kv-label">Outbound cadence</div>
            <div className="v2-kv-value">{outboundConfigured ? `every ${config.outbound.cadence_hours}h` : 'Disabled (unconfigured)'}</div>
          </div>
        </div>

        {!apifyConfigured && (
          <div className="v2-auto-safety-note">
            LinkedIn/web investigation is blocked — no Apify budget is configured yet.
          </div>
        )}
      </div>

      <div className="v2-section-title">Recent runs</div>

      {runs.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">Autonomous activity will appear here after the next scheduled run.</div>
        </div>
      ) : (
        <div className="v2-card v2-auto-runs-card">
          {runs.map(run => (
            <RunRow
              key={run.id}
              run={run}
              expanded={expandedRunId === run.id}
              onToggle={() => setExpandedRunId(id => (id === run.id ? null : run.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
