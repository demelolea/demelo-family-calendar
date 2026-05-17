'use client'

import { useState } from 'react'
import { Location, PERSON_COLORS, PERSON_LABELS } from '@/lib/types'
import { supabase } from '@/lib/supabase'

interface PeopleLocationsProps {
  locations: Location[]
  onRefresh: () => void
}

const PEOPLE = ['jim', 'isabelle', 'elissa', 'ines', 'lea']

const LOCATION_OPTIONS = [
  { value: 'Aix-en-Provence', label: '🏠 Aix-en-Provence' },
  { value: 'Geneva', label: '🏔️ Geneva' },
  { value: 'Cape Town', label: '🌍 Cape Town' },
  { value: 'London', label: '🌧️ London' },
  { value: 'Paris', label: '🗼 Paris' },
  { value: 'Monaco', label: '🏁 Monaco' },
  { value: 'Dublin', label: '🍀 Dublin' },
  { value: 'Travelling', label: '✈️ Travelling' },
  { value: '__custom__', label: 'Other…' },
]

function locationEmoji(loc: string) {
  const l = loc.toLowerCase()
  if (l.includes('aix')) return '🏠'
  if (l.includes('geneva') || l.includes('genève')) return '🏔️'
  if (l.includes('cape town')) return '🌍'
  if (l.includes('travel')) return '✈️'
  if (l.includes('london')) return '🌧️'
  if (l.includes('paris')) return '🗼'
  if (l.includes('monaco')) return '🏁'
  if (l.includes('dublin')) return '🍀'
  return '📍'
}

function isAtLocation(loc: string, keyword: string) {
  return loc.toLowerCase().includes(keyword.toLowerCase())
}

export default function PeopleLocations({ locations, onRefresh }: PeopleLocationsProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [selectValue, setSelectValue] = useState('')
  const [customValue, setCustomValue] = useState('')
  const [loading, setLoading] = useState(false)

  const getLocation = (person: string) =>
    locations.find(l => l.person === person)?.current_location ?? '—'

  const startEdit = (person: string) => {
    const current = getLocation(person)
    const known = LOCATION_OPTIONS.find(o => o.value === current && o.value !== '__custom__')
    setSelectValue(known ? current : '__custom__')
    setCustomValue(known ? '' : current)
    setEditing(person)
  }

  const saveLocation = async (person: string) => {
    const newLoc = selectValue === '__custom__' ? customValue.trim() : selectValue
    if (!newLoc) return
    setLoading(true)
    await supabase.from('locations').upsert(
      { person, current_location: newLoc, updated_at: new Date().toISOString() },
      { onConflict: 'person' }
    )
    setLoading(false)
    setEditing(null)
    onRefresh()
  }

  const atAix = PEOPLE.filter(p => isAtLocation(getLocation(p), 'aix'))
  const atGeneva = PEOPLE.filter(p =>
    isAtLocation(getLocation(p), 'geneva') || isAtLocation(getLocation(p), 'genève')
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-stone-800">Family Whereabouts</h2>
        <p className="text-sm text-stone-400 mt-0.5">Where is everyone right now?</p>
      </div>

      {/* House summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-400 mb-2.5">🏠 Aix-en-Provence</p>
          {atAix.length === 0 ? (
            <p className="text-xs text-stone-300 italic">No one here</p>
          ) : (
            <div className="space-y-1.5">
              {atAix.map(p => (
                <div key={p} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PERSON_COLORS[p] }} />
                  <span className="text-sm text-stone-700">{PERSON_LABELS[p]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-400 mb-2.5">🏔️ Geneva</p>
          {atGeneva.length === 0 ? (
            <p className="text-xs text-stone-300 italic">No one here</p>
          ) : (
            <div className="space-y-1.5">
              {atGeneva.map(p => (
                <div key={p} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PERSON_COLORS[p] }} />
                  <span className="text-sm text-stone-700">{PERSON_LABELS[p]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Individual cards */}
      <div className="space-y-2">
        {PEOPLE.map(person => {
          const loc = getLocation(person)
          const isEditing = editing === person

          return (
            <div
              key={person}
              className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: PERSON_COLORS[person] }}
                  >
                    {PERSON_LABELS[person][0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">{PERSON_LABELS[person]}</p>
                    {!isEditing && (
                      <p className="text-sm text-stone-500 mt-0.5">
                        {locationEmoji(loc)} {loc}
                      </p>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => startEdit(person)}
                    className="text-xs text-stone-400 hover:text-stone-600 border border-stone-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Update
                  </button>
                )}
              </div>

              {isEditing && (
                <div className="mt-3 space-y-2">
                  <select
                    value={selectValue}
                    onChange={e => setSelectValue(e.target.value)}
                    className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
                  >
                    {LOCATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {selectValue === '__custom__' && (
                    <input
                      type="text"
                      value={customValue}
                      onChange={e => setCustomValue(e.target.value)}
                      placeholder="Enter location"
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(null)}
                      className="flex-1 py-2 border border-stone-200 rounded-xl text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveLocation(person)}
                      disabled={loading}
                      className="flex-1 py-2 bg-stone-800 text-white rounded-xl text-xs font-medium hover:bg-stone-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
