'use client'

import { useMemo } from 'react'
import { Event, Location, PhoebeSchedule, Stay, PERSON_COLORS, PERSON_LABELS, hexToRgba } from '@/lib/types'

interface LocationOverviewProps {
  events: Event[]
  locations: Location[]
  phoebeSchedule: PhoebeSchedule[]
  stays: Stay[]
}

const PEOPLE = ['jim', 'isabelle', 'elissa', 'ines', 'lea']
const DAY_W = 34
const NAME_W = 92

const MONTHS = [
  { label: 'May',    days: 31, month: 4 },
  { label: 'June',   days: 30, month: 5 },
  { label: 'July',   days: 31, month: 6 },
  { label: 'August', days: 31, month: 7 },
]

function generateDays(): Date[] {
  const days: Date[] = []
  for (const m of MONTHS) {
    for (let d = 1; d <= m.days; d++) {
      days.push(new Date(2026, m.month, d))
    }
  }
  return days
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function abbr(loc: string): string {
  if (!loc || loc === '—') return ''
  const l = loc.toLowerCase()
  if (l.includes('aix')) return 'Aix'
  if (l.includes('geneva') || l.includes('genève')) return 'GVA'
  if (l.includes('cape town') || l.includes('capetown')) return 'CPT'
  if (l.includes('travel')) return '✈'
  if (l.includes('london')) return 'LDN'
  if (l.includes('paris')) return 'PAR'
  if (l.includes('monaco')) return 'MCO'
  if (l.includes('dublin')) return 'DUB'
  return loc.slice(0, 3).toUpperCase()
}

interface CellStyle { background: string; color: string }
function cellStyle(loc: string): CellStyle {
  const l = loc.toLowerCase()
  if (l.includes('aix'))                                 return { background: '#FEF3C7', color: '#92400E' }
  if (l.includes('geneva') || l.includes('genève'))      return { background: '#DBEAFE', color: '#1E40AF' }
  if (l.includes('cape town') || l.includes('capetown')) return { background: '#FCE7F3', color: '#9D174D' }
  if (l.includes('travel'))                              return { background: '#D1FAE5', color: '#065F46' }
  if (l.includes('london'))                              return { background: '#F3F4F6', color: '#374151' }
  if (l.includes('paris'))                               return { background: '#EDE9FE', color: '#5B21B6' }
  if (l.includes('monaco'))                              return { background: '#FEE2E2', color: '#991B1B' }
  if (l.includes('dublin'))                              return { background: '#ECFDF5', color: '#064E3B' }
  if (!loc || loc === '—')                               return { background: '#FAFAFA',  color: '#D1D5DB' }
  return { background: '#F5F5F4', color: '#78716C' }
}

const LEGEND_ITEMS: { label: string; loc: string }[] = [
  { label: 'Aix', loc: 'Aix-en-Provence' },
  { label: 'Geneva', loc: 'Geneva' },
  { label: 'Cape Town', loc: 'Cape Town' },
  { label: 'Travelling', loc: 'Travelling' },
]

export default function LocationOverview({ events, locations, phoebeSchedule, stays }: LocationOverviewProps) {
  const todayStr = toDateStr(new Date())
  const days = useMemo(generateDays, [])

  const grid = useMemo(() => {
    const result: Record<string, Record<string, string>> = {}

    for (const person of PEOPLE) {
      result[person] = {}
      for (const day of days) {
        const ds = toDateStr(day)
        const personal = events.find(e =>
          e.person === person && e.start_date <= ds && e.end_date >= ds && e.location,
        )
        if (personal) { result[person][ds] = personal.location!; continue }

        const personalStay = stays.find(s =>
          s.person === person && s.start_date <= ds && s.end_date >= ds,
        )
        if (personalStay) { result[person][ds] = personalStay.location; continue }

        const family = events.find(e =>
          e.person === 'family' && e.start_date <= ds && e.end_date >= ds && e.location,
        )
        if (family) { result[person][ds] = family.location!; continue }

        result[person][ds] = locations.find(l => l.person === person)?.current_location ?? '—'
      }
    }

    result['phoebe'] = {}
    for (const day of days) {
      const ds = toDateStr(day)
      const sched = phoebeSchedule.find(p => p.start_date <= ds && p.end_date >= ds)
      result['phoebe'][ds] = sched?.with_whom ?? ''
    }

    return result
  }, [events, locations, phoebeSchedule, stays, days])

  const totalWidth = NAME_W + DAY_W * days.length

  const allPeople = [...PEOPLE, 'phoebe']

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-stone-800">Family Overview</h2>
        <p className="text-sm text-stone-400 mt-0.5">
          Where everyone is, May – August 2026. Locations inferred from calendar events.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {LEGEND_ITEMS.map(({ label, loc }) => {
          const s = cellStyle(loc)
          return (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border" style={{ background: s.background, borderColor: s.color + '50' }} />
              <span className="text-xs text-stone-500">{label}</span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm border border-stone-200 bg-stone-100" />
          <span className="text-xs text-stone-500">Phoebe custody shown by person colour</span>
        </div>
      </div>

      {/* Grid */}
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
                const isTdy = toDateStr(day) === todayStr
                return (
                  <div
                    key={i}
                    className="flex-shrink-0 flex items-center justify-center border-r border-stone-50"
                    style={{
                      width: DAY_W,
                      background: isTdy ? '#FDE68A' : isWknd ? '#FAFAF9' : '',
                    }}
                  >
                    <span className={`text-[9px] ${isTdy ? 'font-bold text-amber-700' : 'text-stone-400'}`}>
                      {day.getDate()}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Person rows */}
            {allPeople.map((person, rowIdx) => {
              const isPhoebe = person === 'phoebe'
              const isLast = rowIdx === allPeople.length - 1
              return (
                <div key={person} className={`flex ${isLast ? '' : 'border-b border-stone-100'}`}>
                  {/* Sticky name cell */}
                  <div
                    className="flex-shrink-0 sticky left-0 z-10 bg-white border-r border-stone-100 flex items-center gap-2 px-3"
                    style={{ width: NAME_W, height: 38 }}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PERSON_COLORS[person] }}
                    />
                    <span className="text-xs font-medium text-stone-700 whitespace-nowrap">
                      {isPhoebe ? 'Phoebe 🐾' : PERSON_LABELS[person]}
                    </span>
                  </div>

                  {/* Day cells */}
                  {days.map((day, i) => {
                    const ds = toDateStr(day)
                    const isWknd = day.getDay() === 0 || day.getDay() === 6
                    const isTdy = ds === todayStr

                    if (isPhoebe) {
                      const custodian = grid['phoebe']?.[ds] ?? ''
                      const personKey = custodian.toLowerCase()
                      const personColor = PERSON_COLORS[personKey] ?? PERSON_COLORS.phoebe
                      const bg = custodian ? hexToRgba(personColor, isTdy ? 0.45 : 0.22) : isTdy ? '#FDE68A' : isWknd ? '#FAFAF9' : ''
                      return (
                        <div
                          key={i}
                          className="flex-shrink-0 flex items-center justify-center border-r border-stone-50"
                          style={{ width: DAY_W, height: 38, background: bg }}
                          title={custodian ? `Phoebe with ${custodian}` : 'No custody logged'}
                        >
                          {custodian && (
                            <span style={{ color: personColor, fontSize: 8, fontWeight: 700, letterSpacing: -0.2 }}>
                              {custodian.slice(0, 3).toUpperCase()}
                            </span>
                          )}
                        </div>
                      )
                    }

                    const loc = grid[person]?.[ds] ?? '—'
                    const s = cellStyle(loc)
                    const bg = isTdy ? '#FDE68A' : isWknd ? '#FAFAF9' : s.background
                    return (
                      <div
                        key={i}
                        className="flex-shrink-0 flex items-center justify-center border-r border-stone-50"
                        style={{ width: DAY_W, height: 38, background: bg }}
                        title={`${PERSON_LABELS[person]} · ${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${loc}`}
                      >
                        <span style={{ color: isTdy ? '#92400E' : s.color, fontSize: 8, fontWeight: 600, letterSpacing: -0.2 }}>
                          {abbr(loc)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-xs text-stone-400">
        Tip: add events with a location to any person's calendar to populate their row automatically.
      </p>
    </div>
  )
}
