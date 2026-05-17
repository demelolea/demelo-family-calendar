'use client'

import { useState } from 'react'
import { Guest, AIX_ROOMS, PERSON_LABELS } from '@/lib/types'
import { supabase } from '@/lib/supabase'

interface GuestVisitsProps {
  guests: Guest[]
  onRefresh: () => void
}

const FAMILY_MEMBER_NAMES = ['Jim', 'Isabelle', 'Elissa', 'Ines', 'Lea']

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function GuestVisits({ guests, onRefresh }: GuestVisitsProps) {
  const [showForm, setShowForm]       = useState(false)
  const [guestName, setGuestName]     = useState('')
  const [house, setHouse]             = useState<'aix' | 'geneva'>('aix')
  const [arrivalDate, setArrivalDate] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [invitedBy, setInvitedBy]     = useState('')
  const [allocatedRoom, setAllocatedRoom] = useState('')
  const [loading, setLoading]         = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const sorted = [...guests].sort((a, b) => a.arrival_date.localeCompare(b.arrival_date))
  const active   = sorted.filter(g => g.arrival_date <= today && g.departure_date >= today)
  const upcoming = sorted.filter(g => g.arrival_date > today)
  const past     = sorted.filter(g => g.departure_date < today).reverse()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestName.trim() || !arrivalDate || !departureDate) return
    setSaveError(null)
    setLoading(true)

    // Build payload — only include allocated_room when it has a value,
    // so a missing column (schema_updates_v3.sql not yet run) doesn't
    // kill the whole insert.
    const payload: Record<string, unknown> = {
      guest_name:     guestName.trim(),
      house,
      arrival_date:   arrivalDate,
      departure_date: departureDate,
      invited_by:     invitedBy || null,
    }
    if (house === 'aix' && allocatedRoom) {
      payload.allocated_room = allocatedRoom
    }

    const { error } = await supabase.from('guests').insert(payload)
    setLoading(false)

    if (error) {
      console.error('Guest insert failed:', error)
      setSaveError(error.message)
      return   // keep form open so user can see the error
    }

    setShowForm(false)
    setGuestName('')
    setArrivalDate('')
    setDepartureDate('')
    setInvitedBy('')
    setAllocatedRoom('')
    onRefresh()
  }

  const GuestCard = ({ guest, badge }: { guest: Guest; badge?: string }) => (
    <div className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 bg-stone-400" />
          <div>
            <p className="text-sm font-semibold text-stone-800">{guest.guest_name}</p>
            {guest.invited_by && (
              <p className="text-xs text-stone-400 mt-0.5">via {guest.invited_by}</p>
            )}
            <p className="text-xs text-stone-400 mt-0.5">
              {guest.house === 'aix' ? '🏠 Aix-en-Provence' : '🏔️ Geneva'}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">
              {formatDate(guest.arrival_date)} – {formatDate(guest.departure_date)}
            </p>
          </div>
        </div>
        {badge && (
          <span className="text-[10px] font-semibold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full flex-shrink-0">{badge}</span>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-stone-800">Guest Visits</h2>
          <p className="text-sm text-stone-400 mt-0.5">Visitors to Aix & Geneva</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="px-3 py-1.5 bg-stone-800 text-white text-sm rounded-xl hover:bg-stone-700 active:bg-stone-900 transition-colors font-medium">
          + Add guest
        </button>
      </div>

      {showForm && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">New guest visit</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Guest name *"
              autoFocus
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
            />

            {/* Invited by */}
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">Whose friend / invited by</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setInvitedBy('')}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${!invitedBy ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 bg-white hover:bg-stone-50'}`}
                >
                  Unspecified
                </button>
                {FAMILY_MEMBER_NAMES.map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setInvitedBy(name)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${invitedBy === name ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 bg-white hover:bg-stone-50'}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* House */}
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">House</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setHouse('aix')} className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${house === 'aix' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-100 bg-white'}`}>🏠 Aix</button>
                <button type="button" onClick={() => { setHouse('geneva'); setAllocatedRoom('') }} className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${house === 'geneva' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-100 bg-white'}`}>🏔️ Geneva</button>
              </div>
            </div>

            {/* Room allocation (Aix only) */}
            {house === 'aix' && (
              <div>
                <label className="block text-xs text-stone-400 mb-1.5">Allocate to room (optional)</label>
                <select
                  value={allocatedRoom}
                  onChange={e => setAllocatedRoom(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
                >
                  <option value="">No room yet</option>
                  {AIX_ROOMS.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Arrives</label>
                <input type="date" value={arrivalDate} onChange={e => { setArrivalDate(e.target.value); if (!departureDate) setDepartureDate(e.target.value) }} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Departs</label>
                <input type="date" value={departureDate} min={arrivalDate} onChange={e => setDepartureDate(e.target.value)} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors" />
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                Save failed: {saveError}
              </p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowForm(false); setSaveError(null) }} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-white transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50">{loading ? 'Saving…' : 'Add guest'}</button>
            </div>
          </form>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Here now</p>
          {active.map(g => <GuestCard key={g.id} guest={g} badge="Here" />)}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Upcoming</p>
          {upcoming.map(g => <GuestCard key={g.id} guest={g} />)}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2 opacity-50">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Past</p>
          {past.slice(0, 5).map(g => <GuestCard key={g.id} guest={g} />)}
        </div>
      )}

      {guests.length === 0 && !showForm && (
        <div className="text-center py-16 text-stone-400 text-sm italic">No guests scheduled.</div>
      )}
    </div>
  )
}
