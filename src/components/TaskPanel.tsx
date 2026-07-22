import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Task, Member, Label, Comment, Activity, Priority, Status,
} from '../lib/types'
import { COLUMNS } from '../lib/types'
import { initials, relative, fullDate } from '../lib/dates'
import { X, Trash } from './Icons'

interface Props {
  task: Task
  members: Member[]
  labels: Label[]
  userId: string
  onClose: () => void
  onUpdate: (id: string, patch: Partial<Task>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onToggleAssignee: (taskId: string, memberId: string) => Promise<void>
  onToggleLabel: (taskId: string, labelId: string) => Promise<void>
  onCommentCountChange: (taskId: string, count: number) => void
}

function describe(a: Activity, taskTitle: string): string {
  const d = a.detail as Record<string, string>
  switch (a.kind) {
    case 'created': return `Created "${d.title ?? taskTitle}"`
    case 'status': return `Moved from ${d.from} → ${d.to}`
    case 'renamed': return `Renamed to "${d.to}"`
    case 'priority': return `Priority changed from ${d.from} to ${d.to}`
    case 'due_date': return d.to ? `Due date set to ${fullDate(d.to)}` : 'Due date cleared'
    case 'assigned': return `Assigned ${d.name}`
    case 'unassigned': return `Unassigned ${d.name}`
    case 'labeled': return `Added label ${d.name}`
    case 'unlabeled': return `Removed label ${d.name}`
    default: return 'Updated'
  }
}

export function TaskPanel({
  task, members, labels, userId, onClose, onUpdate, onDelete,
  onToggleAssignee, onToggleLabel, onCommentCountChange,
}: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [editingDesc, setEditingDesc] = useState(false)
  const [desc, setDesc] = useState(task.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(task.title)
    setDesc(task.description ?? '')
  }, [task.id, task.title, task.description])

  const fetchThread = useCallback(async () => {
    setLoading(true)
    const [c, a] = await Promise.all([
      supabase.from('comments').select('*').eq('task_id', task.id).order('created_at', { ascending: true }),
      supabase.from('activity').select('*').eq('task_id', task.id).order('created_at', { ascending: false }),
    ])
    if (c.error || a.error) {
      setLoadError('Could not load the activity for this task.')
    } else {
      setLoadError(null)
      setComments((c.data ?? []) as Comment[])
      setActivity((a.data ?? []) as Activity[])
      onCommentCountChange(task.id, (c.data ?? []).length)
    }
    setLoading(false)
  }, [task.id, onCommentCountChange])

