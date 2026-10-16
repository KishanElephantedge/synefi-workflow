import { useEffect, useState } from 'react'
import { useTenant } from '../context/TenantContext'
import { getPartnerTasks, createPartnerTask, updatePartnerTask, deletePartnerTask, formatApiError } from '../v2/api.js'

// Internal-only task tracker (2026-10-16, Majji's request): what Elephant Edge owes this
// partner and what the partner owes us, each with a deadline. Never reachable by the partner's
// own login -- the backend 404s any request missing the gateway's x-internal-user header, so
// this page only ever renders real data when viewed through /v2/partner-view as an internal
// admin. Kept deliberately plain (two columns, one add form, a checkbox to close a task) per
// the explicit ask for a "super simple and clean" UI, not a generic project-management tool.

const OWNERS = [
  { value: 'us', label: 'Us (Elephant Edge)' },
  { value: 'partner', label: 'Them' },
]

function daysUntil(deadline) {
  if (!deadline) return null
  const diff = Math.ceil((new Date(`${deadline}T00:00:00`) - new Date(new Date().toDateString())) / 86400000)
  return diff
}

function DeadlineBadge({ deadline, status }) {
  if (!deadline) return null
  const diff = daysUntil(deadline)
  const overdue = status !== 'done' && diff < 0
  const dueSoon = status !== 'done' && diff >= 0 && diff <= 2
  return (
    <span className={'partnerTag' + (overdue ? ' partnerTagWarn' : dueSoon ? ' partnerTagPrimary' : '')}>
      {overdue ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Due today' : `Due ${deadline}`}
    </span>
  )
}

function TaskRow({ task, onToggle, onDelete }) {
  return (
    <div className="taskRow">
      <label className="taskRowCheck">
        <input type="checkbox" checked={task.status === 'done'} onChange={() => onToggle(task)} />
        <span className={task.status === 'done' ? 'taskTitleDone' : ''}>{task.title}</span>
      </label>
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
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onAdd({ title: title.trim(), owner, deadline })
      setTitle('')
      setDeadline('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="taskAddForm" onSubmit={submit}>
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
      <button type="submit" className="partnerBtnSecondary" disabled={saving || !title.trim()}>Add</button>
    </form>
  )
}

function TaskColumn({ title, owner, tasks, onAdd, onToggle, onDelete }) {
  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')
  return (
    <div className="taskColumn">
      <h2 className="taskColumnTitle">{title}</h2>
      <AddTaskForm owner={owner} onAdd={onAdd} />
      {open.length === 0 && done.length === 0 && <p className="partnerEmptyFeatures">Nothing here yet.</p>}
      {open.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />)}
      {done.length > 0 && (
        <>
          <div className="taskDoneDivider">Done</div>
          {done.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />)}
        </>
      )}
    </div>
  )
}

export default function PartnerInternalTasks() {
  const { user } = useTenant()
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState(null)

  const reload = () => {
    getPartnerTasks().then(setTasks).catch((e) => setError(formatApiError(e)))
  }

  useEffect(reload, [])

  const handleAdd = ({ title, owner, deadline }) =>
    createPartnerTask({ title, owner, deadline, createdBy: user?.email })
      .then(reload)
      .catch((e) => setError(formatApiError(e)))

  const handleToggle = (task) =>
    updatePartnerTask(task.id, { status: task.status === 'done' ? 'open' : 'done' })
      .then(reload)
      .catch((e) => setError(formatApiError(e)))

  const handleDelete = (task) =>
    deletePartnerTask(task.id)
      .then(reload)
      .catch((e) => setError(formatApiError(e)))

  if (error) return <div className="partnerErrorState">{error}</div>
  if (!tasks) return null

  const ours = tasks.filter((t) => t.owner === 'us')
  const theirs = tasks.filter((t) => t.owner === 'partner')

  return (
    <div className="partnerAccountsHeader">
      <h1>Internal Tasks</h1>
      <p>Only visible to Elephant Edge -- the partner never sees this page.</p>
      <div className="taskColumns">
        <TaskColumn title="Our tasks" owner="us" tasks={ours} onAdd={handleAdd} onToggle={handleToggle} onDelete={handleDelete} />
        <TaskColumn title="Their tasks" owner="partner" tasks={theirs} onAdd={handleAdd} onToggle={handleToggle} onDelete={handleDelete} />
      </div>
    </div>
  )
}
