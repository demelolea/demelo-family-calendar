'use client'

import { useState } from 'react'
import { Event, TripRsvp, PERSON_COLORS, PERSON_LABELS, FAMILY_KEYS } from '@/lib/types'
import { supabase } from '@/lib/supabase'

interface FamilyTripsProps {
  events: Event[]
  tripRsvps: TripRsvp[]
  currentUser: string
  onRefresh: () => void
}

const TRIP_TYPES = [
  { value: 'equestrian',  label: '🏇 Equestrian' },
  { value: 'family_trip', label: '✈️ Family Trip' },
  { value: 'other',       label: '📅 Other' },
]

const RSVP_OPTIONS: { value: TripRsvp['response']; label: string }[] = [
  { value: 'yes',   label: '✓ Yes'   },
  { value: 'maybe', label: '? Maybe' },
  { value: 'no',    label: '✕ No'    },
]

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function tripTypeLabel(type?: string) {
  return TRIP_TYPES.find(t => t.value === type)?.label ?? ''
}

export default function FamilyTrips({ events, tripRsvps, currentUser, onRefresh }: FamilyTripsProps) {
  const [showForm, setShowForm]   = useState(false)
  const [name, setName]           = useState('')
  const [tripType, setTripType]   = useState('family_trip')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [location, setLocation]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const trips = events
    .filter(e => e.person === 'family')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  const upcoming = trips.filter(e => e.end_date >= today)
  const past     = trips.filter(e => e.end_date < today).reverse()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !startDate || !endDate) return
    setLoading(true)
    await supabase.from('events').insert({
      title:     name.trim(),
      person:    'family',
      start_date: startDate,
      end_date:   endDate,
      location:   location.trim() || null,
      trip_type:  tripType,
    })
    setLoading(false)
    setShowForm(false)
    setName(''); setStartDate(''); setEndDate(''); setLocation(''); setTripType('family_trip')
    onRefresh()
  }

  const handleRsvp = async (tripId: string, response: TripRsvp['response']) => {
    setRsvpLoading(tripId + response)
    await supabase.from('trip_rsvps').upsert(
      { trip_id: tripId, person: currentUser, response },
      { onConflict: 'trip_id,person' },
    )
    setRsvpLoading(null)
    onRefresh()
  }

  const TripCard = ({ trip, dim }: { trip: Event; dim?: boolean }) => {
    const isActive  = trip.start_date <= today && trip.end_date >= today
    const myRsvp    = tripRsvps.find(r => r.trip_id === trip.id && r.person === currentUser)
    const confirmed = tripRsvps.filter(r => r.trip_id === trip.id && r.response === 'yes').length
    const maybe     = tripRsvps.filter(r => r.trip_id === trip.id && r.response === 'maybe').length

    return (
      <div
        className={[
          'bg-white border rounded-2xl p-4 shadow-sm transition-opacity',
          isActive ? 'border-blue-200' : 'border-stone-100',
          dim ? 'opacity-50' : '',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
              style={{ backgroundColor: PERSON_COLORS.family }}
            />
            <div className="min-w-0">
              <p className="font-semibold text-stone-800 text-sm leading-snug">{trip.title}</p>
              <p className="text-xs text-stone-400 mt-1">
                {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
              </p>
              {trip.location && (
                <p className="text-xs text-stone-400 mt-0.5">📍 {trip.location}</p>
              )}
              {trip.trip_type && (
                <p className="text-xs text-stone-400 mt-0.5">{tripTypeLabel(trip.trip_type)}</p>
              )}
            </div>
          </div>
          {isActive && (
            <span className="text-[10px] font-semibold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full flex-shrink-0">
              Now
            </span>
          )}
        </div>

        {/* RSVP section */}
        <div className="mt-3 pt-3 border-t border-stone-100">
          {/* Who's going summary */}
          {tripRsvps.filter(r => r.trip_id === trip.id).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FAMILY_KEYS.map(person => {
                const rsvp = tripRsvps.find(r => r.trip_id === trip.id && r.person === person)
                if (!rsvp) return null
                const dotColor = PERSON_COLORS[person]
                const opacity  = rsvp.response === 'no' ? 0.3 : rsvp.response === 'maybe' ? 0.6 : 1
                return (
                  <div
                    key={person}
                    className="flex items-center gap-1 text-[10px] text-stone-500"
                    title={`${PERSON_LABELS[person]}: ${rsvp.response}`}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dotColor, opacity }}
                    />
                    <span style={{ opacity }}>{PERSON_LABELS[person]}</span>
                    {rsvp.response === 'maybe' && <span className="text-stone-300">?</span>}
                    {rsvp.response === 'no'    && <span className="text-stone-300">✕</span>}
                  </div>
                )
              })}
            </div>
          )}

          {/* Count summary */}
          {(confirmed > 0 || maybe > 0) && (
            <p className="text-[10px] text-stone-400 mb-2">
              {confirmed > 0 && `${confirmed} confirmed`}
              {confirmed > 0 && maybe > 0 && ' · '}
              {maybe > 0 && `${maybe} maybe`}
            </p>
          )}

          {/* Current user's RSVP buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-stone-400 mr-0.5">You:</span>
            {RSVP_OPTIONS.map(opt => {
              const isSelected = myRsvp?.response === opt.value
              const isLoading  = rsvpLoading === trip.id + opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => handleRsvp(trip.id, opt.value)}
                  disabled={!!rsvpLoading}
                  className={[
                    'px-2.5 py-1 rounded-lg text-[11px] border transition-colors font-medium',
                    isSelected
                      ? opt.value === 'yes'   ? 'bg-green-700  text-white border-green-700'
                      : opt.value === 'maybe' ? 'bg-amber-600  text-white border-amber-600'
                      :                         'bg-red-600    text-white border-red-600'
                      : 'border-stone-200 text-stone-500 bg-white hover:bg-stone-50',
                    isLoading ? 'opacity-50' : '',
                  ].join(' ')}
                >
                  {isLoading ? '…' : opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-800">Family Trips</h2>
          <p className="text-sm text-stone-400 mt-0.5">Equestrian events & family travel</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-3 py-1.5 bg-stone-800 text-white text-sm rounded-xl hover:bg-stone-700 active:bg-stone-900 transition-colors font-medium"
        >
          + Add trip
        </button>
      </div>

      {showForm && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">New trip</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Trip name *"
              autoFocus
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
            />
            <select
              value={tripType}
              onChange={e => setTripType(e.target.value)}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
            >
              {TRIP_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
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
                <label className="block text-xs text-stone-400 mb-1">To</label>
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
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Location (optional)"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Add trip'}
              </button>
            </div>
          </form>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Upcoming</p>
          {upcoming.map(trip => <TripCard key={trip.id} trip={trip} />)}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Past</p>
          {past.map(trip => <TripCard key={trip.id} trip={trip} dim />)}
        </div>
      )}

      {trips.length === 0 && !showForm && (
        <div className="text-center py-16 text-stone-400 text-sm italic">
          No trips planned yet.
        </div>
      )}
    </div>
  )
}