  useEffect(() => { void fetchThread() }, [fetchThread])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmDelete) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, confirmDelete])

  const postComment = async () => {
    if (!draft.trim()) return
    setPosting(true)
    const { data, error } = await supabase
      .from('comments')
      .insert({ task_id: task.id, user_id: userId, body: draft.trim() })
      .select()
      .single()
    setPosting(false)
    if (error) {
      setLoadError('Your comment did not save. Try again.')
      return
    }
    const next = [...comments, data as Comment]
    setComments(next)
    onCommentCountChange(task.id, next.length)
    setDraft('')
  }

  const saveTitle = () => {
    const t = title.trim()
    if (!t || t === task.title) {
      setTitle(task.title)
      return
    }
    void onUpdate(task.id, { title: t }).then(fetchThread)
  }

  const saveDesc = () => {
    setEditingDesc(false)
    const d = desc.trim()
    if (d === (task.description ?? '')) return
    void onUpdate(task.id, { description: d || null })
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="panel" role="dialog" aria-modal="true" aria-label="Task detail">
        <div className="panel-head">
          <h2>Task</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button
              className="icon-btn"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete task"
              title="Delete task"
            >
              <Trash />
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><X /></button>
          </div>
        </div>

        <div className="panel-body">
          <input
            className="detail-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') { setTitle(task.title); e.currentTarget.blur() }
            }}
            aria-label="Task title"
          />
          <div className="detail-sub">Created {relative(task.created_at)}</div>

          {loadError && (
            <div className="form-error" style={{ marginBottom: 14 }}>{loadError}</div>
          )}

          {/* status + priority + due */}
          <div className="section">
            <div className="field-row">
              <div className="field">
                <label>Status</label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={task.status}
                  onChange={(e) => {
                    void onUpdate(task.id, { status: e.target.value as Status }).then(fetchThread)
                  }}
                >
                  {COLUMNS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="tp-due">Due date</label>
                <input
                  id="tp-due"
                  type="date"
                  value={task.due_date ?? ''}
                  onChange={(e) => {
                    void onUpdate(task.id, { due_date: e.target.value || null }).then(fetchThread)
                  }}
                />
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>Priority</label>
              <div className="segmented">
                {(['low', 'normal', 'high'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    className={task.priority === p ? 'on' : ''}
                    onClick={() => { void onUpdate(task.id, { priority: p }).then(fetchThread) }}
                  >
                    {p[0].toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* description */}
          <div className="section">
            <div className="section-label">Description<span className="rule" /></div>
            {editingDesc ? (
              <textarea
                autoFocus
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onBlur={saveDesc}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setDesc(task.description ?? ''); setEditingDesc(false) }
                }}
                style={{
                  width: '100%', background: 'var(--rail)', border: '1px solid var(--amber)',
                  borderRadius: 6, padding: '10px 12px', color: 'var(--on-dark)',
                  minHeight: 84, lineHeight: 1.65, resize: 'vertical',
                }}
              />
            ) : (
              <div
                className={`desc-box ${task.description ? '' : 'placeholder'}`}
                onClick={() => setEditingDesc(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') setEditingDesc(true) }}
              >
                {task.description || 'Click to add a description.'}
              </div>
            )}
          </div>

          {/* assignees */}
          <div className="section">
            <div className="section-label">Assignees<span className="rule" /></div>
            {members.length === 0 ? (
              <p className="hint">Add team members from the Team button to assign this task.</p>
            ) : (
              <div className="picker-row">
                {members.map((m) => (
                  <button
                    key={m.id}
                    className={`pick ${task.assignee_ids.includes(m.id) ? 'on' : ''}`}
                    onClick={() => { void onToggleAssignee(task.id, m.id).then(fetchThread) }}
                  >
                    <span className="swatch" style={{ background: m.color }}>{initials(m.name)}</span>
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* labels */}
          <div className="section">
            <div className="section-label">Labels<span className="rule" /></div>
            {labels.length === 0 ? (
              <p className="hint">Create labels from the Labels button to tag this task.</p>
            ) : (
              <div className="picker-row">
                {labels.map((l) => (
                  <button
                    key={l.id}
                    className={`pick label-pick ${task.label_ids.includes(l.id) ? 'on' : ''}`}
                    onClick={() => { void onToggleLabel(task.id, l.id).then(fetchThread) }}
                  >
                    <span className="dot" style={{ background: l.color }} />
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* comments */}
          <div className="section">
            <div className="section-label">
              Comments {comments.length > 0 && `(${comments.length})`}<span className="rule" />
            </div>
            {loading ? (
              <div className="skeleton" style={{ height: 46 }} />
            ) : comments.length === 0 ? (
              <p className="hint">No comments yet. Start the thread below.</p>
            ) : (
              <div>
                {comments.map((c) => (
                  <div className="comment" key={c.id}>
                    <span className="avatar on-dark" style={{ background: 'var(--slate)' }}>You</span>
                    <div className="comment-body">
                      {c.body}
                      <div className="comment-time">{relative(c.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="comment-form">
              <textarea
                value={draft}
                placeholder="Write a comment…"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void postComment()
                }}
              />
              <button
                className="btn btn-primary"
                style={{ alignSelf: 'flex-start' }}
                onClick={postComment}
                disabled={!draft.trim() || posting}
              >
                {posting ? 'Posting…' : 'Post comment'}
              </button>
            </div>
          </div>

          {/* activity */}
          <div className="section">
            <div className="section-label">Activity<span className="rule" /></div>
            {loading ? (
              <div className="skeleton" style={{ height: 46 }} />
            ) : activity.length === 0 ? (
              <p className="hint">No activity recorded yet.</p>
            ) : (
              <div className="timeline">
                {activity.map((a, i) => (
                  <div className={`event ${i === 0 ? 'accent' : ''}`} key={a.id}>
                    <div className="event-text">
                      <strong>{describe(a, task.title)}</strong>
                    </div>
                    <div className="event-time">{relative(a.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {confirmDelete && (
        <>
          <div className="scrim" style={{ zIndex: 60 }} onClick={() => setConfirmDelete(false)} />
          <div className="modal" style={{ zIndex: 70, width: 'min(400px, calc(100vw - 32px))' }} role="dialog" aria-modal="true">
            <div className="modal-head"><h2>Delete this task?</h2></div>
            <div className="modal-body">
              <p style={{ margin: 0, color: 'var(--on-dark-2)', lineHeight: 1.65 }}>
                "{task.title}" and its comments and history will be removed. This cannot be undone.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Keep task</button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--red)', color: '#fff' }}
                onClick={() => { void onDelete(task.id); onClose() }}
              >
                Delete task
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
