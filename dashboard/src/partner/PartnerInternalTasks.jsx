import { useEffect, useMemo, useRef, useState } from 'react'
import { useTenant } from '../context/TenantContext'
import { getPartnerTasks, createPartnerTask, updatePartnerTask, deletePartnerTask, formatApiError } from '../v2/api.js'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function bucketOf(task) {
  if (task.status === 'completed') return 'completed'
  if (task.deadline && task.deadline < todayStr()) return 'pending'
  return 'upcoming'
}

function formatDeadlineDisplay(deadline) {
  if (!deadline) return null
  const parts = deadline.split('-')
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const m = parseInt(parts[1], 10) - 1
    const d = parseInt(parts[2], 10)
    return `${months[m]} ${d}, ${parts[0]}`
  }
  return deadline
}

function DeadlineBadge({ deadline, bucket }) {
  if (!deadline) return <span className="taskTableNoDeadline">No deadline</span>
  const diff = Math.ceil((new Date(`${deadline}T00:00:00`) - new Date(new Date().toDateString())) / 86400000)
  const isOverdue = bucket === 'pending'
  const isDueToday = diff === 0
  const isUrgent = diff > 0 && diff <= 2

  let badgeClass = 'taskDeadlineBadge'
  let label = formatDeadlineDisplay(deadline)

  if (isOverdue) {
    badgeClass += ' taskDeadlineBadge--overdue'
    label = `${Math.abs(diff)}d overdue (${label})`
  } else if (isDueToday) {
    badgeClass += ' taskDeadlineBadge--today'
    label = `Due today (${label})`
  } else if (isUrgent) {
    badgeClass += ' taskDeadlineBadge--urgent'
    label = `In ${diff}d (${label})`
  }

  return (
    <span className={badgeClass}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      {label}
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
    <div className="taskRowMenu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="taskRowMenuBtn" onClick={() => setOpen((v) => !v)} aria-label="Task options">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2"/>
          <circle cx="12" cy="12" r="2"/>
          <circle cx="12" cy="19" r="2"/>
        </svg>
      </button>
      {open && (
        <div className="taskRowMenuPopover">
          <button type="button" className="taskStatusMenuOption" onClick={() => { setOpen(false); onEdit() }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Details
          </button>
          <button type="button" className="taskStatusMenuOption taskStatusMenuOptionDanger" onClick={() => { setOpen(false); onDelete() }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function TaskCardItem({ task, partnerName, onSelect, onMarkDone, onEdit, onDelete }) {
  const bucket = bucketOf(task)
  const done = task.status === 'completed'
  const isUs = task.owner === 'us'
  const hasNotes = Boolean(task.notes && task.notes.trim())

  return (
    <div
      className={'taskWorkspaceCard' + (done ? ' taskWorkspaceCardDone' : '')}
      onClick={() => onSelect(task)}
    >
      <div className="taskWorkspaceCardHeader">
        <button
          type="button"
          className={'taskCheckbox' + (done ? ' taskCheckboxChecked' : '')}
          onClick={(e) => { e.stopPropagation(); onMarkDone(task, done ? 'pending' : 'completed') }}
          title={done ? 'Mark uncompleted' : 'Mark completed'}
        >
          {done ? '✓' : ''}
        </button>
        <div className="taskWorkspaceCardTitleArea">
          <span className={done ? 'taskTitleDone' : 'taskTitle'}>{task.title}</span>
          {hasNotes && (
            <span className="taskHasNotesIndicator" title="Has instructions / context notes">
              📝 Instructions & Notes attached
            </span>
          )}
        </div>
        <RowMenu onEdit={onEdit} onDelete={onDelete} />
      </div>

      <div className="taskWorkspaceCardFooter">
        <div className="taskWorkspaceCardMeta">
          <span className={'taskOwnerTag' + (isUs ? ' taskOwnerTagUs' : ' taskOwnerTagPartner')}>
            {isUs ? '🏢 Fractional Partner' : `👤 ${partnerName || 'Partner'}`}
          </span>
          <DeadlineBadge deadline={task.deadline} bucket={bucket} />
        </div>
        <button
          type="button"
          className={'taskInlineDoneBtn' + (done ? ' taskInlineDoneBtnActive' : '')}
          onClick={(e) => { e.stopPropagation(); onMarkDone(task, done ? 'pending' : 'completed') }}
        >
          {done ? '✓ Done' : 'Mark Done'}
        </button>
      </div>
    </div>
  )
}

// Side Drawer Detail View for Task Instructions, Context, and Notes
function TaskDetailDrawer({ task, partnerName, onUpdate, onDelete, onClose }) {
  const [notes, setNotes] = useState(task?.notes || '')
  const [deadline, setDeadline] = useState(task?.deadline || '')
  const [owner, setOwner] = useState(task?.owner || 'us')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setNotes(task?.notes || '')
    setDeadline(task?.deadline || '')
    setOwner(task?.owner || 'us')
    setSaved(false)
  }, [task])

  if (!task) return null

  const done = task.status === 'completed'
  const bucket = bucketOf(task)

  const handleSaveNotes = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await onUpdate(task.id, { notes, deadline, owner })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(formatApiError(e))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async () => {
    try {
      await onUpdate(task.id, { status: done ? 'pending' : 'completed' })
    } catch (e) {
      setError(formatApiError(e))
    }
  }

  return (
    <>
      <div className="partnerExecDrawerOverlay" onClick={onClose} />
      <div className="taskDetailDrawer">
        {/* Drawer Header */}
        <div className="taskDetailDrawerHead">
          <div className="taskDetailDrawerBadgeRow">
            <span className={'taskOwnerTag' + (owner === 'us' ? ' taskOwnerTagUs' : ' taskOwnerTagPartner')}>
              {owner === 'us' ? '🏢 Fractional Partner Deliverable' : `👤 ${partnerName || 'Partner'} Action Item`}
            </span>
            <span className={'taskStatusBadge' + (done ? ' taskStatusBadgeDone' : '')}>
              {done ? '✓ Completed' : 'In Progress'}
            </span>
          </div>
          <button type="button" className="taskModalCloseBtn" onClick={onClose} aria-label="Close drawer">✕</button>
        </div>

        {/* Drawer Content */}
        <div className="taskDetailDrawerBody">
          <div className="taskDetailDrawerTitleSection">
            <h2 className={done ? 'taskDetailTitleDone' : 'taskDetailTitle'}>{task.title}</h2>
          </div>

          {/* Quick Properties Card */}
          <div className="taskDetailPropsCard">
            <div className="taskDetailPropRow">
              <span className="taskDetailPropLabel">Assigned To</span>
              <div className="taskDetailPropValue">
                <select
                  value={owner}
                  onChange={(e) => { setOwner(e.target.value); setSaved(false) }}
                  className="taskDetailSelect"
                >
                  <option value="us">🏢 Fractional Partner (Us)</option>
                  <option value="partner">👤 {partnerName || 'Partner'} (Sandy)</option>
                </select>
              </div>
            </div>

            <div className="taskDetailPropRow">
              <span className="taskDetailPropLabel">Target Deadline</span>
              <div className="taskDetailPropValue">
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => { setDeadline(e.target.value); setSaved(false) }}
                  className="taskDetailDateInput"
                />
              </div>
            </div>

            <div className="taskDetailPropRow">
              <span className="taskDetailPropLabel">Schedule Status</span>
              <div className="taskDetailPropValue">
                <DeadlineBadge deadline={deadline} bucket={bucket} />
              </div>
            </div>
          </div>

          {/* Instructions, Context & Notes Section */}
          <div className="taskDetailSection">
            <div className="taskDetailSectionHeader">
              <span className="taskDetailSectionTitle">📝 Instructions, Context & Notes</span>
              <span className="taskDetailSectionHint">Visible to your team</span>
            </div>
            <textarea
              className="taskDetailNotesTextarea"
              rows={8}
              placeholder="Add comprehensive instructions, links to sheets, context, or status updates here..."
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
            />
          </div>

          {error && <div className="partnerFormError" style={{ margin: '8px 0' }}>{error}</div>}
        </div>

        {/* Drawer Footer Actions */}
        <div className="taskDetailDrawerFooter">
          <div className="taskDetailDrawerFooterLeft">
            <button
              type="button"
              className={'taskInlineDoneBtn' + (done ? ' taskInlineDoneBtnActive' : '')}
              onClick={handleToggleStatus}
            >
              {done ? 'Reopen Task' : '✓ Mark as Completed'}
            </button>
            <button
              type="button"
              className="taskDetailDeleteBtn"
              onClick={() => { if (confirm('Delete this task?')) { onDelete(task); onClose() } }}
            >
              Delete
            </button>
          </div>

          <div className="taskDetailDrawerFooterRight">
            {saved && <span className="partnerSavedNote">✓ Saved</span>}
            <button
              type="button"
              className="partnerPrimaryBtn"
              onClick={handleSaveNotes}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function TaskModal({ owner, initial, partnerName, onSave, onClose }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [taskOwner, setTaskOwner] = useState(initial?.owner || owner || 'us')
  const [deadline, setDeadline] = useState(initial?.deadline || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [notifySlack, setNotifySlack] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState(null)
  const isEdit = Boolean(initial)

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setModalError(null)
    try {
      await onSave({ title: title.trim(), owner: taskOwner, deadline, notes, notifySlack })
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
      <div className="taskModalNew">
        <div className="taskModalNewHead">
          <div>
            <h3 className="taskModalNewTitle">{isEdit ? 'Edit Workflow Task' : 'Create Workflow Task'}</h3>
            <p className="taskModalNewSubtitle">Keep deliverables, deadlines, and ownership crystal clear.</p>
          </div>
          <button type="button" className="taskModalCloseBtn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="taskModalNewBody">
          {/* Owner Assignment Selector */}
          <div className="taskModalField">
            <label className="taskModalLabel">Who is responsible for this task?</label>
            <div className="taskModalOwnerSelector">
              <button
                type="button"
                className={'taskModalOwnerOption' + (taskOwner === 'us' ? ' taskModalOwnerOptionActive' : '')}
                onClick={() => setTaskOwner('us')}
              >
                <span className="taskModalOwnerIcon">🏢</span>
                <div className="taskModalOwnerInfo">
                  <strong>Fractional Partner</strong>
                  <span>Tasks we are delivering</span>
                </div>
              </button>
              <button
                type="button"
                className={'taskModalOwnerOption' + (taskOwner === 'partner' ? ' taskModalOwnerOptionActive' : '')}
                onClick={() => setTaskOwner('partner')}
              >
                <span className="taskModalOwnerIcon">👤</span>
                <div className="taskModalOwnerInfo">
                  <strong>{partnerName || 'Partner'}</strong>
                  <span>Tasks partner needs to do</span>
                </div>
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="taskModalField">
            <label className="taskModalLabel">Task Title *</label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="taskAddInput"
              placeholder="e.g. Deliver 2nd degree connection target list"
              required
            />
          </div>

          {/* Deadline */}
          <div className="taskModalField">
            <label className="taskModalLabel">Target Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="taskAddDate"
            />
          </div>

          {/* Notes */}
          <div className="taskModalField">
            <label className="taskModalLabel">Instructions or Context</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="taskAddNote"
              rows={3}
              placeholder="Add key criteria, file locations, instructions, or details..."
            />
          </div>

          {/* Slack Notification Checkbox */}
          <div className="taskModalSlackField">
            <label className="taskModalCheckboxRow">
              <input
                type="checkbox"
                checked={notifySlack}
                onChange={(e) => setNotifySlack(e.target.checked)}
              />
              <div className="taskModalSlackInfo">
                <span className="taskModalSlackTitle">Send Slack notification to {partnerName || 'partner'}</span>
                <span className="taskModalSlackDesc">Alerts {partnerName || 'partner'} on Slack with task details and deadline.</span>
              </div>
            </label>
          </div>

          {modalError && <div className="taskModalError">{modalError}</div>}

          <div className="taskModalActionsNew">
            <button type="button" className="partnerSecondaryBtn" onClick={onClose}>Cancel</button>
            <button type="submit" className="partnerPrimaryBtn" disabled={saving || !title.trim()}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : '+ Add Task'}
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
  const [viewMode, setViewMode] = useState('board') // 'board' | 'list'
  const [ownerFilter, setOwnerFilter] = useState('all') // 'all' | 'us' | 'partner'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'upcoming' | 'pending' | 'completed'
  const [modal, setModal] = useState(null) // null | 'new' | task object
  const [selectedTask, setSelectedTask] = useState(null) // Task opened in Detail Drawer

  const reload = () => {
    return getPartnerTasks().then((res) => {
      setTasks(res)
      if (selectedTask) {
        const updated = res.find(t => t.id === selectedTask.id)
        if (updated) setSelectedTask(updated)
      }
      return res
    }).catch((e) => setError(formatApiError(e)))
  }

  useEffect(() => { reload() }, [])

  const handleCreate = ({ title, owner: taskOwner, deadline, notes }) =>
    createPartnerTask({ title, owner: taskOwner, deadline, notes, createdBy: user?.email }).then(reload)

  const handleEditSave = (task) => ({ title, owner: taskOwner, deadline, notes }) =>
    updatePartnerTask(task.id, { title, owner: taskOwner, deadline: deadline || '', notes: notes || '' }).then(reload)

  const handleUpdate = (taskId, updates) =>
    updatePartnerTask(taskId, updates).then(reload)

  const handleMarkDone = (task, status) =>
    updatePartnerTask(task.id, { status }).then(reload).catch((e) => setError(formatApiError(e)))

  const handleDelete = (task) =>
    deletePartnerTask(task.id).then(reload).catch((e) => setError(formatApiError(e)))

  // Stats
  const allTasks = tasks || []
  const ourTasks = allTasks.filter(t => t.owner === 'us')
  const partnerTasks = allTasks.filter(t => t.owner === 'partner')
  const overdueCount = allTasks.filter(t => bucketOf(t) === 'pending').length
  const completedCount = allTasks.filter(t => t.status === 'completed').length
  const activeCount = allTasks.filter(t => t.status !== 'completed').length

  const filteredTasks = allTasks.filter(t => {
    if (ownerFilter !== 'all' && t.owner !== ownerFilter) return false
    if (statusFilter !== 'all' && bucketOf(t) !== statusFilter) return false
    return true
  }).sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1
    if (a.status !== 'completed' && b.status === 'completed') return -1
    return (a.deadline || '9999').localeCompare(b.deadline || '9999')
  })

  if (error) return <div className="partnerErrorState">{error}</div>
  if (!tasks) return null

  return (
    <div className="partnerTasksPage">
      {/* Top Header */}
      <div className="partnerTasksHeader">
        <div className="partnerTasksHeaderInfo">
          <div className="partnerTasksBadgeRow">
            <span className="partnerTasksInternalBadge">🔒 Internal Monitor</span>
            <span className="partnerTasksPartnerBadge">Partner: {partnerName || 'Sandy Yu'}</span>
          </div>
          <h1>Workflow & Deliverables</h1>
          <p>Click on any task to view instructions, context, and manage ongoing notes.</p>
        </div>
        <button
          type="button"
          className="partnerPrimaryBtn partnerTasksNewBtn"
          onClick={() => setModal('new')}
        >
          <span style={{ fontSize: 16 }}>+</span> New Task
        </button>
      </div>

      {/* Metric Cards Summary */}
      <div className="partnerTasksSummaryGrid">
        <div className="partnerTasksMetricCard">
          <span className="partnerTasksMetricLabel">Total Deliverables</span>
          <div className="partnerTasksMetricVal">{allTasks.length}</div>
          <span className="partnerTasksMetricSub">{activeCount} active · {completedCount} completed</span>
        </div>

        <div className="partnerTasksMetricCard">
          <span className="partnerTasksMetricLabel">Our Deliverables (Elephant Edge)</span>
          <div className="partnerTasksMetricVal">{ourTasks.length}</div>
          <span className="partnerTasksMetricSub">{ourTasks.filter(t => t.status !== 'completed').length} pending delivery</span>
        </div>

        <div className="partnerTasksMetricCard">
          <span className="partnerTasksMetricLabel">{partnerName || 'Partner'} Action Items</span>
          <div className="partnerTasksMetricVal">{partnerTasks.length}</div>
          <span className="partnerTasksMetricSub">{partnerTasks.filter(t => t.status !== 'completed').length} awaiting partner</span>
        </div>

        <div className={'partnerTasksMetricCard' + (overdueCount > 0 ? ' partnerTasksMetricCardWarn' : '')}>
          <span className="partnerTasksMetricLabel">Overdue / Attention</span>
          <div className="partnerTasksMetricVal">{overdueCount}</div>
          <span className="partnerTasksMetricSub">{overdueCount > 0 ? 'Requires follow-up' : 'All deadlines on track'}</span>
        </div>
      </div>

      {/* Control Bar: Ownership Filters & Status Tabs */}
      <div className="partnerTasksControlsBar">
        <div className="partnerTasksFilterPills">
          <span className="partnerTasksFilterLabel">Assigned:</span>
          <button
            type="button"
            className={'partnerTasksFilterPill' + (ownerFilter === 'all' ? ' active' : '')}
            onClick={() => setOwnerFilter('all')}
          >
            All Ownership ({allTasks.length})
          </button>
          <button
            type="button"
            className={'partnerTasksFilterPill' + (ownerFilter === 'us' ? ' active' : '')}
            onClick={() => setOwnerFilter('us')}
          >
            🏢 Fractional Partner ({ourTasks.length})
          </button>
          <button
            type="button"
            className={'partnerTasksFilterPill' + (ownerFilter === 'partner' ? ' active' : '')}
            onClick={() => setOwnerFilter('partner')}
          >
            👤 {partnerName || 'Partner'} ({partnerTasks.length})
          </button>
        </div>

        <div className="partnerTasksViewSwitcher">
          <button
            type="button"
            className={'partnerTasksViewBtn' + (viewMode === 'board' ? ' active' : '')}
            onClick={() => setViewMode('board')}
            title="Two-column board view"
          >
            Columns
          </button>
          <button
            type="button"
            className={'partnerTasksViewBtn' + (viewMode === 'list' ? ' active' : '')}
            onClick={() => setViewMode('list')}
            title="Compact table list view"
          >
            List
          </button>
        </div>
      </div>

      {/* Board View: Side-by-side Ownership Columns */}
      {viewMode === 'board' ? (
        <div className="partnerTasksBoardGrid">
          {/* Column 1: Elephant Edge / Fractional Partner */}
          <div className="partnerTasksColumn">
            <div className="partnerTasksColumnHeader partnerTasksColumnHeaderUs">
              <div className="partnerTasksColumnTitle">
                <span className="partnerTasksColIcon">🏢</span>
                <div>
                  <strong>Fractional Partner Tasks</strong>
                  <span>What we are doing for {partnerName || 'the partner'}</span>
                </div>
              </div>
              <span className="partnerTasksColCount">
                {ourTasks.filter(t => t.status !== 'completed').length} active
              </span>
            </div>

            <div className="partnerTasksColumnBody">
              {ourTasks.length === 0 ? (
                <div className="partnerTasksEmptyColumn">
                  <p>No deliverables assigned to Fractional Partner yet.</p>
                  <button type="button" className="partnerSecondaryBtn" onClick={() => setModal('new')}>+ Add task</button>
                </div>
              ) : (
                ourTasks.map(t => (
                  <TaskCardItem
                    key={t.id}
                    task={t}
                    partnerName={partnerName}
                    onSelect={setSelectedTask}
                    onMarkDone={handleMarkDone}
                    onEdit={() => setModal(t)}
                    onDelete={() => handleDelete(t)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 2: Partner Action Items */}
          <div className="partnerTasksColumn">
            <div className="partnerTasksColumnHeader partnerTasksColumnHeaderPartner">
              <div className="partnerTasksColumnTitle">
                <span className="partnerTasksColIcon">👤</span>
                <div>
                  <strong>{partnerName || 'Partner'} Tasks</strong>
                  <span>What {partnerName || 'Sandy'} is supposed to do</span>
                </div>
              </div>
              <span className="partnerTasksColCount">
                {partnerTasks.filter(t => t.status !== 'completed').length} active
              </span>
            </div>

            <div className="partnerTasksColumnBody">
              {partnerTasks.length === 0 ? (
                <div className="partnerTasksEmptyColumn">
                  <p>No tasks assigned to {partnerName || 'the partner'} yet.</p>
                  <button type="button" className="partnerSecondaryBtn" onClick={() => setModal('new')}>+ Add task</button>
                </div>
              ) : (
                partnerTasks.map(t => (
                  <TaskCardItem
                    key={t.id}
                    task={t}
                    partnerName={partnerName}
                    onSelect={setSelectedTask}
                    onMarkDone={handleMarkDone}
                    onEdit={() => setModal(t)}
                    onDelete={() => handleDelete(t)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="partnerTasksListTable">
          <div className="partnerTasksTableHeader">
            <span style={{ flex: 1 }}>Task & Deliverable</span>
            <span style={{ width: 170 }}>Assigned To</span>
            <span style={{ width: 160 }}>Deadline</span>
            <span style={{ width: 130 }}>Status</span>
            <span style={{ width: 40 }}></span>
          </div>
          <div className="partnerTasksTableBody">
            {filteredTasks.length === 0 ? (
              <div className="partnerTasksEmptyColumn">
                <p>No tasks match the selected filters.</p>
              </div>
            ) : (
              filteredTasks.map(t => {
                const done = t.status === 'completed'
                const bucket = bucketOf(t)
                const isUs = t.owner === 'us'
                return (
                  <div
                    key={t.id}
                    className={'partnerTasksTableRow' + (done ? ' partnerTasksTableRowDone' : '')}
                    onClick={() => setSelectedTask(t)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="partnerTasksTableColMain">
                      <button
                        type="button"
                        className={'taskCheckbox' + (done ? ' taskCheckboxChecked' : '')}
                        onClick={(e) => { e.stopPropagation(); handleMarkDone(t, done ? 'pending' : 'completed') }}
                      >
                        {done ? '✓' : ''}
                      </button>
                      <div>
                        <span className={done ? 'taskTitleDone' : 'taskTitle'}>{t.title}</span>
                        {t.notes && <span className="taskHasNotesIndicator" style={{ display: 'block', marginTop: 2 }}>📝 Has notes</span>}
                      </div>
                    </div>
                    <div style={{ width: 170 }}>
                      <span className={'taskOwnerTag' + (isUs ? ' taskOwnerTagUs' : ' taskOwnerTagPartner')}>
                        {isUs ? '🏢 Fractional Partner' : `👤 ${partnerName || 'Partner'}`}
                      </span>
                    </div>
                    <div style={{ width: 160 }}>
                      <DeadlineBadge deadline={t.deadline} bucket={bucket} />
                    </div>
                    <div style={{ width: 130 }}>
                      <button
                        type="button"
                        className={'taskInlineDoneBtn' + (done ? ' taskInlineDoneBtnActive' : '')}
                        onClick={(e) => { e.stopPropagation(); handleMarkDone(t, done ? 'pending' : 'completed') }}
                      >
                        {done ? '✓ Completed' : 'Mark Done'}
                      </button>
                    </div>
                    <div style={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>
                      <RowMenu onEdit={() => setModal(t)} onDelete={() => handleDelete(t)} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Task Detail & Notes Drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          partnerName={partnerName}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Modal Popup for Create / Edit Title & Base Properties */}
      {modal === 'new' && (
        <TaskModal
          owner="us"
          partnerName={partnerName}
          onSave={handleCreate}
          onClose={() => setModal(null)}
        />
      )}
      {modal && modal !== 'new' && (
        <TaskModal
          owner={modal.owner}
          initial={modal}
          partnerName={partnerName}
          onSave={handleEditSave(modal)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
