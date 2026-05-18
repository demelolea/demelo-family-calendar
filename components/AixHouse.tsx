'use client'

import { useState, useMemo } from 'react'
import { RoomAllocation, Stay, Guest, AIX_ROOMS, PERSON_COLORS, PERSON_LABELS } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { notifyFamily } from '@/lib/notify'

interface AixHouseProps {
  roomAllocations: RoomAllocation[]
  stays: Stay[]
  guests: Guest[]
  currentUser: string
  onRefresh: () => void
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

function fmtShort(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtLong(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow  // Monday-start
  return addDays(dateStr, diff)
}

type PersonEntry = {
  key: string
  displayName: string
  color: string
  type: 'family' | 'guest'
  stayStart: string
  stayEnd: string
  guestId?: string          // for guests: Guest.id
  assignedRoom: string | null
  allocationId: string | null  // room_allocations.id, if exists
}

type ViewMode = 'day' | 'week'

const ROOM_LABEL = (id: string) => AIX_ROOMS.find(r => r.id === id)?.label ?? id

export default function AixHouse({ roomAllocations, stays, guests, currentUser, onRefresh }: AixHouseProps) {
  const todayStr = toDateStr(new Date())

  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [viewMode, setViewMode]         = useState<ViewMode>('day')
  const [drawerPerson, setDrawerPerson] = useState<PersonEntry | null>(null)
  const [saving, setSaving]             = useState(false)

  // ── Compute people in Aix on a given date ───────────────────────────────
  const computePeople = (dateStr: string): PersonEntry[] => {
    const people: PersonEntry[] = []

    for (const stay of stays) {
      if (!stay.location.toLowerCase().includes('aix')) continue
      if (stay.start_date > dateStr || stay.end_date < dateStr) continue
      const displayName = PERSON_LABELS[stay.person] ?? stay.person
      const alloc = roomAllocations.find(a =>
        a.occupant_name.toLowerCase() === displayName.toLowerCase() &&
        a.start_date <= dateStr && a.end_date >= dateStr,
      )
      people.push({
        key: `family-${stay.id}`,
        displayName,
        color: PERSON_COLORS[stay.person] ?? '#8A8A8A',
        type: 'family',
        stayStart: stay.start_date,
        stayEnd: stay.end_date,
        assignedRoom: alloc?.room ?? null,
        allocationId: alloc?.id ?? null,
      })
    }

    for (const g of guests) {
      if (g.house !== 'aix') continue
      if (g.arrival_date > dateStr || g.departure_date < dateStr) continue
      const alloc = roomAllocations.find(a =>
        a.occupant_name.toLowerCase() === g.guest_name.toLowerCase() &&
        a.start_date <= dateStr && a.end_date >= dateStr,
      )
      const roomId = alloc?.room ?? g.allocated_room ?? null
      people.push({
        key: `guest-${g.id}`,
        displayName: g.guest_name,
        color: '#8A8A8A',
        type: 'guest',
        stayStart: g.arrival_date,
        stayEnd: g.departure_date,
        guestId: g.id,
        assignedRoom: roomId,
        allocationId: alloc?.id ?? null,
      })
    }

    return people.sort((a, b) => {
      if (!a.assignedRoom && b.assignedRoom) return -1
      if (a.assignedRoom && !b.assignedRoom) return 1
      return a.displayName.localeCompare(b.displayName)
    })
  }

  const peopleOnDate = useMemo(() => computePeople(selectedDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, stays, guests, roomAllocations],
  )

  // Week view — 7 days starting Monday
  const weekDays = useMemo(() => {
    const mon = weekStart(selectedDate)
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  }, [selectedDate])

  const weekCounts = useMemo(() =>
    weekDays.map(d => ({ date: d, count: computePeople(d).length })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekDays, stays, guests, roomAllocations],
  )

  // Room occupants for selected date
  const roomOccupants = useMemo(() => {
    const map: Record<string, PersonEntry[]> = {}
    for (const r of AIX_ROOMS) {
      map[r.id] = peopleOnDate.filter(p => p.assignedRoom === r.id)
    }
    return map
  }, [peopleOnDate])

  const totalCount     = peopleOnDate.length
  const familyCount    = peopleOnDate.filter(p => p.type === 'family').length
  const guestCount     = peopleOnDate.filter(p => p.type === 'guest').length
  const assignedCount  = peopleOnDate.filter(p => p.assignedRoom).length
  const unassignedCount = totalCount - assignedCount

  // ── Actions ─────────────────────────────────────────────────────────────
  const assignToRoom = async (roomId: string) => {
    if (!drawerPerson || saving) return
    setSaving(true)

    // Delete any existing allocation first (for both family and guests)
    if (drawerPerson.allocationId) {
      await supabase.from('room_allocations').delete().eq('id', drawerPerson.allocationId)
    }

    if (drawerPerson.type === 'guest' && drawerPerson.guestId) {
      // Guests: store in guests.allocated_room (simple, covers whole stay)
      await supabase.from('guests')
        .update({ allocated_room: roomId })
        .eq('id', drawerPerson.guestId)
    } else {
      // Family: store in room_allocations with their stay dates
      await supabase.from('room_allocations').insert({
        room:          roomId,
        occupant_name: drawerPerson.displayName,
        start_date:    drawerPerson.stayStart,
        end_date:      drawerPerson.stayEnd,
      })
    }

    setSaving(false)
    const actor = PERSON_LABELS[currentUser] ?? currentUser
    notifyFamily(currentUser, 'Room assigned 🏠', `${actor} assigned ${drawerPerson.displayName} to ${ROOM_LABEL(roomId)} in Aix`)
    setDrawerPerson(null)
    onRefresh()
  }

  const removeFromRoom = async () => {
    if (!drawerPerson || saving) return
    setSaving(true)

    if (drawerPerson.allocationId) {
      await supabase.from('room_allocations').delete().eq('id', drawerPerson.allocationId)
    }
    if (drawerPerson.type === 'guest' && drawerPerson.guestId) {
      await supabase.from('guests')
        .update({ allocated_room: null })
        .eq('id', drawerPerson.guestId)
    }

    setSaving(false)
    const actor = PERSON_LABELS[currentUser] ?? currentUser
    notifyFamily(currentUser, 'Room cleared 🏠', `${actor} removed ${drawerPerson.displayName} from their room in Aix`)
    setDrawerPerson(null)
    onRefresh()
  }

  const openDrawer = (person: PersonEntry) => {
    setDrawerPerson(prev => prev?.key === person.key ? null : person)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <div>
        <h2 className="font-serif text-xl font-semibold text-stone-800">🏠 Aix Rooms</h2>
        <p className="text-sm text-stone-400 mt-0.5">Room planning · tap a person to assign them a room</p>
      </div>

      {/* ── Section 1: Date selector + occupancy summary ── */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">

        {/* Day / Week toggle */}
        <div className="flex border-b border-stone-100">
          {(['day', 'week'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={[
                'flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                viewMode === mode
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-400 hover:bg-stone-50',
              ].join(' ')}
            >
              {mode === 'day' ? 'Single day' : 'Week view'}
            </button>
          ))}
        </div>

        {/* Day mode: date nav */}
        {viewMode === 'day' && (
          <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100">
            <button
              onClick={() => setSelectedDate(d => addDays(d, -1))}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors flex-shrink-0"
            >‹</button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="flex-1 text-center text-sm font-medium text-stone-700 border border-stone-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
            <button
              onClick={() => setSelectedDate(d => addDays(d, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors flex-shrink-0"
            >›</button>
          </div>
        )}

        {/* Week mode: 7-day strip */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-7 border-b border-stone-100">
            {weekCounts.map(({ date, count }) => {
              const d       = new Date(date + 'T12:00:00')
              const isToday = date === todayStr
              const isSel   = date === selectedDate
              const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' })
              const dayNum  = d.getDate()
              return (
                <button
                  key={date}
                  onClick={() => { setSelectedDate(date); setViewMode('day') }}
                  className={[
                    'flex flex-col items-center py-3 gap-1 transition-colors border-r border-stone-100 last:border-r-0',
                    isSel ? 'bg-stone-800 text-white' : isToday ? 'bg-amber-50' : 'hover:bg-stone-50',
                  ].join(' ')}
                >
                  <span className={`text-[10px] font-semibold uppercase ${isSel ? 'text-stone-300' : 'text-stone-400'}`}>
                    {dayName}
                  </span>
                  <span className={`text-sm font-bold ${isSel ? 'text-white' : isToday ? 'text-amber-700' : 'text-stone-700'}`}>
                    {dayNum}
                  </span>
                  {count > 0 ? (
                    <span className={`text-[11px] font-semibold ${isSel ? 'text-stone-200' : 'text-stone-600'}`}>
                      {count}
                    </span>
                  ) : (
                    <span className={`text-[11px] ${isSel ? 'text-stone-500' : 'text-stone-300'}`}>–</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Occupancy summary */}
        <div className="px-4 py-4">
          {totalCount === 0 ? (
            <div className="text-center py-3">
              <p className="text-sm font-medium text-stone-500">{fmtLong(selectedDate)}</p>
              <p className="text-xs text-stone-400 mt-1 italic">No one in Aix on this date</p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center">
              <p className="text-3xl font-bold text-stone-800 leading-none">{totalCount}</p>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mt-1">
                {fmtLong(selectedDate)}
              </p>
              <div className="flex items-center justify-center gap-4 mt-2.5 text-sm">
                {familyCount > 0 && (
                  <span className="flex items-center gap-1.5 text-stone-600">
                    <span className="w-2 h-2 rounded-full bg-stone-600 inline-block" />
                    <span className="font-semibold">{familyCount}</span> family
                  </span>
                )}
                {guestCount > 0 && (
                  <span className="flex items-center gap-1.5 text-stone-500">
                    <span className="w-2 h-2 rounded-full bg-stone-400 inline-block" />
                    <span className="font-semibold">{guestCount}</span> {guestCount === 1 ? 'guest' : 'guests'}
                  </span>
                )}
              </div>
              {unassignedCount > 0 && (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  ⚠ {unassignedCount} {unassignedCount === 1 ? 'person' : 'people'} not yet assigned to a room
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: People in Aix ── */}
      {peopleOnDate.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-0.5">
            People in Aix — tap to assign
          </p>

          {peopleOnDate.map(person => {
            const isUnassigned = !person.assignedRoom
            const isActive     = drawerPerson?.key === person.key
            return (
              <button
                key={person.key}
                onClick={() => openDrawer(person)}
                className={[
                  'w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border transition-all text-left',
                  isActive
                    ? 'bg-stone-800 border-stone-800'
                    : isUnassigned
                      ? 'bg-amber-50 border-amber-200 hover:border-amber-400'
                      : 'bg-white border-stone-100 hover:border-stone-300 shadow-sm',
                ].join(' ')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isActive ? 'white' : person.color }}
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold leading-snug truncate ${isActive ? 'text-white' : 'text-stone-800'}`}>
                      {person.displayName}
                      {person.type === 'guest' && (
                        <span className={`ml-1.5 text-[10px] font-normal ${isActive ? 'text-stone-400' : 'text-stone-400'}`}>
                          guest
                        </span>
                      )}
                    </p>
                    <p className={`text-xs mt-0.5 ${isActive ? 'text-stone-400' : 'text-stone-400'}`}>
                      {fmtShort(person.stayStart)} – {fmtShort(person.stayEnd)}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {isUnassigned ? (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isActive ? 'bg-stone-600 text-stone-200' : 'bg-amber-200 text-amber-800'}`}>
                      Unassigned
                    </span>
                  ) : (
                    <span className={`text-xs font-medium ${isActive ? 'text-stone-400' : 'text-stone-500'}`}>
                      🛏 {ROOM_LABEL(person.assignedRoom!)}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Section 3: Room cards ── */}
      {peopleOnDate.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-0.5">
            Rooms · {fmtShort(selectedDate)}
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {AIX_ROOMS.map(r => {
              const occupants = roomOccupants[r.id] ?? []
              const hasOccupants = occupants.length > 0
              return (
                <div
                  key={r.id}
                  className={[
                    'bg-white border rounded-2xl p-3.5 transition-all',
                    hasOccupants ? 'border-stone-200 shadow-sm' : 'border-stone-100',
                  ].join(' ')}
                >
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                    {r.label}
                  </p>
                  {!hasOccupants ? (
                    <p className="text-xs text-stone-300 italic">Empty</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {occupants.map(person => {
                        const isActive = drawerPerson?.key === person.key
                        return (
                          <button
                            key={person.key}
                            onClick={() => openDrawer(person)}
                            className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                            style={{
                              backgroundColor: isActive
                                ? '#1C1917'
                                : `${person.color}28`,
                              color: isActive ? 'white' : person.color,
                            }}
                          >
                            <div
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: isActive ? 'white' : person.color }}
                            />
                            {person.displayName}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Section 4: Occupancy total ── */}
      {peopleOnDate.length > 0 && (
        <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3">
          <span className="text-sm text-stone-500">Rooms assigned</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-stone-700 rounded-full transition-all"
                style={{ width: totalCount > 0 ? `${(assignedCount / totalCount) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-sm font-semibold text-stone-800">
              {assignedCount} / {totalCount}
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {peopleOnDate.length === 0 && (
        <div className="text-center py-16 text-stone-400 text-sm italic">
          No one is staying in Aix on this date.
        </div>
      )}

      {/* ── Bottom drawer ── */}
      {drawerPerson && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerPerson(null)}
          />

          {/* Drawer */}
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl">
            {/* Handle */}
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mt-3 mb-1" />

            <div className="px-4 pb-8 max-h-[80vh] overflow-y-auto">
              {/* Person header */}
              <div className="flex items-center justify-between py-3 border-b border-stone-100 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: drawerPerson.color }}
                  />
                  <div>
                    <p className="text-base font-semibold text-stone-800 leading-snug">
                      {drawerPerson.displayName}
                      {drawerPerson.type === 'guest' && (
                        <span className="ml-1.5 text-xs font-normal text-stone-400">guest</span>
                      )}
                    </p>
                    <p className="text-xs text-stone-400">
                      {fmtShort(drawerPerson.stayStart)} – {fmtShort(drawerPerson.stayEnd)}
                      {drawerPerson.assignedRoom && (
                        <span className="ml-2 text-stone-500">
                          · currently in {ROOM_LABEL(drawerPerson.assignedRoom)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerPerson(null)}
                  className="text-stone-400 hover:text-stone-600 transition-colors text-xl leading-none px-1"
                >✕</button>
              </div>

              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-3">
                {drawerPerson.assignedRoom ? 'Move to a different room' : 'Choose a room'}
              </p>

              {/* Room options grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {AIX_ROOMS.map(r => {
                  const isCurrent   = drawerPerson.assignedRoom === r.id
                  const others      = (roomOccupants[r.id] ?? []).filter(p => p.key !== drawerPerson.key)
                  return (
                    <button
                      key={r.id}
                      onClick={() => assignToRoom(r.id)}
                      disabled={saving}
                      className={[
                        'flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all',
                        isCurrent
                          ? 'bg-stone-800 border-stone-800'
                          : 'bg-white border-stone-200 hover:border-stone-400 hover:bg-stone-50 active:bg-stone-100',
                      ].join(' ')}
                    >
                      <p className={`text-sm font-semibold leading-snug ${isCurrent ? 'text-white' : 'text-stone-700'}`}>
                        {r.label}
                      </p>
                      {isCurrent && (
                        <span className="text-[10px] text-stone-400 mt-0.5">✓ Current room</span>
                      )}
                      {others.length > 0 ? (
                        <p className={`text-[11px] mt-1 ${isCurrent ? 'text-stone-400' : 'text-stone-400'}`}>
                          + {others.map(p => p.displayName).join(', ')}
                        </p>
                      ) : !isCurrent ? (
                        <p className="text-[11px] mt-1 text-stone-300">Empty</p>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              {/* Remove option */}
              {drawerPerson.assignedRoom && (
                <button
                  onClick={removeFromRoom}
                  disabled={saving}
                  className="w-full py-3.5 border border-red-200 text-red-500 rounded-2xl text-sm font-medium hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : `Remove from ${ROOM_LABEL(drawerPerson.assignedRoom)}`}
                </button>
              )}

              {saving && !drawerPerson.assignedRoom && (
                <p className="text-center text-sm text-stone-400 py-2">Saving…</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
