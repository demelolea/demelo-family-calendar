'use client'

import { useState, useRef } from 'react'
import { PhoebeSchedule, PERSON_LABELS } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { notifyFamily } from '@/lib/notify'

interface PhoebeTabProps {
  phoebeSchedule: PhoebeSchedule[]
  currentUser: string
  onRefresh: () => void
}

const FAMILY_MEMBERS = ['Jim', 'Isabelle', 'Elissa', 'Ines', 'Lea']

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export default function PhoebeTab({ phoebeSchedule, currentUser, onRefresh }: PhoebeTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [withWhom, setWithWhom] = useState('Jim')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const [editingEntry, setEditingEntry]       = useState<PhoebeSchedule | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const today = new Date().toISOString().slice(0, 10)

  const sorted   = [...phoebeSchedule].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const upcoming = sorted.filter(p => p.end_date >= today)
  const past     = sorted.filter(p => p.end_date < today).reverse()

  const current = upcoming.find(p => p.start_date <= today && p.end_date >= today)
  const next    = upcoming.filter(p => p.start_date > today)

  const openEdit = (entry: PhoebeSchedule) => {
    setEditingEntry(entry)
    setWithWhom(entry.with_whom)
    setStartDate(entry.start_date)
    setEndDate(entry.end_date)
    setNotes(entry.notes ?? '')
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const resetForm = () => {
    setEditingEntry(null)
    setWithWhom('Jim')
    setStartDate('')
    setEndDate('')
    setNotes('')
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!withWhom || !startDate || !endDate) return
    setLoading(true)

    const payload = {
      with_whom:  withWhom,
      start_date: startDate,
      end_date:   endDate,
      notes:      notes.trim() || null,
    }

    if (editingEntry) {
      await supabase.from('phoebe_schedule').update(payload).eq('id', editingEntry.id)
    } else {
      await supabase.from('phoebe_schedule').insert(payload)
    }

    setLoading(false)

    const actor = PERSON_LABELS[currentUser] ?? currentUser
    if (editingEntry) {
      notifyFamily(currentUser, 'Phoebe updated 🐾', `${actor} updated Phoebe's stay with ${withWhom}`)
    } else {
      notifyFamily(currentUser, 'Phoebe update 🐾', `${actor} logged Phoebe with ${withWhom}: ${new Date(startDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(endDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`)
    }
    resetForm()
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('phoebe_schedule').delete().eq('id', id)
    setConfirmingDelete(null)
    onRefresh()
  }

  const ScheduleRow = ({ s, dim }: { s: PhoebeSchedule; dim?: boolean }) => {
    const isEditing    = editingEntry?.id === s.id
    const isConfirming = confirmingDelete === s.id

    return (
      <div
        className={[
          'bg-white border border-stone-100 rounded-xl p-3.5 shadow-sm transition-all',
          isEditing ? 'ring-2 ring-stone-400' : '',
          dim ? 'opacity-60' : '',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-800">{s.with_whom}</p>
            <p className="text-xs text-stone-400 mt-0.5">
              {formatDate(s.start_date)} – {formatDate(s.end_date)}
            </p>
            {s.notes && <p className="text-xs text-stone-400 italic mt-0.5">{s.notes}</p>}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-amber-300 text-lg mr-1">🐾</span>
            {!isConfirming && (
              <button
                onClick={() => isEditing ? resetForm() : openEdit(s)}
                className="text-[11px] text-stone-400 hover:text-stone-600 border border-stone-200 rounded-lg px-2 py-0.5 transition-colors"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            )}
            {!isEditing && (
              isConfirming ? (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-stone-500">Delete?</span>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-[11px] text-red-600 border border-red-200 rounded-lg px-2 py-0.5 hover:bg-red-50 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(null)}
                    className="text-[11px] text-stone-500 border border-stone-200 rounded-lg px-2 py-0.5 hover:bg-stone-50 transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(s.id)}
                  className="text-[11px] text-stone-300 hover:text-red-500 border border-stone-200 rounded-lg px-2 py-0.5 transition-colors"
                >
                  Delete
                </button>
              )
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-800">Phoebe 🐾</h2>
          <p className="text-sm text-stone-400 mt-0.5">The family sausage dog</p>
        </div>
        <button
          onClick={() => { if (showForm && !editingEntry) { setShowForm(false) } else { resetForm(); setShowForm(true) } }}
          className="px-3 py-1.5 bg-stone-800 text-white text-sm rounded-xl hover:bg-stone-700 active:bg-stone-900 transition-colors font-medium"
        >
          + Log stay
        </button>
      </div>

      {/* Current custody hero */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">🐾</div>
        {current ? (
          <>
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">Currently with</p>
            <p className="text-2xl font-semibold text-stone-800">{current.with_whom}</p>
            <p className="text-sm text-stone-500 mt-1">Until {formatDate(current.end_date)}</p>
            {current.notes && (
              <p className="text-xs text-stone-400 mt-2 italic">{current.notes}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-stone-400 italic">No current stay logged</p>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div ref={formRef} className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">
            {editingEntry ? 'Edit stay' : 'Log a stay'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-stone-400 mb-1">Phoebe is with</label>
              <select
                value={withWhom}
                onChange={e => setWithWhom(e.target.value)}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
              >
                {FAMILY_MEMBERS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-stone-400 mb-1">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Until</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
                />
              </div>
            </div>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving…' : editingEntry ? 'Save changes' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upcoming stays */}
      {next.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Upcoming</p>
          {next.map(s => <ScheduleRow key={s.id} s={s} />)}
        </div>
      )}

      {/* Past stays */}
      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Past</p>
          {past.slice(0, 6).map(s => <ScheduleRow key={s.id} s={s} dim />)}
        </div>
      )}
    </div>
  )
}
