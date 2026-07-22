import { differenceInCalendarDays, format, formatDistanceToNow, parseISO } from 'date-fns'

export type Urgency = 'none' | 'later' | 'soon' | 'overdue'

/** Days until due, using calendar days so "tomorrow" is always 1. */
export function urgencyOf(dueDate: string | null): Urgency {
  if (!dueDate) return 'none'
  const days = differenceInCalendarDays(parseISO(dueDate), new Date())
  if (days < 0) return 'overdue'
  if (days <= 2) return 'soon'
  return 'later'
}

export function dueLabel(dueDate: string): string {
  const d = parseISO(dueDate)
  const days = differenceInCalendarDays(d, new Date())
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return '1d late'
  if (days < 0) return `${Math.abs(days)}d late`
  if (days <= 6) return `${days}d`
  return format(d, 'MMM d')
}

export const relative = (iso: string) =>
  formatDistanceToNow(parseISO(iso), { addSuffix: true })

export const fullDate = (iso: string) => format(parseISO(iso), 'MMM d, yyyy')

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
