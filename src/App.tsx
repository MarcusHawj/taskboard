import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, TouchSensor,
  useSensor, useSensors, closestCorners, pointerWithin,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, CollisionDetection } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

import { useBoard } from './hooks/useBoard'
import { supabase, isConfigured } from './lib/supabase'
import { COLUMNS } from './lib/types'
import type { Status, Priority, Task } from './lib/types'
import { urgencyOf } from './lib/dates'

import { Column } from './components/Column'
import { TaskCard } from './components/TaskCard'
import { NewTaskModal } from './components/NewTaskModal'
import { TaskPanel } from './components/TaskPanel'
import { ManageModal } from './components/ManageModal'
import { Plus, Search, Users, Tag, X } from './components/Icons'

export default function App() {
  const board = useBoard()
  const {
    userId, tasks, members, labels, loading, error, toast,
    setError, retry, createTask, moveTask, updateTask, deleteTask,
    toggleAssignee, toggleLabel, addMember, removeMember, addLabel, removeLabel,
  } = board

  const [query, setQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [labelFilter, setLabelFilter] = useState<string[]>([])

  const [dragId, setDragId] = useState<string | null>(null)
  const [newTaskFor, setNewTaskFor] = useState<Status | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [manage, setManage] = useState<'team' | 'labels' | null>(null)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ---------- comment counts for card badges ----------
  useEffect(() => {
    if (!userId || !tasks.length) return
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('comments').select('task_id')
      if (!alive || !data) return
      const counts: Record<string, number> = {}
      for (const row of data as { task_id: string }[]) {
        counts[row.task_id] = (counts[row.task_id] ?? 0) + 1
      }
      setCommentCounts(counts)
    })()
    return () => { alive = false }
  }, [userId, tasks.length])

  const bumpCount = useCallback((taskId: string, count: number) => {
    setCommentCounts((prev) => ({ ...prev, [taskId]: count }))
  }, [])

  // ---------- filtering ----------
  const filtersOn =
    query.trim() !== '' || priorityFilter !== 'all' || assigneeFilter !== 'all' || labelFilter.length > 0

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? '').toLowerCase().includes(q))
        return false
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'none' ? t.assignee_ids.length > 0 : !t.assignee_ids.includes(assigneeFilter))
          return false
      }
      if (labelFilter.length && !labelFilter.every((id) => t.label_ids.includes(id))) return false
      return true
    })
  }, [tasks, query, priorityFilter, assigneeFilter, labelFilter])

  const byColumn = useMemo(() => {
    const map: Record<Status, Task[]> = { todo: [], in_progress: [], in_review: [], done: [] }
    for (const t of visible) map[t.status].push(t)
    for (const key of Object.keys(map) as Status[]) map[key].sort((a, b) => a.position - b.position)
    return map
  }, [visible])

  // ---------- stats ----------
  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.status === 'done').length
    const overdue = tasks.filter((t) => t.status !== 'done' && urgencyOf(t.due_date) === 'overdue').length
    return { total, done, overdue, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [tasks])

  // ---------- drag ----------
  const collision: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args)
    return pointer.length ? pointer : closestCorners(args)
  }, [])

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id))

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null)
    const { active, over } = e
    if (!over) return

    const activeId = String(active.id)
    const task = tasks.find((t) => t.id === activeId)
    if (!task) return

    const overData = over.data.current as { type?: string; status?: Status } | undefined
    const overId = String(over.id)

    let toStatus: Status
    let toIndex: number

    if (overData?.type === 'column') {
      toStatus = overData.status!
      toIndex = byColumn[toStatus].filter((t) => t.id !== activeId).length
    } else {
      const overTask = tasks.find((t) => t.id === overId)
      if (!overTask) return
      toStatus = overTask.status
      const list = byColumn[toStatus].filter((t) => t.id !== activeId)
      toIndex = list.findIndex((t) => t.id === overId)
      if (toIndex === -1) toIndex = list.length
    }

    if (task.status === toStatus) {
      const current = byColumn[toStatus].findIndex((t) => t.id === activeId)
      if (current === toIndex) return
    }
    void moveTask(activeId, toStatus, toIndex)
  }

  const dragging = dragId ? tasks.find((t) => t.id === dragId) ?? null : null
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null

  const clearFilters = () => {
    setQuery('')
    setPriorityFilter('all')
    setAssigneeFilter('all')
    setLabelFilter([])
  }

  // ---------- config guard ----------
  if (!isConfigured) {
    return (
      <div className="center-state">
        <div className="center-state-inner">
          <h2>Connect Supabase to continue</h2>
          <p>
            Copy <code>.env.example</code> to <code>.env</code>, then add your project URL and
            anon key. Restart the dev server and the board will load.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="mark" />
          <h1>Task Board</h1>
          <span className="guest-chip">
            guest · {userId ? userId.slice(0, 8) : '········'}
          </span>
        </div>

        <div className="topbar-spacer" />

        <div className="stats">
          <div className="stat">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Tasks</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.done} · {stats.pct}%</span>
            <span className="stat-label">Done</span>
          </div>
          <div className="stat">
            <span className={`stat-value ${stats.overdue ? 'warn' : ''}`}>{stats.overdue}</span>
            <span className="stat-label">Overdue</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={() => setManage('team')}>
            <Users /> Team
          </button>
          <button className="btn btn-ghost" onClick={() => setManage('labels')}>
            <Tag /> Labels
          </button>
          <button className="btn btn-primary" onClick={() => setNewTaskFor('todo')}>
            <Plus /> New task
          </button>
        </div>
      </header>

      <div className="controls">
        <div className="search">
          <Search />
          <input
            type="search"
            value={query}
            placeholder="Search tasks"
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tasks"
          />
        </div>

        <select
          className="filter-select"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}
          aria-label="Filter by priority"
        >
          <option value="all">Any priority</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>

        <select
          className="filter-select"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          aria-label="Filter by assignee"
        >
          <option value="all">Anyone</option>
          <option value="none">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {labels.length > 0 && (
          <div className="chip-row">
            {labels.map((l) => {
              const on = labelFilter.includes(l.id)
              return (
                <button
                  key={l.id}
                  className={`chip ${on ? 'active' : ''}`}
                  style={on ? { background: l.color } : undefined}
                  onClick={() =>
                    setLabelFilter((prev) =>
                      prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id],
                    )
                  }
                >
                  {!on && <span className="dot" style={{ background: l.color }} />}
                  {l.name}
                </button>
              )
            })}
          </div>
        )}

        {filtersOn && (
          <button className="clear-filters" onClick={clearFilters}>Clear filters</button>
        )}
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
          <button onClick={retry}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="board">
          {COLUMNS.map((c) => (
            <section className="column" key={c.id}>
              <div className="column-head">
                <div className="column-head-row">
                  <span className="col-dot" style={{ background: c.hue }} />
                  <span className="column-title">{c.label}</span>
                </div>
              </div>
              <div className="column-body">
                <div className="skeleton" />
                <div className="skeleton" style={{ height: 76 }} />
                <div className="skeleton" style={{ height: 54 }} />
              </div>
            </section>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragId(null)}
        >
          <div className="board">
            {COLUMNS.map((c) => (
              <Column
                key={c.id}
                id={c.id}
                label={c.label}
                hue={c.hue}
                tasks={byColumn[c.id]}
                members={members}
                labels={labels}
                commentCounts={commentCounts}
                filtered={filtersOn}
                onOpen={setOpenTaskId}
                onAdd={setNewTaskFor}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
            {dragging && (
              <TaskCard
                task={dragging}
                members={members}
                labels={labels}
                commentCount={commentCounts[dragging.id] ?? 0}
                onOpen={() => {}}
                overlay
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {newTaskFor && (
        <NewTaskModal
          status={newTaskFor}
          members={members}
          labels={labels}
          onClose={() => setNewTaskFor(null)}
          onCreate={createTask}
        />
      )}

      {openTask && userId && (
        <TaskPanel
          task={openTask}
          members={members}
          labels={labels}
          userId={userId}
          onClose={() => setOpenTaskId(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onToggleAssignee={toggleAssignee}
          onToggleLabel={toggleLabel}
          onCommentCountChange={bumpCount}
        />
      )}

      {manage && (
        <ManageModal
          mode={manage}
          members={members}
          labels={labels}
          onClose={() => setManage(null)}
          onAddMember={addMember}
          onRemoveMember={removeMember}
          onAddLabel={addLabel}
          onRemoveLabel={removeLabel}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
