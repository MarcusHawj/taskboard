import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, ensureGuestSession } from '../lib/supabase'
import type {
  Task, Member, Label, Status, Priority, ActivityKind,
} from '../lib/types'
import { STATUS_LABEL, PRIORITY_LABEL } from '../lib/types'

const GAP = 1000

interface TaskRow {
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
  task_assignees: { member_id: string }[] | null
  task_labels: { label_id: string }[] | null
}

const shape = (row: TaskRow): Task => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  due_date: row.due_date,
  position: row.position,
  created_at: row.created_at,
  updated_at: row.updated_at,
  assignee_ids: (row.task_assignees ?? []).map((a) => a.member_id),
  label_ids: (row.task_labels ?? []).map((l) => l.label_id),
})

export function useBoard() {
  const [userId, setUserId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const toastTimer = useRef<number | undefined>(undefined)

  const say = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  /** Append an activity row. Failures here never block the user's action. */
  const log = useCallback(
    async (taskId: string, kind: ActivityKind, detail: Record<string, unknown> = {}) => {
      if (!userId) return
      await supabase.from('activity').insert({ task_id: taskId, user_id: userId, kind, detail })
    },
    [userId],
  )

  const load = useCallback(async (uid: string) => {
    const [t, m, l] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, task_assignees(member_id), task_labels(label_id)')
        .order('position', { ascending: true }),
      supabase.from('members').select('*').order('created_at', { ascending: true }),
      supabase.from('labels').select('*').order('created_at', { ascending: true }),
    ])
    if (t.error) throw t.error
    if (m.error) throw m.error
    if (l.error) throw l.error
    setTasks(((t.data ?? []) as TaskRow[]).map(shape))
    setMembers((m.data ?? []) as Member[])
    setLabels((l.data ?? []) as Label[])
    void uid
  }, [])

  // ---------- boot: guest session, then first load ----------
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const uid = await ensureGuestSession()
        if (!alive) return
        setUserId(uid)
        await load(uid)
        if (!alive) return
        setError(null)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Could not load your board.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [load])

  const retry = useCallback(async () => {
    try {
      setLoading(true)
      const uid = userId ?? (await ensureGuestSession())
      setUserId(uid)
      await load(uid)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your board.')
    } finally {
      setLoading(false)
    }
  }, [userId, load])

  // ---------- tasks ----------
  const createTask = useCallback(
    async (input: {
      title: string
      description?: string
      status: Status
      priority: Priority
      due_date?: string | null
      assignee_ids?: string[]
      label_ids?: string[]
    }) => {
      if (!userId) return
      const inColumn = tasks.filter((t) => t.status === input.status)
      const position = inColumn.length
        ? Math.max(...inColumn.map((t) => t.position)) + GAP
        : GAP

      const { data, error: err } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          status: input.status,
          priority: input.priority,
          due_date: input.due_date || null,
          position,
        })
        .select()
        .single()

      if (err) {
        setError(err.message)
        return
      }

      const row = data as TaskRow
      const assignees = input.assignee_ids ?? []
      const labelIds = input.label_ids ?? []

      if (assignees.length) {
        await supabase.from('task_assignees').insert(
          assignees.map((member_id) => ({ task_id: row.id, member_id, user_id: userId })),
        )
      }
      if (labelIds.length) {
        await supabase.from('task_labels').insert(
          labelIds.map((label_id) => ({ task_id: row.id, label_id, user_id: userId })),
        )
      }

      setTasks((prev) => [
        ...prev,
        { ...shape({ ...row, task_assignees: null, task_labels: null }), assignee_ids: assignees, label_ids: labelIds },
      ])
      say('Task created')
    },
    [userId, tasks, say],
  )

  /** Optimistic: state updates first, the write follows, and we roll back on failure. */
  const moveTask = useCallback(
    async (taskId: string, toStatus: Status, toIndex: number) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return

      const fromStatus = task.status
      const target = tasks
        .filter((t) => t.status === toStatus && t.id !== taskId)
        .sort((a, b) => a.position - b.position)

      const before = target[toIndex - 1]?.position
      const after = target[toIndex]?.position
      let position: number
      if (before === undefined && after === undefined) position = GAP
      else if (before === undefined) position = after! - GAP
      else if (after === undefined) position = before + GAP
      else position = (before + after) / 2

      const snapshot = tasks
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: toStatus, position } : t)),
      )

      const { error: err } = await supabase
        .from('tasks')
        .update({ status: toStatus, position })
        .eq('id', taskId)

      if (err) {
        setTasks(snapshot)
        setError('That move did not save. Your board has been restored.')
        return
      }

      if (fromStatus !== toStatus) {
        void log(taskId, 'status', { from: STATUS_LABEL[fromStatus], to: STATUS_LABEL[toStatus] })
      }
    },
    [tasks, log],
  )

  const updateTask = useCallback(
    async (taskId: string, patch: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'due_date' | 'status'>>) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return

      const snapshot = tasks
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))

      const { error: err } = await supabase.from('tasks').update(patch).eq('id', taskId)
      if (err) {
        setTasks(snapshot)
        setError(err.message)
        return
      }

      if (patch.title !== undefined && patch.title !== task.title) {
        void log(taskId, 'renamed', { from: task.title, to: patch.title })
      }
      if (patch.priority !== undefined && patch.priority !== task.priority) {
        void log(taskId, 'priority', {
          from: PRIORITY_LABEL[task.priority],
          to: PRIORITY_LABEL[patch.priority],
        })
      }
      if (patch.due_date !== undefined && patch.due_date !== task.due_date) {
        void log(taskId, 'due_date', { to: patch.due_date })
      }
      if (patch.status !== undefined && patch.status !== task.status) {
        void log(taskId, 'status', {
          from: STATUS_LABEL[task.status],
          to: STATUS_LABEL[patch.status],
        })
      }
    },
    [tasks, log],
  )

  const deleteTask = useCallback(
    async (taskId: string) => {
      const snapshot = tasks
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      const { error: err } = await supabase.from('tasks').delete().eq('id', taskId)
      if (err) {
        setTasks(snapshot)
        setError(err.message)
        return
      }
      say('Task deleted')
    },
    [tasks, say],
  )

  // ---------- assignees ----------
  const toggleAssignee = useCallback(
    async (taskId: string, memberId: string) => {
      if (!userId) return
      const task = tasks.find((t) => t.id === taskId)
      const member = members.find((m) => m.id === memberId)
      if (!task || !member) return

      const on = task.assignee_ids.includes(memberId)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                assignee_ids: on
                  ? t.assignee_ids.filter((id) => id !== memberId)
                  : [...t.assignee_ids, memberId],
              }
            : t,
        ),
      )

      if (on) {
        await supabase.from('task_assignees').delete().eq('task_id', taskId).eq('member_id', memberId)
        void log(taskId, 'unassigned', { name: member.name })
      } else {
        await supabase.from('task_assignees').insert({ task_id: taskId, member_id: memberId, user_id: userId })
        void log(taskId, 'assigned', { name: member.name })
      }
    },
    [userId, tasks, members, log],
  )

  // ---------- labels on a task ----------
  const toggleLabel = useCallback(
    async (taskId: string, labelId: string) => {
      if (!userId) return
      const task = tasks.find((t) => t.id === taskId)
      const label = labels.find((l) => l.id === labelId)
      if (!task || !label) return

      const on = task.label_ids.includes(labelId)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                label_ids: on
                  ? t.label_ids.filter((id) => id !== labelId)
                  : [...t.label_ids, labelId],
              }
            : t,
        ),
      )

      if (on) {
        await supabase.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId)
        void log(taskId, 'unlabeled', { name: label.name })
      } else {
        await supabase.from('task_labels').insert({ task_id: taskId, label_id: labelId, user_id: userId })
        void log(taskId, 'labeled', { name: label.name })
      }
    },
    [userId, tasks, labels, log],
  )

  // ---------- members ----------
  const addMember = useCallback(
    async (name: string, color: string) => {
      if (!userId) return
      const { data, error: err } = await supabase
        .from('members')
        .insert({ user_id: userId, name: name.trim(), color })
        .select()
        .single()
      if (err) {
        setError(err.message)
        return
      }
      setMembers((prev) => [...prev, data as Member])
      say(`${name.trim()} added to the team`)
    },
    [userId, say],
  )

  const removeMember = useCallback(
    async (memberId: string) => {
      const snapshot = members
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      setTasks((prev) =>
        prev.map((t) => ({ ...t, assignee_ids: t.assignee_ids.filter((id) => id !== memberId) })),
      )
      const { error: err } = await supabase.from('members').delete().eq('id', memberId)
      if (err) {
        setMembers(snapshot)
        setError(err.message)
      }
    },
    [members],
  )

  // ---------- labels ----------
  const addLabel = useCallback(
    async (name: string, color: string) => {
      if (!userId) return
      const { data, error: err } = await supabase
        .from('labels')
        .insert({ user_id: userId, name: name.trim(), color })
        .select()
        .single()
      if (err) {
        setError(
          err.code === '23505' ? 'A label with that name already exists.' : err.message,
        )
        return
      }
      setLabels((prev) => [...prev, data as Label])
      say(`Label "${name.trim()}" created`)
    },
    [userId, say],
  )

  const removeLabel = useCallback(
    async (labelId: string) => {
      const snapshot = labels
      setLabels((prev) => prev.filter((l) => l.id !== labelId))
      setTasks((prev) =>
        prev.map((t) => ({ ...t, label_ids: t.label_ids.filter((id) => id !== labelId) })),
      )
      const { error: err } = await supabase.from('labels').delete().eq('id', labelId)
      if (err) {
        setLabels(snapshot)
        setError(err.message)
      }
    },
    [labels],
  )

  return {
    userId, tasks, members, labels, loading, error, toast,
    setError, retry,
    createTask, moveTask, updateTask, deleteTask,
    toggleAssignee, toggleLabel,
    addMember, removeMember, addLabel, removeLabel,
  }
}
