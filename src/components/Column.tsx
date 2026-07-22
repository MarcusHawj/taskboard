import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, Member, Label, Status } from '../lib/types'
import { TaskCard } from './TaskCard'
import { Plus } from './Icons'

interface Props {
  id: Status
  label: string
  hue: string
  tasks: Task[]
  members: Member[]
  labels: Label[]
  commentCounts: Record<string, number>
  filtered: boolean
  onOpen: (id: string) => void
  onAdd: (status: Status) => void
}

const EMPTY: Record<Status, string> = {
  todo: 'Nothing queued up. Add the first task to get started.',
  in_progress: 'Nothing in flight. Drag a task here when work begins.',
  in_review: 'Nothing waiting on review right now.',
  done: 'No finished work yet. Completed tasks land here.',
}

export function Column({
  id, label, hue, tasks, members, labels, commentCounts,
  filtered, onOpen, onAdd,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'column', status: id } })

  return (
    <section
      className={`column ${isOver ? 'over' : ''} ${id === 'done' ? 'column-done' : ''}`}
      aria-label={label}
    >
      <div className="column-head">
        <div className="column-head-row">
          <span className="col-dot" style={{ background: hue }} />
          <span className="column-title">{label}</span>
          <span className="column-count" style={{ marginLeft: 'auto' }}>{tasks.length}</span>
        </div>
      </div>

      <div className="column-body" ref={setNodeRef}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              members={members}
              labels={labels}
              commentCount={commentCounts[t.id] ?? 0}
              onOpen={onOpen}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="col-empty">
            {filtered ? 'No tasks match your filters.' : EMPTY[id]}
          </div>
        )}
      </div>

      <div className="column-foot">
        <button className="add-inline" onClick={() => onAdd(id)}>
          <Plus size={12} /> Add task
        </button>
      </div>
    </section>
  )
}
