'use client'

import { useState, useMemo } from 'react'
import {
  RoomAllocation, Stay, Guest,
  AIX_ROOMS, PERSON_COLORS, PERSON_LABELS, hexToRgba,
} from '@/lib/types'
import { supabase } from '@/lib/supabase'

interface AixHouseProps {
  roomAllocations: RoomAllocation[]
  stays: Stay[]
  guests: Guest[]
  onRefresh: () => void
}

const MONTHS = [
  { label: 'May',    days: 31, month: 4 },
  { label: 'June',   days: 30, month: 5 },
  { label: 'July',   days: 31, month: 6 },
  { label: 'August', days: 31, month: 7 },
]

const DAY_W   = 34
const NAME_W  = 140
const STRIP_H = 17   // height per person strip in a shared cell
const MIN_ROW = 38   // minimum row height when room is empty

const FAMILY_MEMBER_NAMES = ['Jim', 'Isabelle', 'Elissa', 'Ines', 'Lea']

function generateDays(): Date[] {
  const out: Date[] = []
  for (const m of MONTHS) for (let d = 1; d <= m.days; d++) out.push(new Date(2026, m.month, d))
  return out
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtShort(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function AixHouse({ roomAllocations, stays, guests, onRefresh }: AixHouseProps) {
  const todayStr = toDateStr(new Date())
  const days     = useMemo(generateDays, [])

  // ── Occupant map ─────────────────────────────────────────────────────────────
  // roomId → dateStr → [{name, color}]
  type OccEntry = { name: string; color: string }
  const occupantMap = useMemo(() => {
    const map: Record<string, Record<string, OccEntry[]>> = {}
    for (const r of AIX_ROOMS) map[r.id] = {}

    // Room allocations (manual / family assigned from unallocated section)
    for (const a of roomAllocations) {
      if (!map[a.room]) continue
      for (const day of days) {
        const ds = toDateStr(day)
        if (a.start_date > ds || a.end_date < ds) continue
        if (!map[a.room][ds]) map[a.room][ds] = []
        const col = PERSON_COLORS[a.occupant_name.toLowerCase()] ?? '#8A8A8A'
        map[a.room][ds].push({ name: a.occupant_name, color: col })
      }
    }

    // Guests whose allocated_room is set
    for (const g of guests) {
      if (g.house !== 'aix' || !g.allocated_room) continue
      const roomId = g.allocated_room
      if (!map[roomId]) continue
      for (const day of days) {
        const ds = toDateStr(day)
        if (g.arrival_date > ds || g.departure_date < ds) continue
        if (!map[roomId][ds]) map[roomId][ds] = []
        map[roomId][ds].push({ name: g.guest_name, color: '#8A8A8A' })
      }
    }

    return map
  }, [roomAllocations, guests, days])

  // Per-room row height — expands to fit concurrent occupants
  const rowHeights = useMemo(() => {
    const out: Record<string, number> = {}
    for (const r of AIX_ROOMS) {
      let max = 0
      for (const day of days) {
        const n = (occupantMap[r.id]?.[toDateStr(day)] ?? []).length
        if (n > max) max = n
      }
      out[r.id] = Math.max(MIN_ROW, max * STRIP_H + 8)
    }
    return out
  }, [occupantMap, days])

  // ── Unallocated section ───────────────────────────────────────────────────────
  // Family members with an Aix stay that has no overlapping room allocation
  const unallocatedFamily = useMemo(() =>
    stays
      .filter(s => s.location.toLowerCase().includes('aix') && s.end_date >= todayStr)
      .filter(s => {
        const lbl = (PERSON_LABELS[s.person] ?? s.person).toLowerCase()
        return !roomAllocations.some(a =>
          a.occupant_name.toLowerCase() === lbl &&
          a.start_date <= s.end_date && a.end_date >= s.start_date,
        )
      })
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
  [stays, roomAllocations, todayStr])

  // Aix guests with no room assigned
  const unallocatedGuests = useMemo(() =>
    guests
      .filter(g => g.house === 'aix' && !g.allocated_room && g.departure_date >= todayStr)
      .sort((a, b) => a.arrival_date.localeCompare(b.arrival_date)),
  [guests, todayStr])

  const hasUnallocated = unallocatedFamily.length > 0 || unallocatedGuests.length > 0

  // ── Assign-from-unallocated flow ─────────────────────────────────────────────
  type AssignTarget =
    | { type: 'family'; stay: Stay }
    | { type: 'guest';  guest: Guest }

  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null)
  const [assignRoom,   setAssignRoom]   = useState('')
  const [assignStart,  setAssignStart]  = useState('')
  const [assignEnd,    setAssignEnd]    = useState('')
  const [assigning,    setAssigning]    = useState(false)

  const openAssign = (target: AssignTarget) => {
    setAssignTarget(target)
    setAssignRoom('')
    if (target.type === 'family') {
      setAssignStart(target.stay.start_date)
      setAssignEnd(target.stay.end_date)
    } else {
      setAssignStart(target.guest.arrival_date)
      setAssignEnd(target.guest.departure_date)
    }
  }

  const closeAssign = () => setAssignTarget(null)

  const handleAssign = async () => {
    if (!assignRoom || !assignTarget) return
    setAssigning(true)
    if (assignTarget.type === 'family') {
      await supabase.from('room_allocations').insert({
        room:          assignRoom,
        occupant_name: PERSON_LABELS[assignTarget.stay.person] ?? assignTarget.stay.person,
        start_date:    assignStart,
        end_date:      assignEnd,
      })
    } else {
      await supabase.from('guests')
        .update({ allocated_room: assignRoom })
        .eq('id', assignTarget.guest.id)
    }
    setAssigning(false)
    setAssignTarget(null)
    onRefresh()
  }

  const isTargeted = (t: AssignTarget) => {
    if (!assignTarget) return false
    if (assignTarget.type !== t.type) return false
    if (t.type === 'family' && assignTarget.type === 'family')
      return assignTarget.stay.id === t.stay.id
    if (t.type === 'guest' && assignTarget.type === 'guest')
      return assignTarget.guest.id === t.guest.id
    return false
  }

  // ── Manual add form ───────────────────────────────────────────────────────────
  const [showForm,     setShowForm]     = useState(false)
  const [room,         setRoom]         = useState<string>(AIX_ROOMS[0].id)
  const [occType,      setOccType]      = useState<'family' | 'guest'>('family')
  const [famMember,    setFamMember]    = useState('Jim')
  const [guestName,    setGuestName]    = useState('')
  const [startDate,    setStartDate]    = useState('')
  const [endDate,      setEndDate]      = useState('')
  const [notes,        setNotes]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [deleting,     setDeleting]     = useState<string | null>(null)

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const occupant = occType === 'family' ? famMember : guestName.trim()
    if (!occupant || !startDate || !endDate) return
    setLoading(true)
    await supabase.from('room_allocations').insert({
      room, occupant_name: occupant, start_date: startDate, end_date: endDate,
      notes: notes.trim() || null,
    })
    setLoading(false)
    setShowForm(false)
    setGuestName(''); setNotes(''); setStartDate(''); setEndDate('')
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    await supabase.from('room_allocations').delete().eq('id', id)
    setDeleting(null)
    onRefresh()
  }

  const upcoming = [...roomAllocations]
    .filter(a => a.end_date >= todayStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  const totalWidth = NAME_W + DAY_W * days.length

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-stone-800">🏠 Aix Rooms</h2>
          <p className="text-sm text-stone-400 mt-0.5">Room allocation — May to August 2026</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); closeAssign() }}
          className="px-3 py-1.5 bg-stone-800 text-white text-sm rounded-xl hover:bg-stone-700 active:bg-stone-900 transition-colors font-medium"
        >
          + Assign room
        </button>
      </div>

      {/* ── Unallocated section ── */}
      {hasUnallocated && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
            In Aix — no room assigned yet
          </p>

          <div className="flex flex-wrap gap-2">
            {unallocatedFamily.map(s => {
              const target: AssignTarget = { type: 'family', stay: s }
              const active = isTargeted(target)
              return (
                <button
                  key={s.id}
                  onClick={() => active ? closeAssign() : openAssign(target)}
                  className={[
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border transition-colors',
                    active
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white border-amber-200 text-stone-700 hover:border-stone-400',
                  ].join(' ')}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PERSON_COLORS[s.person] }} />
                  <span className="font-medium">{PERSON_LABELS[s.person]}</span>
                  <span className={active ? 'text-stone-300' : 'text-stone-400'}>
                    {fmtShort(s.start_date)}–{fmtShort(s.end_date)}
                  </span>
                  {!active && <span className="text-amber-600">→ assign</span>}
                </button>
              )
            })}

            {unallocatedGuests.map(g => {
              const target: AssignTarget = { type: 'guest', guest: g }
              const active = isTargeted(target)
              return (
                <button
                  key={g.id}
                  onClick={() => active ? closeAssign() : openAssign(target)}
                  className={[
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border transition-colors',
                    active
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white border-amber-200 text-stone-700 hover:border-stone-400',
                  ].join(' ')}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-stone-400" />
                  <span className="font-medium">{g.guest_name}</span>
                  <span className={active ? 'text-stone-300' : 'text-stone-400'}>
                    {fmtShort(g.arrival_date)}–{fmtShort(g.departure_date)}
                  </span>
                  {!active && <span className="text-amber-600">→ assign</span>}
                </button>
              )
            })}
          </div>

          {/* Inline assign panel */}
          {assignTarget && (
            <div className="pt-3 border-t border-amber-200 space-y-2">
              <p className="text-xs font-medium text-stone-700">
                Assign room for{' '}
                <span className="font-semibold">
                  {assignTarget.type === 'family'
                    ? PERSON_LABELS[assignTarget.stay.person]
                    : assignTarget.guest.guest_name}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={assignRoom}
                  onChange={e => setAssignRoom(e.target.value)}
                  className="px-3 py-2 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
                >
                  <option value="">Pick a room…</option>
                  {AIX_ROOMS.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={assignStart}
                  onChange={e => setAssignStart(e.target.value)}
                  className="px-3 py-2 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
                <span className="text-stone-400 text-sm">–</span>
                <input
                  type="date"
                  value={assignEnd}
                  min={assignStart}
                  onChange={e => setAssignEnd(e.target.value)}
                  className="px-3 py-2 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
                <button
                  onClick={handleAssign}
                  disabled={!assignRoom || !assignStart || !assignEnd || assigning}
                  className="px-4 py-2 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-40 transition-colors"
                >
                  {assigning ? '…' : 'Confirm'}
                </button>
                <button
                  onClick={closeAssign}
                  className="px-3 py-2 border border-stone-200 text-sm text-stone-500 rounded-xl hover:bg-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Manual assign form ── */}
      {showForm && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Assign a room</h3>
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-stone-400 mb-1">Room</label>
              <select
                value={room}
                onChange={e => setRoom(e.target.value)}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
              >
                {AIX_ROOMS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-stone-400 mb-1.5">Occupant</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {(['family', 'guest'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOccType(t)}
                    className={`py-2 rounded-xl text-sm border capitalize transition-colors ${
                      occType === t
                        ? 'bg-stone-800 text-white border-stone-800'
                        : 'border-stone-200 text-stone-600 bg-white hover:bg-stone-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {occType === 'family' ? (
                <select
                  value={famMember}
                  onChange={e => setFamMember(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
                >
                  {FAMILY_MEMBER_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="Guest name"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Check-in</label>
                <input
                  type="date" value={startDate}
                  onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Check-out</label>
                <input
                  type="date" value={endDate} min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
            </div>

            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
            />

            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-white transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50">
                {loading ? 'Saving…' : 'Assign'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Room grid ── */}
      <div className="rounded-2xl border border-stone-100 overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div style={{ minWidth: totalWidth }}>

            {/* Month headers */}
            <div className="flex border-b border-stone-100">
              <div className="flex-shrink-0 sticky left-0 z-20 bg-stone-50 border-r border-stone-100" style={{ width: NAME_W }} />
              {MONTHS.map(m => (
                <div
                  key={m.label}
                  className="flex-shrink-0 bg-stone-50 border-r border-stone-200 flex items-center justify-center"
                  style={{ width: DAY_W * m.days }}
                >
                  <span className="text-[11px] font-semibold text-stone-500 py-2">{m.label}</span>
                </div>
              ))}
            </div>

            {/* Day numbers */}
            <div className="flex border-b border-stone-100">
              <div className="flex-shrink-0 sticky left-0 z-20 bg-stone-50/80 border-r border-stone-100" style={{ width: NAME_W }} />
              {days.map((day, i) => {
                const isWknd = day.getDay() === 0 || day.getDay() === 6
                const isTdy  = toDateStr(day) === todayStr
                return (
                  <div key={i}
                    className="flex-shrink-0 flex items-center justify-center border-r border-stone-50"
                    style={{ width: DAY_W, background: isTdy ? '#FDE68A' : isWknd ? '#FAFAF9' : '' }}>
                    <span className={`text-[9px] ${isTdy ? 'font-bold text-amber-700' : 'text-stone-400'}`}>
                      {day.getDate()}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Room rows */}
            {AIX_ROOMS.map((r, ri) => {
              const rowH = rowHeights[r.id] ?? MIN_ROW
              return (
                <div key={r.id} className={`flex ${ri < AIX_ROOMS.length - 1 ? 'border-b border-stone-100' : ''}`}>
                  {/* Sticky name */}
                  <div
                    className="flex-shrink-0 sticky left-0 z-10 bg-white border-r border-stone-100 flex items-center px-3"
                    style={{ width: NAME_W, height: rowH }}
                  >
                    <span className="text-xs font-medium text-stone-700">{r.label}</span>
                  </div>

                  {/* Day cells */}
                  {days.map((day, i) => {
                    const ds      = toDateStr(day)
                    const occ     = occupantMap[r.id]?.[ds] ?? []
                    const isWknd  = day.getDay() === 0 || day.getDay() === 6
                    const isTdy   = ds === todayStr
                    const emptyBg = isTdy ? '#FDE68A' : isWknd ? '#FAFAF9' : ''

                    return (
                      <div
                        key={i}
                        className="flex-shrink-0 flex flex-col justify-center border-r border-stone-50 overflow-hidden"
                        style={{ width: DAY_W, height: rowH, background: occ.length === 0 ? emptyBg : '' }}
                        title={occ.length > 0 ? occ.map(o => o.name).join(', ') : undefined}
                      >
                        {occ.map((o, oi) => (
                          <div
                            key={oi}
                            className="w-full flex items-center justify-center flex-shrink-0"
                            style={{
                              height: STRIP_H,
                              background: hexToRgba(o.color, 0.28),
                              borderTop: oi > 0 ? '1px solid rgba(255,255,255,0.6)' : undefined,
                            }}
                          >
                            <span style={{ color: o.color, fontSize: 8, fontWeight: 700, letterSpacing: -0.3 }}>
                              {o.name.slice(0, 3).toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Upcoming list ── */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Current & upcoming</p>
          {upcoming.map(a => {
            const roomLabel = AIX_ROOMS.find(r => r.id === a.room)?.label ?? a.room
            const dotColor  = PERSON_COLORS[a.occupant_name.toLowerCase()] ?? '#78716C'
            return (
              <div key={a.id} className="bg-white border border-stone-100 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: dotColor }} />
                  <div>
                    <p className="text-sm font-medium text-stone-800">{a.occupant_name}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {roomLabel} · {fmtShort(a.start_date)} – {fmtShort(a.end_date)}
                    </p>
                    {a.notes && <p className="text-xs text-stone-400 italic mt-0.5">{a.notes}</p>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deleting === a.id}
                  className="text-xs text-stone-300 hover:text-red-400 transition-colors px-2 py-1"
                >
                  {deleting === a.id ? '…' : '✕'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {roomAllocations.length === 0 && !hasUnallocated && !showForm && (
        <div className="text-center py-16 text-stone-400 text-sm italic">
          No rooms assigned yet.
        </div>
      )}
    </div>
  )
}
