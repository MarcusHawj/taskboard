export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'
export type Priority = 'low' | 'normal' | 'high'

export interface Member {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface Label {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  description: string | null
  status: Status
  priority: Priority
  due_date: string | null
  position: number
  created_at: string
  updated_at: string
  assignee_ids: string[]
  label_ids: string[]
}

export interface Comment {
  id: string
  task_id: string
  user_id: string
  body: string
  created_at: string
}

export type ActivityKind =
  | 'created'
  | 'status'
  | 'renamed'
  | 'priority'
  | 'due_date'
  | 'assigned'
  | 'unassigned'
  | 'labeled'
  | 'unlabeled'

export interface Activity {
  id: string
  task_id: string
  user_id: string
  kind: ActivityKind
  detail: Record<string, unknown>
  created_at: string
}

export const COLUMNS: { id: Status; label: string; hue: string }[] = [
  { id: 'todo', label: 'To Do', hue: '#8F9199' },
  { id: 'in_progress', label: 'In Progress', hue: '#3B74B8' },
  { id: 'in_review', label: 'In Review', hue: '#B07D24' },
  { id: 'done', label: 'Done', hue: '#3F7D5C' },
]

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
}

export const MEMBER_COLORS = [
  '#4C5760', '#3B74B8', '#3F7D5C', '#B34A44',
  '#71589E', '#2E7F82', '#A8653C', '#8F9199',
]

export const LABEL_COLORS = [
  '#B34A44', '#3B74B8', '#3F7D5C', '#B07D24',
  '#71589E', '#2E7F82', '#A8653C', '#8F9199',
]
