import { useEffect, useMemo, useRef, useState } from 'react'
import { useTenant } from '../context/TenantContext'
import { getPartnerTasks, createPartnerTask, updatePartnerTask, deletePartnerTask, formatApiError } from '../v2/api.js'

// Internal-only task tracker (2026-10-16, Majji's request): what Elephant Edge owes this
// partner and what the partner owes us, each with a deadline. Never reachable by the partner's
// own login -- see PartnerTask's own docstring (app/db/models.py) for the real security
// boundary this depends on.
//
// Third pass, same day, explicit redesign instructions:
//  - Only two real stored states (pending/completed) -- "in progress" dropped. "Upcoming" vs
//    "Pending" is a function of deadline vs today, not a state anyone sets by hand, so it's
//    computed here from deadline + status rather than stored on the backend.
//  - One "Mark as done" action per row, not buried in a menu.
//  - One three-dot menu per row: Edit (reopens this same modal, pre-filled, for any field) and
//    Delete -- not a separate status menu and a separate row menu.
//  - Add/Edit both go through the same popup instead of an inline bar.

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// A task's real bucket -- never stored, always derived, so it can never drift from "what date
// is it right now."
function bucketOf(task) {
  if (task.status === 'completed') return 'completed'
  if (task.deadline && task.deadline < todayStr()) return 'pending'
  return 'upcoming' // no deadline, or deadline is today/future
}

const BUCKET_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
]

