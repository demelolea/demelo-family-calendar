'use client'

import { useState, useMemo } from 'react'
import { Event, PhoebeSchedule, Guest, Stay, CalendarEntry, PERSON_COLORS, PERSON_LABELS, TRANSPORT_ICONS } from '@/lib/types'
import DayModal from './DayModal'
import AddEventModal from './AddEventModal'

interface CalendarProps {
  events: Event[]
  phoebeSchedule: PhoebeSchedule[]
  guests: Guest[]
  stays: Stay[]
  onRefresh: () => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Calendar({ events, phoebeSchedule, guests, stays, onRefresh }: CalendarProps) {
  const today = useMemo(() => new Date(), [])
  const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addInitialDate, setAddInitialDate] = useState('')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7

  const allEntries: CalendarEntry[] = useMemo(() => {
    const entries: CalendarEntry[] = []
    stays.forEach(s => {
      entries.push({
        id: s.id,
        title: s.location,
        person: s.person,
        color: PERSON_COLORS[s.person] ?? '#8A8A8A',
        start_date: s.start_date,
        end_date: s.end_date,
        location: s.location,
        type: 'stay',
      })
    })
    events.forEach(e => {
      entries.push({
        id: e.id,
        title: e.title,
        person: e.person,
        color: PERSON_COLORS[e.person] ?? '#8A8A8A',
        start_date: e.start_date,
        end_date: e.end_date,
        location: e.location,
        type: 'event',
        transport_type: e.transport_type,
        travel_direction: e.travel_direction,
        transport_station: e.transport_station,
        transport_time: e.transport_time,
      })
    })
    phoebeSchedule.forEach(p => {
      entries.push({
        id: p.id,
        title: `Phoebe with ${p.with_whom}`,
        person: 'phoebe',
        color: PERSON_COLORS.phoebe,
        start_date: p.start_date,
        end_date: p.end_date,
        type: 'phoebe',
      })
    })
    guests.forEach(g => {
      entries.push({
        id: g.id,
        title: `${g.guest_name} @ ${g.house === 'aix' ? 'Aix' : 'Geneva'}`,
        person: 'guest',
        color: PERSON_COLORS.guest,
        start_date: g.arrival_date,
        end_date: g.departure_date,
        location: g.house,
        type: 'guest',
        invited_by: g.invited_by,
      })
    })
    return entries
  }, [events, phoebeSchedule, guests, stays])

  const getEntriesForDay = (day: number): CalendarEntry[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return allEntries.filter(e => e.start_date <= dateStr && e.end_date >= dateStr)
  }

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToToday = () => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))

  const openDay = (day: number) => setSelectedDay(day)

  const openAddFromDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setAddInitialDate(dateStr)
    setSelectedDay(null)
    setShowAddModal(true)
  }

  const selectedEntries = selectedDay ? getEntriesForDay(selectedDay) : []

  return (
    <div className="flex flex-col">
      {/* Calendar header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-stone-100 active:bg-stone-200 transition-colors text-stone-500" aria-label="Previous month">‹</button>
          <h2 className="text-lg font-semibold text-stone-800 min-w-[170px] text-center">{MONTH_NAMES[month]} {year}</h2>
          <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-stone-100 active:bg-stone-200 transition-colors text-stone-500" aria-label="Next month">›</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToToday} className="text-xs text-stone-500 px-2.5 py-1.5 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">Today</button>
          <button onClick={() => { setAddInitialDate(''); setShowAddModal(true) }} className="text-xs bg-stone-800 text-white px-3 py-1.5 rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors font-medium">+ Add</button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-stone-400 py-1.5">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-l border-t border-stone-100 rounded-xl overflow-hidden shadow-sm">
        {Array.from({ length: totalCells }).map((_, idx) => {
          const day = idx - firstDayOfMonth + 1
          const inMonth = day >= 1 && day <= daysInMonth
          const dayEntries = inMonth ? getEntriesForDay(day) : []
          const todayCell = inMonth && isToday(day)

          return (
            <div
              key={idx}
              onClick={() => inMonth && openDay(day)}
              className={[
                'border-r border-b border-stone-100 min-h-[72px] sm:min-h-[90px] p-1.5 transition-colors',
                inMonth ? 'cursor-pointer hover:bg-stone-50 active:bg-stone-100' : 'bg-stone-50/50',
                todayCell ? 'bg-amber-50/60' : '',
              ].join(' ')}
            >
              {inMonth && (
                <>
                  <div className={['text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1', todayCell ? 'bg-stone-800 text-white' : 'text-stone-500'].join(' ')}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEntries.slice(0, 3).map(entry => {
                      const icon = entry.transport_type ? TRANSPORT_ICONS[entry.transport_type] ?? '' : ''
                      return (
                        <div key={`${entry.type}-${entry.id}`} className="rounded overflow-hidden" style={{ backgroundColor: entry.color }}>
                          <div className="hidden sm:block text-[10px] text-white font-medium px-1.5 py-[2px] truncate leading-tight">
                            {icon}{icon ? ' ' : ''}{entry.title}
                          </div>
                          <div className="sm:hidden h-1.5 w-full" />
                        </div>
                      )
                    })}
                    {dayEntries.length > 3 && (
                      <p className="text-[10px] text-stone-400 pl-0.5">+{dayEntries.length - 3}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-5">
        {Object.entries(PERSON_COLORS).map(([person, color]) => (
          <div key={person} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-stone-500">{PERSON_LABELS[person]}</span>
          </div>
        ))}
      </div>

      {selectedDay && (
        <DayModal
          date={new Date(year, month, selectedDay)}
          entries={selectedEntries}
          onClose={() => setSelectedDay(null)}
          onAddEvent={() => openAddFromDay(selectedDay)}
        />
      )}

      {showAddModal && (
        <AddEventModal
          initialDate={addInitialDate}
          onClose={() => setShowAddModal(false)}
          onSave={() => { setShowAddModal(false); onRefresh() }}
        />
      )}
    </div>
  )
}
