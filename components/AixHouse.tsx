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

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

type PersonEntry = {
  key: string
  displayName: string
  color: string
  type: 'family' | 'guest'
  stayStart: string
  stayEnd: string
  guestId?: string
  assignedRoom: string | null
  allocationId: string | null
}

const ROOM_LABEL = (id: string) => AIX_ROOMS.find(r => r.id === id)?.label ?? id

function totalColor(count: number): string {
  if (count === 0) return 'bg-white text-stone-200'
  if (count <= 3) return 'bg-green-100 text-green-700'
  if (count <= 6) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

export default function AixHouse({ roomAllocations, stays, guests, currentUser, onRefresh }: AixHouseProps) {
  const todayStr = toDateStr(new Date())
  const now = new Date()

  const [viewYear, setViewYear]         = useState(now.getFullYear())
  const [viewMonth, setViewMonth]       = useState(now.getMonth())
  const [drawerPerson, setDrawerPerson] = useState<PersonEntry | null>(null)
  const [saving, setSaving]             = useState(false)
  const [showUnallocated, setShowUnallocated] = useState(true)

  // All days in the current viewed month
  const monthDays = useMemo(() => {
    const days: string[] = []
    const d = new Date(viewYear, viewMonth, 1)
    while (d.getMonth() === viewMonth) {
      days.push(toDateStr(d))
      d.setDate(d.getDate() + 1)
    }
    return days
  }, [viewYear, viewMonth])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Compute people present in Aix on a given date
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
        key:          `family-${stay.id}`,
        displayName,
        color:        PERSON_COLORS[stay.person] ?? '#8A8A8A',
        type:         'family',
        stayStart:    stay.start_date,
        stayEnd:      stay.end_date,
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
        key:          `guest-${g.id}`,
        displayName:  g.guest_name,
        color:        '#8A8A8A',
        type:         'guest',
        stayStart:    g.arrival_date,
        stayEnd:      g.departure_date,
        guestId:      g.id,
        assignedRoom: roomId,
        allocationId: alloc?.id ?? null,
      })
    }

    return people
  }

  // Per-day data for the whole month
  const dailyData = useMemo(
    () => monthDays.map(date => ({ date, people: computePeople(date) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthDays, stays, guests, roomAllocations],
  )

  // room → date → occupants
  const roomDayMap = useMemo(() => {
    const map: Record<string, Record<string, PersonEntry[]>> = {}
    for (const room of AIX_ROOMS) {
      map[room.id] = {}
      for (const { date, people } of dailyData) {
        map[room.id][date] = people.filter(p => p.assignedRoom === room.id)
      }
    }
    return map
  }, [dailyData])

  // Daily head-counts
  const dailyTotals = useMemo(
    () => dailyData.map(({ date, people }) => ({ date, count: people.length })),
    [dailyData],
  )

  // Unique unallocated people during this month
  const unallocated = useMemo(() => {
    const seen = new Set<string>()
    const result: PersonEntry[] = []
    for (const { people } of dailyData) {
      for (const p of people) {
        if (!p.assignedRoom && !seen.has(p.key)) {
          seen.add(p.key)
          result.push(p)
        }
      }
    }
    return result
  }, [dailyData])

  // ── Actions ───────────────────────────────────────────────────────────────
  const assignToRoom = async (roomId: string) => {
    if (!drawerPerson || saving) return
    setSaving(true)

    if (drawerPerson.allocationId) {
      await supabase.from('room_allocations').delete().eq('id', drawerPerson.allocationId)
    }
    if (drawerPerson.type === 'guest' && drawerPerson.guestId) {
      await supabase.from('guests').update({ allocated_room: roomId }).eq('id', drawerPerson.guestId)
    } else {
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
      await supabase.from('guests').update({ allocated_room: null }).eq('id', drawerPerson.guestId)
    }

    setSaving(false)
    const actor = PERSON_LABELS[currentUser] ?? currentUser
    notifyFamily(currentUser, 'Room cleared 🏠', `${actor} removed ${drawerPerson.displayName} from their room in Aix`)
    setDrawerPerson(null)
    onRefresh()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-4">

      {/* Header */}
      <div>
        <h2 className="font-serif text-xl font-semibold text-stone-800">🏠 Aix Rooms</h2>
        <p className="text-sm text-stone-400 mt-0.5">Room planning for Aix-en-Provence</p>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between bg-white border border-stone-200 rounded-2xl px-4 py-3">
        <button
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors text-stone-500 text-xl font-light"
        >
          ‹
        </button>
        <p className="font-semibold text-stone-800">{MONTH_NAMES[viewMonth]} {viewYear}</p>
        <button
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors text-stone-500 text-xl font-light"
        >
          ›
        </button>
      </div>

      {/* Unallocated panel */}
      {unallocated.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowUnallocated(u => !u)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-amber-600 font-semibold text-sm">⚠ Unallocated</span>
              <span className="bg-amber-200 text-amber-800 text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                {unallocated.length}
              </span>
            </div>
            <span className="text-amber-400 text-xs">{showUnallocated ? '▲' : '▼'}</span>
          </button>
          {showUnallocated && (
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {unallocated.map(p => (
                <button
                  key={p.key}
                  onClick={() => setDrawerPerson(p)}
                  className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl text-sm font-medium text-white shadow-sm active:opacity-80"
                  style={{ backgroundColor: p.color }}
                >
                  {p.displayName}
                  <span className="text-[11px] bg-white/20 rounded-md px-1 py-0.5">+ room</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Grid ── */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="border-collapse text-xs" style={{ minWidth: `${96 + monthDays.length * 36}px` }}>

            {/* Header row: room label col + day columns */}
            <thead>
              <tr className="border-b border-stone-200">
                <th
                  className="sticky left-0 bg-stone-50 z-20 text-left px-3 py-2 text-[11px] font-semibold text-stone-400 border-r border-stone-200 whitespace-nowrap"
                  style={{ minWidth: 96, width: 96 }}
                >
                  Room
                </th>
                {monthDays.map(date => {
                  const d       = new Date(date + 'T12:00:00')
                  const isToday = date === todayStr
                  const dow     = ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()]
                  return (
                    <th
                      key={date}
                      style={{ minWidth: 36, width: 36 }}
                      className={[
                        'text-center py-1.5 px-0 font-medium border-r border-stone-100 select-none',
                        isToday
                          ? 'bg-stone-800 text-white'
                          : 'text-stone-400',
                      ].join(' ')}
                    >
                      <div className="text-[11px] leading-tight">{d.getDate()}</div>
                      <div className="text-[9px] opacity-60 leading-tight">{dow}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>

            {/* Room rows */}
            <tbody>
              {AIX_ROOMS.map((room, ri) => {
                const rowBg = ri % 2 === 0 ? 'bg-white' : 'bg-stone-50/60'
                return (
                  <tr key={room.id}>
                    {/* Sticky room name */}
                    <td
                      className={`sticky left-0 z-10 border-r border-b border-stone-100 px-3 py-1.5 font-medium text-stone-700 text-[11px] whitespace-nowrap ${rowBg}`}
                      style={{ minWidth: 96, width: 96 }}
                    >
                      {room.label}
                    </td>

                    {/* Day cells */}
                    {monthDays.map(date => {
                      const occupants = roomDayMap[room.id]?.[date] ?? []
                      const isToday   = date === todayStr
                      return (
                        <td
                          key={date}
                          style={{ minWidth: 36, width: 36, verticalAlign: 'top' }}
                          className={[
                            'border-r border-b border-stone-100 p-0.5',
                            isToday ? 'bg-stone-100/80' : rowBg,
                          ].join(' ')}
                        >
                          <div className="flex flex-col gap-px min-h-[1.75rem]">
                            {occupants.map(p => (
                              <button
                                key={p.key}
                                onClick={() => setDrawerPerson(p)}
                                title={p.displayName}
                                className="w-full rounded text-white font-bold leading-tight text-center active:opacity-70"
                                style={{
                                  backgroundColor: p.color,
                                  fontSize: 9,
                                  padding: '2px 1px',
                                }}
                              >
                                {p.displayName.slice(0, 2).toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>

            {/* Total row */}
            <tfoot>
              <tr className="border-t-2 border-stone-200">
                <td
                  className="sticky left-0 bg-stone-50 z-10 border-r border-stone-200 px-3 py-1.5 text-[11px] font-bold text-stone-600 whitespace-nowrap"
                  style={{ minWidth: 96, width: 96 }}
                >
                  Total
                </td>
                {dailyTotals.map(({ date, count }) => (
                  <td
                    key={date}
                    style={{ minWidth: 36, width: 36 }}
                    className={`text-center text-[11px] font-bold py-1.5 border-r border-stone-100 ${totalColor(count)}`}
                  >
                    {count > 0 ? count : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-stone-100 bg-stone-50/50">
          <span className="text-[10px] text-stone-400 font-medium">Total:</span>
          {[
            { label: '0',   cls: 'bg-white border border-stone-200' },
            { label: '1–3', cls: 'bg-green-100' },
            { label: '4–6', cls: 'bg-amber-100' },
            { label: '7+',  cls: 'bg-red-100' },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-sm ${cls}`} />
              <span className="text-[10px] text-stone-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom drawer for room assignment */}
      {drawerPerson && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setDrawerPerson(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-4 pb-10">
            {/* Drag handle */}
            <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-4" />

            {/* Person header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: drawerPerson.color }}
              >
                {drawerPerson.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-stone-800">{drawerPerson.displayName}</p>
                <p className="text-xs text-stone-400">
                  {drawerPerson.assignedRoom
                    ? `Currently in ${ROOM_LABEL(drawerPerson.assignedRoom)} · tap to move`
                    : 'Tap a room to assign'}
                </p>
              </div>
            </div>

            {/* Room grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {AIX_ROOMS.map(room => {
                const isCurrent = drawerPerson.assignedRoom === room.id
                return (
                  <button
                    key={room.id}
                    onClick={() => assignToRoom(room.id)}
                    disabled={saving}
                    className={[
                      'py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all text-left',
                      isCurrent
                        ? 'bg-stone-800 text-white border-stone-800'
                        : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400 active:bg-stone-50',
                    ].join(' ')}
                  >
                    {room.label}
                    {isCurrent && <span className="block text-[10px] opacity-60 mt-0.5">Assigned ✓</span>}
                  </button>
                )
              })}
            </div>

            {/* Remove button */}
            {drawerPerson.assignedRoom && (
              <button
                onClick={removeFromRoom}
                disabled={saving}
                className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Remove from room'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
