import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Member, Label } from '../lib/types'
import { urgencyOf, dueLabel, initials } from '../lib/dates'
import { Clock, Alert, Chat, Text } from './Icons'

interface Props {
  task: Task
  members: Member[]
  labels: Label[]
  commentCount: number
  onOpen: (id: string) => void
  overlay?: boolean
}

export function TaskCard({ task, members, labels, commentCount, onOpen, overlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: 'task', status: task.status } })

  const urgency = urgencyOf(task.due_date)
  const assignees = task.assignee_ids
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => Boolean(m))
  const tags = task.label_ids
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is Label => Boolean(l))

  const body = (
    <>
      {task.priority !== 'normal' && (
        <span
          className={`prio-dot ${task.priority}`}
          title={`${task.priority === 'high' ? 'High' : 'Low'} priority`}
        />
      )}
      {tags.length > 0 && (
        <div className="card-labels">
          {tags.map((l) => (
            <span
              key={l.id}
              className="tag"
              style={{ background: `${l.color}26`, color: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      <div className="card-title">{task.title}</div>

      <div className="card-foot">
        {task.due_date && (
          <span className={`due ${urgency === 'overdue' ? 'overdue' : urgency === 'soon' ? 'soon' : ''}`}>
            {urgency === 'overdue' ? <Alert /> : <Clock />}
            {dueLabel(task.due_date)}
          </span>
        )}

        <div className="card-meta">
          {task.description && (
            <span className="meta-item" title="Has a description">
              <Text />
            </span>
          )}
          {commentCount > 0 && (
            <span className="meta-item" title={`${commentCount} comment${commentCount === 1 ? '' : 's'}`}>
              <Chat />
              {commentCount}
            </span>
          )}
          {assignees.length > 0 && (
            <div className="avatars">
              {assignees.slice(0, 3).map((m) => (
                <span
                  key={m.id}
                  className="avatar"
                  style={{ background: m.color }}
                  title={m.name}
                >
                  {initials(m.name)}
                </span>
              ))}
              {assignees.length > 3 && (
                <span className="avatar" style={{ background: '#8a8fa3' }}>
                  +{assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )

  if (overlay) {
    return <div className="card overlay">{body}</div>
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`card ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onOpen(task.id)
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${task.title}`}
    >
      {body}
    </div>
  )
}
