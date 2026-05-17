'use client'

import { CalendarEntry, PERSON_LABELS, TRANSPORT_ICONS } from '@/lib/types'

interface DayModalProps {
  date: Date
  entries: CalendarEntry[]
  onClose: () => void
  onAddEvent: () => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatRange(start: string, end: string) {
  if (start === end) return null
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(new Date(start + 'T12:00:00'))} – ${fmt(new Date(end + 'T12:00:00'))}`
}

export default function DayModal({ date, entries, onClose, onAddEvent }: DayModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-0.5">
                {MONTH_NAMES[date.getMonth()]} {date.getFullYear()}
              </p>
              <h3 className="font-serif text-3xl font-semibold text-stone-800 leading-none">{date.getDate()}</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 transition-colors text-lg">×</button>
          </div>

          {entries.length === 0 ? (
            <p className="text-sm text-stone-400 py-4 text-center italic">A quiet day.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {entries.map(entry => {
                const transportIcon = entry.transport_type ? TRANSPORT_ICONS[entry.transport_type] ?? '' : ''
                const hasTravel = !!entry.transport_type

                return (
                  <div key={`${entry.type}-${entry.id}`} className="flex items-start gap-3 p-3 rounded-xl bg-stone-50">
                    <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 leading-snug">{entry.title}</p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {PERSON_LABELS[entry.person] ?? entry.person}
                        {entry.location ? ` · ${entry.location}` : ''}
                      </p>
                      {/* Date range */}
                      {formatRange(entry.start_date, entry.end_date) && (
                        <p className="text-xs text-stone-400 mt-0.5">{formatRange(entry.start_date, entry.end_date)}</p>
                      )}
                      {/* Travel details */}
                      {hasTravel && (
                        <p className="text-xs text-stone-500 mt-1 font-medium">
                          {entry.travel_direction === 'arriving' ? '→ Arriving' : '← Departing'}
                          {' · '}{transportIcon}
                          {entry.transport_station ? ` ${entry.transport_station}` : ''}
                          {entry.transport_time ? ` · ${entry.transport_time}` : ''}
                        </p>
                      )}
                      {/* Guest invited by */}
                      {entry.type === 'guest' && entry.invited_by && (
                        <p className="text-xs text-stone-400 mt-0.5">via {entry.invited_by}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={onAddEvent}
            className="w-full py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 active:bg-stone-900 transition-colors"
          >
            + Add event
          </button>
        </div>
      </div>
    </div>
  )
}
