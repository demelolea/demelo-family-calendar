'use client'

import { useState, useMemo, useEffect } from 'react'
import { Event, Location, PhoebeSchedule, Guest, Stay, PERSON_COLORS, PERSON_LABELS, hexToRgba } from '@/lib/types'

interface LocationOverviewProps {
  events: Event[]
  locations: Location[]
  phoebeSchedule: PhoebeSchedule[]
  stays: Stay[]
  guests: Guest[]
}

type GridView = 'fortnight' | 'month' | 'summer'

const PEOPLE = ['jim', 'isabelle', 'elissa', 'ines', 'lea']
const DAY_W  = 34
const NAME_W = 92

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function generateDays(view: GridView, today: Date): Date[] {
  const days: Date[] = []

  if (view === 'summer') {
    const MONTHS = [
      { month: 4, days: 31 }, // May
      { month: 5, days: 30 }, // June
      { month: 6, days: 31 }, // July
      { month: 7, days: 31 }, // August
    ]
    for (const m of MONTHS) {
      for (let d = 1; d <= m.days; d++) {
        days.push(new Date(2026, m.month, d))
      }
    }
  } else if (view === 'month') {
    const year  = today.getFullYear()
    const month = today.getMonth()
    const last  = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= last; d++) {
      days.push(new Date(year, month, d))
    }
  } else {
    // fortnight — today + next 13 days
    for (let d = 0; d < 14; d++) {
      const day = new Date(today)
      day.setDate(today.getDate() + d)
      days.push(day)
    }
  }

  return days
}

function computeMonthGroups(days: Date[]): { label: string; count: number }[] {
  if (days.length === 0) return []
  const groups: { label: string; count: number }[] = []
  let cur   = days[0].toLocaleDateString('en-GB', { month: 'long' })
  let count = 1
  for (let i = 1; i < days.length; i++) {
    const label = days[i].toLocaleDateString('en-GB', { month: 'long' })
    if (label === cur) { count++ }
    else { groups.push({ label: cur, count }); cur = label; count = 1 }
  }
  groups.push({ label: cur, count })
  return groups
}

function abbr(loc: string): string {
  if (!loc || loc === '—') return ''
  const l = loc.toLowerCase()
  if (l.includes('aix'))                              return 'Aix'
  if (l.includes('geneva') || l.includes('genève'))  return 'GVA'
  if (l.includes('cape town') || l.includes('capetown')) return 'CPT'
  if (l.includes('travel'))                           return '✈'
  if (l.includes('london'))                           return 'LDN'
  if (l.includes('paris'))                            return 'PAR'
  if (l.includes('monaco'))                           return 'MCO'
  if (l.includes('dublin'))                           return 'DUB'
  return loc.slice(0, 3).toUpperCase()
}

interface CellStyle { background: string; color: string }
function cellStyle(loc: string): CellStyle {
  const l = loc.toLowerCase()
  if (l.includes('aix'))                              return { background: '#FEF3C7', color: '#92400E' }
  if (l.includes('geneva') || l.includes('genève'))  return { background: '#DBEAFE', color: '#1E40AF' }
  if (l.includes('cape town') || l.includes('capetown')) return { background: '#FCE7F3', color: '#9D174D' }
  if (l.includes('travel'))                           return { background: '#D1FAE5', color: '#065F46' }
  if (l.includes('london'))                           return { background: '#F3F4F6', color: '#374151' }
  if (l.includes('paris'))                            return { background: '#EDE9FE', color: '#5B21B6' }
  if (l.includes('monaco'))                           return { background: '#FEE2E2', color: '#991B1B' }
  if (l.includes('dublin'))                           return { background: '#ECFDF5', color: '#064E3B' }
  if (!loc || loc === '—')                            return { background: '#FAFAF8', color: '#D1D5DB' }
  return { background: '#F5F5F4', color: '#78716C' }
}

const LEGEND_ITEMS: { label: string; loc: string }[] = [
  { label: 'Aix',       loc: 'Aix-en-Provence' },
  { label: 'Geneva',    loc: 'Geneva'           },
  { label: 'Cape Town', loc: 'Cape Town'        },
  { label: 'Travelling', loc: 'Travelling'      },
]