function DeadlineBadge({ deadline, bucket }) {
  if (!deadline) return null
  const diff = Math.ceil((new Date(`${deadline}T00:00:00`) - new Date(new Date().toDateString())) / 86400000)
  return (
    <span className={'partnerTag' + (bucket === 'pending' ? ' partnerTagWarn' : diff <= 2 && bucket === 'upcoming' ? ' partnerTagPrimary' : '')}>
      {bucket === 'pending' ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Due today' : `Due ${deadline}`}
    </span>
  )
}

function RowMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="taskRowMenu" ref={ref}>
      <button type="button" className="taskRowMenuBtn" onClick={() => setOpen((v) => !v)} aria-label="Task options">
        &#8942;
      </button>
      {open && (
        <div className="taskStatusMenuPopover taskRowMenuPopover">
          <button type="button" className="taskStatusMenuOption" onClick={() => { setOpen(false); onEdit() }}>
            Edit
          </button>
          <button type="button" className="taskStatusMenuOption taskStatusMenuOptionDanger" onClick={() => { setOpen(false); onDelete() }}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, onMarkDone, onEdit, onDelete }) {
  const bucket = bucketOf(task)
  const done = task.status === 'completed'
  return (
    <div className={'taskCard' + (done ? ' taskCardDone' : '')}>
      <div className="taskCardMain">
        <div className={done ? 'taskTitleDone' : 'taskTitle'}>{task.title}</div>
        {task.notes && <div className="taskNote">{task.notes}</div>}
      </div>
      <div className="taskCardMeta">
        <DeadlineBadge deadline={task.deadline} bucket={bucket} />
        <button
          type="button"
          className={'taskMarkDoneBtn' + (done ? ' taskMarkDoneBtnActive' : '')}
          onClick={() => onMarkDone(task, done ? 'pending' : 'completed')}
        >
          {done ? '✓ Completed' : 'Mark as done'}
        </button>
        <RowMenu onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  )
}

function TaskModal({ owner, initial, onSave, onClose }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [deadline, setDeadline] = useState(initial?.deadline || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState(null)
  const isEdit = Boolean(initial)

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setModalError(null)
    try {
      await onSave({ title: title.trim(), owner, deadline, notes })
      onClose()
    } catch (err) {
      setModalError(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="partnerExecDrawerOverlay" onClick={onClose} />
      <div className="taskModal">
        <h3 className="taskModalTitle">{isEdit ? 'Edit task' : 'New task'}</h3>
        <form onSubmit={submit}>
          <label className="taskModalLabel">
            Title
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="taskAddInput"
              placeholder="What needs to happen?"
            />
          </label>
          <label className="taskModalLabel">
            Deadline (optional)
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="taskAddDate"
            />
          </label>
          <label className="taskModalLabel">
            Note (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="taskAddNote"
              rows={3}
              placeholder="Any detail worth keeping..."
            />
          </label>
          {modalError && <div className="taskModalError">{modalError}</div>}
          <div className="taskModalActions">
            <button type="button" className="partnerBtnSecondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="partnerBtnSecondary taskModalSave" disabled={saving || !title.trim()}>
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default function PartnerInternalTasks({ partnerName }) {
  const { user } = useTenant()
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState(null)
  const [owner, setOwner] = useState('us')
  const [bucketFilter, setBucketFilter] = useState('all')
  const [modal, setModal] = useState(null) // null | 'new' | a task object being edited

  const reload = () => {
    getPartnerTasks().then(setTasks).catch((e) => setError(formatApiError(e)))
  }

  useEffect(reload, [])

  const handleCreate = ({ title, owner: taskOwner, deadline, notes }) =>
    createPartnerTask({ title, owner: taskOwner, deadline, notes, createdBy: user?.email }).then(reload)

  const handleEditSave = (task) => ({ title, deadline, notes }) =>
    updatePartnerTask(task.id, { title, deadline: deadline || '', notes: notes || '' }).then(reload)

  const handleMarkDone = (task, status) =>
    updatePartnerTask(task.id, { status }).then(reload).catch((e) => setError(formatApiError(e)))

  const handleDelete = (task) =>
    deletePartnerTask(task.id).then(reload).catch((e) => setError(formatApiError(e)))

  const ownerTabs = [
    { value: 'us', label: 'Fractional Partner' },
    { value: 'partner', label: partnerName || 'Partner' },
  ]

  const counts = useMemo(() => {
    const byOwner = (tasks || []).filter((t) => t.owner === owner)
    return Object.fromEntries(BUCKET_FILTERS.map((f) => [
      f.value, f.value === 'all' ? byOwner.length : byOwner.filter((t) => bucketOf(t) === f.value).length,
    ]))
  }, [tasks, owner])

  if (error) return <div className="partnerErrorState">{error}</div>
  if (!tasks) return null

  const visible = tasks
    .filter((t) => t.owner === owner)
    .filter((t) => bucketFilter === 'all' || bucketOf(t) === bucketFilter)
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'))

  return (
    <div className="partnerAccountsHeader">
      <div className="partnerAccountsHeaderRow">
        <div>
          <h1>Internal Tasks</h1>
          <p>Only visible to Elephant Edge -- the partner never sees this page.</p>
        </div>
        <button type="button" className="partnerBtnSecondary" onClick={() => setModal('new')}>+ New Task</button>
      </div>

      <div className="taskOwnerTabs">
        {ownerTabs.map((t) => (
          <button
            key={t.value}
            type="button"
            className={'taskStatusTab' + (owner === t.value ? ' taskStatusTabActive' : '')}
            onClick={() => setOwner(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="taskStatusTabs">
        {BUCKET_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={'taskStatusTab' + (bucketFilter === f.value ? ' taskStatusTabActive' : '')}
            onClick={() => setBucketFilter(f.value)}
          >
            {f.label} <span className="taskStatusTabCount">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      <div className="taskList">
        {visible.length === 0 && <p className="partnerEmptyFeatures">Nothing here yet.</p>}
        {visible.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            onMarkDone={handleMarkDone}
            onEdit={() => setModal(t)}
            onDelete={() => handleDelete(t)}
          />
        ))}
      </div>

      {modal === 'new' && (
        <TaskModal owner={owner} onSave={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal && modal !== 'new' && (
        <TaskModal owner={modal.owner} initial={modal} onSave={handleEditSave(modal)} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
