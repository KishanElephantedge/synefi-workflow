import { useEffect, useMemo, useState } from 'react'
import { useTenant } from '../context/TenantContext'
import { getPartnerTasks, createPartnerTask, updatePartnerTask, deletePartnerTask, formatApiError } from '../v2/api.js'

// Internal-only task tracker (2026-10-16, Majji's request): what Elephant Edge owes this
// partner and what the partner owes us, each with a deadline. Never reachable by the partner's
// own login -- the backend 404s any request missing the gateway's x-internal-user header, so
// this page only ever renders real data when viewed through /v2/partner-view as an internal
// admin.
//
// Redesigned same day per explicit instruction, after the first pass (checkbox, raw two-column
// list) shipped: a status DROPDOWN instead of a binary checkbox, status TABS instead of a raw
// list, one OWNER switch instead of two columns side by side, and an optional NOTE per task --
// the minimum set every mainstream tracker (Asana, Trello, Linear, ClickUp) converges on for
// exactly this shape of work: a flat list of discrete, deadline-bound items with no sub-tasks,
// no assignee beyond "us or them," and nothing resembling a board/kanban view, since that would
// be scope well past what this is for.

const OWNER_TABS = (partnerName) => [
  { value: 'us', label: 'Fractional Partner' },
  { value: 'partner', label: partnerName || 'Partner' },
]

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

const STATUS_FILTERS = [{ value: 'all', label: 'All' }, ...STATUSES]

function daysUntil(deadline) {
  if (!deadline) return null
  return Math.ceil((new Date(`${deadline}T00:00:00`) - new Date(new Date().toDateString())) / 86400000)
}

function DeadlineBadge({ deadline, status }) {
  if (!deadline) return null
  const diff = daysUntil(deadline)
  const overdue = status !== 'completed' && diff < 0
  const dueSoon = status !== 'completed' && diff >= 0 && diff <= 2
  return (
    <span className={'partnerTag' + (overdue ? ' partnerTagWarn' : dueSoon ? ' partnerTagPrimary' : '')}>
      {overdue ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Due today' : `Due ${deadline}`}
    </span>
  )
}

function StatusSelect({ task, onChange }) {
  return (
    <select
      className={'taskStatusSelect taskStatusSelect--' + task.status}
      value={task.status}
      onChange={(e) => onChange(task, e.target.value)}
    >
      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  )
}

function TaskRow({ task, onStatusChange, onDelete }) {
  return (
    <div className="taskRow">
      <div className="taskRowMain">
        <StatusSelect task={task} onChange={onStatusChange} />
        <div className="taskRowText">
          <span className={task.status === 'completed' ? 'taskTitleDone' : 'taskTitle'}>{task.title}</span>
          {task.notes && <div className="taskNote">{task.notes}</div>}
        </div>
      </div>
      <div className="taskRowMeta">
        <DeadlineBadge deadline={task.deadline} status={task.status} />
        <button type="button" className="taskRowDelete" onClick={() => onDelete(task)} aria-label="Delete task">x</button>
      </div>
    </div>
  )
}

function AddTaskForm({ owner, onAdd }) {
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [notes, setNotes] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onAdd({ title: title.trim(), owner, deadline, notes })
      setTitle('')
      setDeadline('')
      setNotes('')
      setNotesOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="taskAddForm" onSubmit={submit}>
      <div className="taskAddFormRow">
        <input
          type="text"
          placeholder="Add a task..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="taskAddInput"
        />
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="taskAddDate"
        />
        <button
          type="button"
          className="taskAddNoteToggle"
          onClick={() => setNotesOpen((v) => !v)}
          aria-label="Add a note"
        >
          {notesOpen ? 'Hide note' : '+ Note'}
        </button>
        <button type="submit" className="partnerBtnSecondary" disabled={saving || !title.trim()}>Add</button>
      </div>
      {notesOpen && (
        <textarea
          className="taskAddNote"
          placeholder="Optional note..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      )}
    </form>
  )
}

export default function PartnerInternalTasks({ partnerName }) {
  const { user } = useTenant()
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState(null)
  const [owner, setOwner] = useState('us')
  const [statusFilter, setStatusFilter] = useState('all')

  const reload = () => {
    getPartnerTasks().then(setTasks).catch((e) => setError(formatApiError(e)))
  }

  useEffect(reload, [])

  const handleAdd = ({ title, owner: taskOwner, deadline, notes }) =>
    createPartnerTask({ title, owner: taskOwner, deadline, notes, createdBy: user?.email })
      .then(reload)
      .catch((e) => setError(formatApiError(e)))

  const handleStatusChange = (task, status) =>
    updatePartnerTask(task.id, { status })
      .then(reload)
      .catch((e) => setError(formatApiError(e)))

  const handleDelete = (task) =>
    deletePartnerTask(task.id)
      .then(reload)
      .catch((e) => setError(formatApiError(e)))

  const ownerTabs = OWNER_TABS(partnerName)

  const counts = useMemo(() => {
    const byOwner = (tasks || []).filter((t) => t.owner === owner)
    return Object.fromEntries(STATUS_FILTERS.map((f) => [
      f.value, f.value === 'all' ? byOwner.length : byOwner.filter((t) => t.status === f.value).length,
    ]))
  }, [tasks, owner])

  if (error) return <div className="partnerErrorState">{error}</div>
  if (!tasks) return null

  const visible = tasks
    .filter((t) => t.owner === owner)
    .filter((t) => statusFilter === 'all' || t.status === statusFilter)

  return (
    <div className="partnerAccountsHeader">
      <h1>Internal Tasks</h1>
      <p>Only visible to Elephant Edge -- the partner never sees this page.</p>

      <div className="taskOwnerTabs">
        {ownerTabs.map((t) => (
          <button
            key={t.value}
            type="button"
            className={'taskOwnerTab' + (owner === t.value ? ' taskOwnerTabActive' : '')}
            onClick={() => setOwner(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AddTaskForm owner={owner} onAdd={handleAdd} />

      <div className="taskStatusTabs">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={'taskStatusTab' + (statusFilter === f.value ? ' taskStatusTabActive' : '')}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label} <span className="taskStatusTabCount">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      <div className="taskList">
        {visible.length === 0 && <p className="partnerEmptyFeatures">Nothing here yet.</p>}
        {visible.map((t) => (
          <TaskRow key={t.id} task={t} onStatusChange={handleStatusChange} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  )
}