const VIEW_OPTIONS: { id: GridView; label: string }[] = [
  { id: 'fortnight', label: 'Next 2 weeks' },
  { id: 'month',     label: 'This month'   },
  { id: 'summer',    label: 'Full summer'  },
]

export default function LocationOverview({ events, locations, phoebeSchedule, stays, guests }: LocationOverviewProps) {
  const todayDate = useMemo(() => new Date(), [])
  const todayStr  = toDateStr(todayDate)

  const [gridView, setGridView] = useState<GridView>('fortnight')
  const [copied,   setCopied]   = useState(false)

  // Restore saved view preference
  useEffect(() => {
    const saved = localStorage.getItem('demelo_grid_view') as GridView | null
    if (saved && ['fortnight', 'month', 'summer'].includes(saved)) {
      setGridView(saved)
    }
  }, [])

  const changeView = (v: GridView) => {
    setGridView(v)
    localStorage.setItem('demelo_grid_view', v)
  }

  const days         = useMemo(() => generateDays(gridView, todayDate), [gridView, todayDate])
  const monthGroups  = useMemo(() => computeMonthGroups(days), [days])
  const totalWidth   = NAME_W + DAY_W * days.length

  // Phoebe handover dates: date → "Prev → Next"
  const handoverMap = useMemo(() => {
    const sorted = [...phoebeSchedule].sort((a, b) => a.start_date.localeCompare(b.start_date))
    const map    = new Map<string, string>()
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].with_whom !== sorted[i - 1].with_whom) {
        map.set(sorted[i].start_date, `${sorted[i - 1].with_whom} → ${sorted[i].with_whom}`)
      }
    }
    return map
  }, [phoebeSchedule])

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
      const ds   = toDateStr(day)
      const sched = phoebeSchedule.find(p => p.start_date <= ds && p.end_date >= ds)
      result['phoebe'][ds] = sched?.with_whom ?? ''
    }

    return result
  }, [events, locations, phoebeSchedule, stays, days])

  // WhatsApp / clipboard week share
  const shareWeek = () => {
    const today = new Date(todayStr + 'T12:00:00')
    const dow   = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))

    const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })

    const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const lines: string[] = [
      `De Melo — ${fmtDay(weekDays[0])}–${fmtDay(weekDays[6])}`,
      '',
    ]

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    for (const person of PEOPLE) {
      const locs = weekDays.map(wd => {
        const ds = toDateStr(wd)
        const ev = events.find(e => e.person === person && e.start_date <= ds && e.end_date >= ds && e.location)
        if (ev) return abbr(ev.location!)
        const st = stays.find(s => s.person === person && s.start_date <= ds && s.end_date >= ds)
        if (st) return abbr(st.location)
        const fam = events.find(e => e.person === 'family' && e.start_date <= ds && e.end_date >= ds && e.location)
        if (fam) return abbr(fam.location!)
        return abbr(locations.find(l => l.person === person)?.current_location ?? '—')
      })

      // Compress into runs
      const runs: { loc: string; start: number; end: number }[] = []
      locs.forEach((loc, i) => {
        if (runs.length === 0 || runs[runs.length - 1].loc !== loc) {
          runs.push({ loc, start: i, end: i })
        } else {
          runs[runs.length - 1].end = i
        }
      })

      let summary: string
      if (runs.length === 1) {
        summary = runs[0].loc || '—'
      } else {
        summary = runs.map(r =>
          r.start === r.end
            ? `${r.loc || '—'} (${dayLabels[r.start]})`
            : `${r.loc || '—'} (${dayLabels[r.start]}–${dayLabels[r.end]})`
        ).join(', ')
      }
      lines.push(`📍 ${PERSON_LABELS[person]}: ${summary}`)
    }

    // Phoebe
    const phoebeDays = weekDays
      .map(wd => phoebeSchedule.find(p => p.start_date <= toDateStr(wd) && p.end_date >= toDateStr(wd))?.with_whom ?? '')
      .filter(Boolean)
    const uniquePhoebe = Array.from(new Set(phoebeDays))
    if (uniquePhoebe.length > 0) {
      lines.push(`🐾 Phoebe: with ${uniquePhoebe.join(' → ')}`)
    }

    // Guests this week
    const wStart = toDateStr(weekDays[0])
    const wEnd   = toDateStr(weekDays[6])
    const wGuests = guests.filter(g => g.arrival_date <= wEnd && g.departure_date >= wStart)
    if (wGuests.length > 0) {
      lines.push(`🏠 Guests: ${wGuests.map(g => g.guest_name).join(', ')}`)
    }

    lines.push('', '— De Melo Family Calendar')
    const text    = lines.join('\n')
    const encoded = encodeURIComponent(text)

    const isMobile = typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0)

    if (isMobile) {
      window.open(`https://wa.me/?text=${encoded}`, '_blank')
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      })
    }
  }

  const allPeople = [...PEOPLE, 'phoebe']

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold text-stone-800">Family Overview</h2>
          <p className="text-sm text-stone-400 mt-0.5">
            Where everyone is. Locations inferred from events &amp; stays.
          </p>
        </div>

        {/* View toggle + WhatsApp share */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-stone-200 overflow-hidden bg-white">
            {VIEW_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => changeView(opt.id)}
                className={[
                  'px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                  gridView === opt.id
                    ? 'bg-stone-800 text-white'
                    : 'text-stone-500 hover:bg-stone-50',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={shareWeek}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
              copied
                ? 'bg-green-700 text-white border-green-700'
                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50',
            ].join(' ')}
            title="Share this week's summary via WhatsApp (mobile) or copy (desktop)"
          >
            {copied ? '✓ Copied!' : (
              <>
                <span>📲</span>
                <span>Share week</span>
              </>
            )}
          </button>
        </div>
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
          <span className="text-xs text-stone-500">Phoebe — colour = custodian</span>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-2xl border border-stone-100 overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div style={{ minWidth: totalWidth }}>

            {/* Month headers — dynamic */}
            <div className="flex border-b border-stone-100">
              <div className="flex-shrink-0 sticky left-0 z-20 bg-stone-50 border-r border-stone-100" style={{ width: NAME_W }} />
              {monthGroups.map((mg, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 bg-stone-50 border-r border-stone-200 flex items-center justify-center"
                  style={{ width: DAY_W * mg.count }}
                >
                  <span className="text-[11px] font-semibold text-stone-500 py-2">{mg.label}</span>
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
                  <div
                    key={i}
                    className="flex-shrink-0 flex items-center justify-center border-r border-stone-50"
                    style={{ width: DAY_W, background: isTdy ? '#FDE68A' : isWknd ? '#FAFAF8' : '' }}
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
              const isLast   = rowIdx === allPeople.length - 1
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
                    const ds     = toDateStr(day)
                    const isWknd = day.getDay() === 0 || day.getDay() === 6
                    const isTdy  = ds === todayStr

                    if (isPhoebe) {
                      const custodian  = grid['phoebe']?.[ds] ?? ''
                      const personKey  = custodian.toLowerCase()
                      const personColor = PERSON_COLORS[personKey] ?? PERSON_COLORS.phoebe
                      const isHandover = handoverMap.has(ds)
                      const bg = custodian
                        ? hexToRgba(personColor, isTdy ? 0.45 : 0.22)
                        : isTdy ? '#FDE68A' : isWknd ? '#FAFAF8' : ''

                      return (
                        <div
                          key={i}
                          className="flex-shrink-0 flex items-center justify-center border-r border-stone-50 relative"
                          style={{
                            width: DAY_W,
                            height: 38,
                            background: bg,
                            // Amber left border on handover days
                            borderLeft: isHandover ? '2px solid #F59E0B' : undefined,
                          }}
                          title={
                            isHandover
                              ? `🐾 ${handoverMap.get(ds)}`
                              : custodian ? `Phoebe with ${custodian}` : 'No custody logged'
                          }
                        >
                          {custodian && (
                            <span style={{ color: personColor, fontSize: 8, fontWeight: 700, letterSpacing: -0.2 }}>
                              {custodian.slice(0, 3).toUpperCase()}
                            </span>
                          )}
                          {isHandover && (
                            <span
                              className="absolute top-0.5 right-0.5"
                              style={{ fontSize: 6, color: '#D97706', fontWeight: 700 }}
                            >
                              ↔
                            </span>
                          )}
                        </div>
                      )
                    }

                    const loc = grid[person]?.[ds] ?? '—'
                    const s   = cellStyle(loc)
                    const bg  = isTdy ? '#FDE68A' : isWknd ? '#FAFAF8' : s.background
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
