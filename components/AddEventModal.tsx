'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FAMILY_MEMBERS, TRANSPORT_ICONS } from '@/lib/types'

interface AddEventModalProps {
  initialDate?: string
  onClose: () => void
  onSave: () => void
}

const TRANSPORT_OPTIONS = [
  { value: 'flight', label: '✈ Flight' },
  { value: 'train',  label: '🚂 Train' },
  { value: 'car',    label: '🚗 Car' },
  { value: 'other',  label: '🚌 Other' },
]

export default function AddEventModal({ initialDate = '', onClose, onSave }: AddEventModalProps) {
  const [title, setTitle] = useState('')
  const [person, setPerson] = useState('jim')
  const [startDate, setStartDate] = useState(initialDate)
  const [endDate, setEndDate] = useState(initialDate)
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showTravel, setShowTravel] = useState(false)
  const [travelDir, setTravelDir] = useState<'arriving' | 'departing'>('arriving')
  const [transportType, setTransportType] = useState('flight')
  const [station, setStation] = useState('')
  const [travelTime, setTravelTime] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate || !endDate) {
      setError('Please fill in title and dates.')
      return
    }
    if (endDate < startDate) {
      setError('End date must be on or after start date.')
      return
    }
    setLoading(true)
    const { error: err } = await supabase.from('events').insert({
      title: title.trim(),
      person,
      start_date: startDate,
      end_date: endDate,
      location: location.trim() || null,
      travel_direction:  showTravel ? travelDir : null,
      transport_type:    showTravel ? transportType : null,
      transport_station: showTravel && station.trim() ? station.trim() : null,
      transport_time:    showTravel && travelTime ? travelTime : null,
    })
    setLoading(false)
    if (err) setError(err.message)
    else onSave()
  }

  return (
    <div
      className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-stone-800">New Event</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 transition-colors text-lg">×</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Event title"
                autoFocus
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Who</label>
              <select
                value={person}
                onChange={e => setPerson(e.target.value)}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
              >
                {FAMILY_MEMBERS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); if (!endDate || e.target.value > endDate) setEndDate(e.target.value) }}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">To</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
              />
            </div>

            {/* Travel details toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowTravel(v => !v)}
                className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1.5 transition-colors"
              >
                <span className="text-[10px]">{showTravel ? '▾' : '▸'}</span>
                Travel details
              </button>

              {showTravel && (
                <div className="mt-3 space-y-2.5 pl-3 border-l-2 border-stone-100">
                  {/* Direction */}
                  <div className="grid grid-cols-2 gap-2">
                    {(['arriving', 'departing'] as const).map(dir => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => setTravelDir(dir)}
                        className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                          travelDir === dir
                            ? 'bg-stone-800 text-white border-stone-800'
                            : 'border-stone-200 text-stone-600 bg-stone-50 hover:bg-stone-100'
                        }`}
                      >
                        {dir === 'arriving' ? '→ Arriving' : '← Departing'}
                      </button>
                    ))}
                  </div>

                  {/* Transport type */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {TRANSPORT_OPTIONS.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTransportType(t.value)}
                        className={`py-2 rounded-xl text-xs border transition-colors ${
                          transportType === t.value
                            ? 'bg-stone-800 text-white border-stone-800'
                            : 'border-stone-200 text-stone-600 bg-stone-50 hover:bg-stone-100'
                        }`}
                      >
                        {t.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>

                  {/* Station / airport */}
                  <input
                    type="text"
                    value={station}
                    onChange={e => setStation(e.target.value)}
                    placeholder={transportType === 'flight' ? 'Airport (e.g. NCE)' : transportType === 'train' ? 'Station' : 'Starting point'}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
                  />

                  {/* Time */}
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1">Time</label>
                    <input
                      type="time"
                      value={travelTime}
                      onChange={e => setTravelTime(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 active:bg-stone-100 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-50">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
