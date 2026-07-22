import { useEffect, useRef, useState } from 'react'
import type { Member, Label, Status, Priority } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'
import { initials } from '../lib/dates'
import { X } from './Icons'

interface Props {
  status: Status
  members: Member[]
  labels: Label[]
  onClose: () => void
  onCreate: (input: {
    title: string
    description?: string
    status: Status
    priority: Priority
    due_date?: string | null
    assignee_ids?: string[]
    label_ids?: string[]
  }) => Promise<void>
}

export function NewTaskModal({ status, members, labels, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('normal')
  const [dueDate, setDueDate] = useState('')
  const [assignees, setAssignees] = useState<string[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [invalid, setInvalid] = useState(false)
  const [saving, setSaving] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    if (!title.trim()) {
      setInvalid(true)
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    await onCreate({
      title,
      description,
      status,
      priority,
      due_date: dueDate || null,
      assignee_ids: assignees,
      label_ids: picked,
    })
    setSaving(false)
    onClose()
  }

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="New task">
        <div className="modal-head">
          <h2>New task in {STATUS_LABEL[status]}</h2>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="nt-title">Title</label>
            <input
              id="nt-title"
              ref={titleRef}
              type="text"
              value={title}
              placeholder="What needs to happen?"
              onChange={(e) => {
                setTitle(e.target.value)
                if (invalid) setInvalid(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit()
              }}
            />
          </div>
          {invalid && <div className="form-error">Give the task a title before saving.</div>}

          <div className="field">
            <label htmlFor="nt-desc">Description</label>
            <textarea
              id="nt-desc"
              value={description}
              placeholder="Add context, links, or acceptance criteria."
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Priority</label>
              <div className="segmented">
                {(['low', 'normal', 'high'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    className={priority === p ? 'on' : ''}
                    onClick={() => setPriority(p)}
                    type="button"
                  >
                    {p[0].toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="nt-due">Due date</label>
              <input
                id="nt-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {members.length > 0 && (
            <div className="field">
              <label>Assign to</label>
              <div className="picker-row">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pick ${assignees.includes(m.id) ? 'on' : ''}`}
                    onClick={() => toggle(assignees, setAssignees, m.id)}
                  >
                    <span className="swatch" style={{ background: m.color }}>{initials(m.name)}</span>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {labels.length > 0 && (
            <div className="field">
              <label>Labels</label>
              <div className="picker-row">
                {labels.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`pick label-pick ${picked.includes(l.id) ? 'on' : ''}`}
                    onClick={() => toggle(picked, setPicked, l.id)}
                  >
                    <span className="dot" style={{ background: l.color }} />
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </div>
    </>
  )
}
