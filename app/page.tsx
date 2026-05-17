'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Event, Location, PhoebeSchedule, Guest, RoomAllocation, Stay, TripRsvp } from '@/lib/types'
import Calendar from '@/components/Calendar'
import LocationOverview from '@/components/LocationOverview'
import MySchedule from '@/components/MySchedule'
import FamilyTrips from '@/components/FamilyTrips'
import PhoebeTab from '@/components/PhoebeTab'
import GuestVisits from '@/components/GuestVisits'
import AixHouse from '@/components/AixHouse'
import WhoAreYou from '@/components/WhoAreYou'

type Tab = 'calendar' | 'overview' | 'schedule' | 'trips' | 'phoebe' | 'guests' | 'aix'

const TABS: { id: Tab; label: string }[] = [
  { id: 'calendar',  label: 'Calendar'    },
  { id: 'overview',  label: 'Overview'    },
  { id: 'schedule',  label: 'My Schedule' },
  { id: 'trips',     label: 'Trips'       },
  { id: 'phoebe',    label: '🐾 Phoebe'  },
  { id: 'guests',    label: 'Guests'      },
  { id: 'aix',       label: 'Aix Rooms'  },
]

const WIDE_TABS: Tab[] = ['overview', 'aix']

export default function Home() {
  const [tab, setTab]           = useState<Tab>('calendar')
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [mounted, setMounted]   = useState(false)

  const [events, setEvents]                 = useState<Event[]>([])
  const [locations, setLocations]           = useState<Location[]>([])
  const [phoebeSchedule, setPhoebeSchedule] = useState<PhoebeSchedule[]>([])
  const [guests, setGuests]                 = useState<Guest[]>([])
  const [roomAllocations, setRoomAllocations] = useState<RoomAllocation[]>([])
  const [stays, setStays]                   = useState<Stay[]>([])
  const [tripRsvps, setTripRsvps]           = useState<TripRsvp[]>([])
  const [loading, setLoading]               = useState(true)
  const [connected, setConnected]           = useState(false)

  // SSR-safe: read identity from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem('demelo_identity')
    if (saved) setCurrentUser(saved)
    setMounted(true)
  }, [])

  const handleSelectUser = (key: string) => {
    localStorage.setItem('demelo_identity', key)
    setCurrentUser(key)
  }

  const fetchAll = useCallback(async () => {
    const [evRes, locRes, phRes, guRes, rmRes, stRes, rsvpRes] = await Promise.all([
      supabase.from('events').select('*').order('start_date'),
      supabase.from('locations').select('*'),
      supabase.from('phoebe_schedule').select('*').order('start_date'),
      supabase.from('guests').select('*').order('arrival_date'),
      supabase.from('room_allocations').select('*').order('start_date'),
      supabase.from('stays').select('*').order('start_date'),
      supabase.from('trip_rsvps').select('*'),
    ])
    if (evRes.data)   setEvents(evRes.data)
    if (locRes.data)  setLocations(locRes.data)
    if (phRes.data)   setPhoebeSchedule(phRes.data)
    if (guRes.data)   setGuests(guRes.data)
    if (rmRes.data)   setRoomAllocations(rmRes.data)
    if (stRes.data)   setStays(stRes.data)
    if (rsvpRes.data) setTripRsvps(rsvpRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()

    const channel = supabase
      .channel('realtime-family')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' },           fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' },         fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phoebe_schedule' },   fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' },            fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_allocations' },  fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stays' },             fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_rsvps' },        fetchAll)
      .subscribe(status => setConnected(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

  // Don't render until localStorage is read (avoids flash)
  if (!mounted) return null

  // Identity picker — show if no user selected yet
  if (!currentUser) {
    return <WhoAreYou onSelect={handleSelectUser} />
  }

  const isWide = WIDE_TABS.includes(tab)

  return (
    <div className="min-h-screen bg-[#F8F6F2]">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <span className="text-[15px] font-semibold text-stone-800 tracking-tight">De Melo</span>
            <div className="flex items-center gap-3">
              {/* Identity badge — tap to switch */}
              <button
                onClick={() => {
                  localStorage.removeItem('demelo_identity')
                  setCurrentUser(null)
                }}
                className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
                title="Switch identity"
              >
                {currentUser.charAt(0).toUpperCase() + currentUser.slice(1)} ↩
              </button>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${connected ? 'bg-green-400' : 'bg-stone-300'}`}
                  title={connected ? 'Real-time connected' : 'Connecting…'}
                />
                <span className="text-[11px] text-stone-400">{connected ? 'Live' : '…'}</span>
              </div>
            </div>
          </div>

          <div className="flex overflow-x-auto -mb-px tab-nav">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  'px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors flex-shrink-0',
                  tab === t.id
                    ? 'font-semibold text-stone-800 border-stone-800'
                    : 'font-normal text-stone-400 border-transparent hover:text-stone-600',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className={`mx-auto px-4 py-6 transition-all ${isWide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-stone-200 border-t-stone-400 rounded-full animate-spin" />
              <p className="text-sm text-stone-400">Loading…</p>
            </div>
          </div>
        ) : (
          <>
            {tab === 'calendar' && (
              <Calendar
                events={events}
                phoebeSchedule={phoebeSchedule}
                guests={guests}
                stays={stays}
                onRefresh={fetchAll}
              />
            )}
            {tab === 'overview' && (
              <LocationOverview
                events={events}
                locations={locations}
                phoebeSchedule={phoebeSchedule}
                stays={stays}
              />
            )}
            {tab === 'schedule' && (
              <MySchedule
                currentUser={currentUser}
                stays={stays}
                locations={locations}
                onRefresh={fetchAll}
              />
            )}
            {tab === 'trips' && (
              <FamilyTrips
                events={events}
                tripRsvps={tripRsvps}
                currentUser={currentUser}
                onRefresh={fetchAll}
              />
            )}
            {tab === 'phoebe' && (
              <PhoebeTab phoebeSchedule={phoebeSchedule} onRefresh={fetchAll} />
            )}
            {tab === 'guests' && (
              <GuestVisits guests={guests} onRefresh={fetchAll} />
            )}
            {tab === 'aix' && (
              <AixHouse
                roomAllocations={roomAllocations}
                stays={stays}
                guests={guests}
                onRefresh={fetchAll}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
