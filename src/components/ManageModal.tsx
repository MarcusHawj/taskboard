import { useEffect, useState } from 'react'
import type { Member, Label } from '../lib/types'
import { MEMBER_COLORS, LABEL_COLORS } from '../lib/types'
import { initials } from '../lib/dates'
import { X, Trash } from './Icons'

type Mode = 'team' | 'labels'

interface Props {
  mode: Mode
  members: Member[]
  labels: Label[]
  onClose: () => void
  onAddMember: (name: string, color: string) => Promise<void>
  onRemoveMember: (id: string) => Promise<void>
  onAddLabel: (name: string, color: string) => Promise<void>
  onRemoveLabel: (id: string) => Promise<void>
}

export function ManageModal({
  mode, members, labels, onClose,
  onAddMember, onRemoveMember, onAddLabel, onRemoveLabel,
}: Props) {
  const palette = mode === 'team' ? MEMBER_COLORS : LABEL_COLORS
  const [name, setName] = useState('')
  const [color, setColor] = useState(palette[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const add = async () => {
    if (!name.trim()) return
    setSaving(true)
    if (mode === 'team') await onAddMember(name, color)
    else await onAddLabel(name, color)
    setSaving(false)
    setName('')
    setColor(palette[(palette.indexOf(color) + 1) % palette.length])
  }

  const isTeam = mode === 'team'

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={isTeam ? 'Team' : 'Labels'}>
        <div className="modal-head">
          <h2>{isTeam ? 'Team' : 'Labels'}</h2>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>

        <div className="modal-body">
          {isTeam ? (
            members.length === 0 ? (
              <p className="hint">
                No team members yet. Add someone below, then assign them to tasks from any card.
              </p>
            ) : (
              members.map((m) => (
                <div className="team-row" key={m.id}>
                  <span className="avatar lg on-dark" style={{ background: m.color }}>
                    {initials(m.name)}
                  </span>
                  <span className="team-row-name">{m.name}</span>
                  <button
                    className="icon-btn"
                    onClick={() => onRemoveMember(m.id)}
                    aria-label={`Remove ${m.name}`}
                  >
                    <Trash />
                  </button>
                </div>
              ))
            )
          ) : labels.length === 0 ? (
            <p className="hint">
              No labels yet. Create one below, then tag tasks and filter the board by label.
            </p>
          ) : (
            labels.map((l) => (
              <div className="team-row" key={l.id}>
                <span className="tag" style={{ background: `${l.color}26`, color: l.color }}>
                  {l.name}
                </span>
                <span style={{ flex: 1 }} />
                <button
                  className="icon-btn"
                  onClick={() => onRemoveLabel(l.id)}
                  aria-label={`Delete ${l.name}`}
                >
                  <Trash />
                </button>
              </div>
            ))
          )}

          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--edge)' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="mm-name">{isTeam ? 'Add a member' : 'Create a label'}</label>
              <div className="inline-form" style={{ marginTop: 0 }}>
                <input
                  id="mm-name"
                  type="text"
                  value={name}
                  placeholder={isTeam ? 'Name' : 'e.g. Bug, Feature, Design'}
                  maxLength={isTeam ? 60 : 30}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
                />
                <button className="btn btn-primary" onClick={add} disabled={!name.trim() || saving}>
                  Add
                </button>
              </div>
              <div className="color-picks">
                {palette.map((c) => (
                  <button
                    key={c}
                    className={`color-pick ${color === c ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Use color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  )
}
