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
import InstallPrompt from '@/components/InstallPrompt'
import OnboardingTour from '@/components/OnboardingTour'

type Tab = 'calendar' | 'overview' | 'schedule' | 'trips' | 'phoebe' | 'guests' | 'aix'

const WIDE_TABS: Tab[] = ['overview', 'aix']
const VALID_USERS = ['jim', 'isabelle', 'elissa', 'ines', 'lea']

// Bottom nav — 4 primary + More
const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'overview', label: 'Overview', icon: '🗺️' },
  { id: 'schedule', label: 'My Plan',  icon: '👤' },
  { id: 'aix',      label: 'Aix',      icon: '🏠' },
]

const MORE_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'trips',  label: 'Family Trips', icon: '✈️' },
  { id: 'phoebe', label: 'Phoebe',       icon: '🐾' },
  { id: 'guests', label: 'Guests',       icon: '🛎️' },
]

const MORE_IDS: Tab[] = ['trips', 'phoebe', 'guests']

function DachshundIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 52 26" fill="currentColor" aria-hidden="true" className={className}>
      <ellipse cx="24" cy="17" rx="16" ry="6.5" />
      <ellipse cx="38" cy="12" rx="8" ry="6.5" />
      <ellipse cx="45.5" cy="14.5" rx="3.5" ry="2.8" />
      <ellipse cx="34" cy="7" rx="4.5" ry="6" transform="rotate(-8 34 7)" />
      <path d="M8 14 Q2 10 3 5 Q6 1 10 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="15" y="21" width="3" height="5" rx="1.5" />
      <rect x="21" y="21" width="3" height="5" rx="1.5" />
      <rect x="28" y="21" width="3" height="5" rx="1.5" />
      <rect x="34" y="21" width="3" height="5" rx="1.5" />
    </svg>
  )
}

export default function Home() {
  const [tab, setTab]               = useState<Tab>('calendar')
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [mounted, setMounted]       = useState(false)
  const [showMore, setShowMore]     = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const [events, setEvents]                   = useState<Event[]>([])
  const [locations, setLocations]             = useState<Location[]>([])
  const [phoebeSchedule, setPhoebeSchedule]   = useState<PhoebeSchedule[]>([])
  const [guests, setGuests]                   = useState<Guest[]>([])
  const [roomAllocations, setRoomAllocations] = useState<RoomAllocation[]>([])
  const [stays, setStays]                     = useState<Stay[]>([])
  const [tripRsvps, setTripRsvps]             = useState<TripRsvp[]>([])
  const [loading, setLoading]                 = useState(true)
  const [connected, setConnected]             = useState(false)

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search)
    const paramUser = params.get('user')?.toLowerCase() ?? null
    if (paramUser && VALID_USERS.includes(paramUser)) {
      localStorage.setItem('demelo_identity', paramUser)
      setCurrentUser(paramUser)
    } else {
      const saved = localStorage.getItem('demelo_identity')
      if (saved) setCurrentUser(saved)
    }
    setMounted(true)
  }, [])

  const handleSelectUser = (key: string) => {
    localStorage.setItem('demelo_identity', key)
    setCurrentUser(key)
    // Show onboarding tour if first time on this device
    if (!localStorage.getItem('demelo_onboarding_complete')) {
      setShowOnboarding(true)
    }
  }

  const handleOnboardingComplete = (goToSchedule: boolean) => {
    localStorage.setItem('demelo_onboarding_complete', 'true')
    setShowOnboarding(false)
    if (goToSchedule) setTab('schedule')
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

  if (!mounted) return null
  if (!currentUser) return <WhoAreYou onSelect={handleSelectUser} />

  const isMoreActive = MORE_IDS.includes(tab)
  const isWide       = WIDE_TABS.includes(tab)

  const navigateTo = (t: Tab) => {
    setTab(t)
    setShowMore(false)
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      <InstallPrompt />
      {showOnboarding && currentUser && (
        <OnboardingTour currentUser={currentUser} onComplete={handleOnboardingComplete} />
      )}

      {/* ── Header ── */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              <DachshundIcon className="w-8 h-4 text-stone-400" />
              <span className="font-serif text-lg font-semibold text-stone-800 tracking-tight leading-none">
                De Melo
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { localStorage.removeItem('demelo_identity'); setCurrentUser(null) }}
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
        </div>
      </header>

      {/* ── Content ── */}
      <main className={`mx-auto px-4 py-6 pb-28 transition-all ${isWide ? 'max-w-6xl' : 'max-w-3xl'}`}>
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
              <Calendar events={events} phoebeSchedule={phoebeSchedule} guests={guests} stays={stays} onRefresh={fetchAll} />
            )}
            {tab === 'overview' && (
              <LocationOverview
                events={events} locations={locations} phoebeSchedule={phoebeSchedule}
                stays={stays} guests={guests} tripRsvps={tripRsvps} onRefresh={fetchAll}
              />
            )}
            {tab === 'schedule' && (
              <MySchedule currentUser={currentUser} stays={stays} locations={locations} roomAllocations={roomAllocations} onRefresh={fetchAll} />
            )}
            {tab === 'trips' && (
              <FamilyTrips events={events} tripRsvps={tripRsvps} currentUser={currentUser} onRefresh={fetchAll} />
            )}
            {tab === 'phoebe' && (
              <PhoebeTab phoebeSchedule={phoebeSchedule} currentUser={currentUser} onRefresh={fetchAll} />
            )}
            {tab === 'guests' && (
              <GuestVisits guests={guests} currentUser={currentUser} onRefresh={fetchAll} />
            )}
            {tab === 'aix' && (
              <AixHouse roomAllocations={roomAllocations} stays={stays} guests={guests} currentUser={currentUser} onRefresh={fetchAll} />
            )}
          </>
        )}
      </main>

      {/* ── More menu (above bottom nav) ── */}
      {showMore && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-[4.5rem] left-4 right-4 z-30 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden max-w-sm mx-auto">
            {MORE_ITEMS.map((item, i) => (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={[
                  'w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors',
                  i < MORE_ITEMS.length - 1 ? 'border-b border-stone-100' : '',
                  tab === item.id ? 'bg-stone-50 font-semibold text-stone-800' : 'text-stone-700 hover:bg-stone-50',
                ].join(' ')}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
                {tab === item.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-stone-800" />}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Bottom navigation bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-200 flex safe-bottom"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV_ITEMS.map(item => {
          const isActive = tab === item.id
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={[
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors',
                isActive ? 'text-stone-800' : 'text-stone-400 active:text-stone-600',
              ].join(' ')}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className={`text-[10px] leading-tight ${isActive ? 'font-semibold' : 'font-normal'}`}>
                {item.label}
              </span>
              {isActive && <div className="absolute bottom-0 w-6 h-0.5 bg-stone-800 rounded-full" />}
            </button>
          )
        })}

        {/* More button */}
        <button
          onClick={() => setShowMore(m => !m)}
          className={[
            'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors',
            isMoreActive || showMore ? 'text-stone-800' : 'text-stone-400 active:text-stone-600',
          ].join(' ')}
        >
          <span className="text-xl leading-none">•••</span>
          <span className={`text-[10px] leading-tight ${isMoreActive || showMore ? 'font-semibold' : 'font-normal'}`}>
            More
          </span>
          {isMoreActive && <div className="absolute bottom-0 w-6 h-0.5 bg-stone-800 rounded-full" />}
        </button>
      </nav>
    </div>
  )
}
