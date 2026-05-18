'use client'

import { useState, useRef } from 'react'
import { Stay, Location, PERSON_COLORS, PERSON_LABELS } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { notifyFamily } from '@/lib/notify'
import NotificationPrompt from './NotificationPrompt'

interface MyScheduleProps {
  currentUser: string
  stays: Stay[]
  locations: Location[]
  onRefresh: () => void
}

const TRANSPORT_TYPES = [
  { value: 'flight', label: '✈ Flight' },
  { value: 'train',  label: '🚂 Train' },
  { value: 'car',    label: '🚗 Car' },
]

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function transportSummary(type?: string, station?: string, time?: string) {
  if (!type) return null
  const icons: Record<string, string> = { flight: '✈', train: '🚂', car: '🚗' }
  const icon = icons[type] ?? type
  const parts = [icon]
  if (station) parts.push(station)
  if (time) parts.push(time)
  return parts.join(' · ')
}

interface TransportFieldsProps {
  label: string
  type: string
  setType: (v: string) => void
  station: string
  setStation: (v: string) => void
  time: string
  setTime: (v: string) => void
}

function TransportFields({ label, type, setType, station, setStation, time, setTime }: TransportFieldsProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => { setType(''); setStation(''); setTime('') }}
          className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
            !type
              ? 'bg-stone-800 text-white border-stone-800'
              : 'border-stone-200 text-stone-600 bg-white hover:bg-stone-50'
          }`}
        >
          None
        </button>
        {TRANSPORT_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setType(t.value); if (t.value === 'car') { setStation(''); setTime('') } }}
            className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
              type === t.value
                ? 'bg-stone-800 text-white border-stone-800'
                : 'border-stone-200 text-stone-600 bg-white hover:bg-stone-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {type && type !== 'car' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={station}
            onChange={e => setStation(e.target.value)}
            placeholder={type === 'flight' ? 'Airport (e.g. CDG)' : 'Station'}
            className="px-3 py-2 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
          />
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
          />
        </div>
      )}
    </div>
  )
}

export default function MySchedule({ currentUser, stays, locations, onRefresh }: MyScheduleProps) {
  const today = new Date().toISOString().slice(0, 10)
  const color = PERSON_COLORS[currentUser] ?? '#8A8A8A'
  const label = PERSON_LABELS[currentUser] ?? currentUser
  const baseLocation = locations.find(l => l.person === currentUser)?.current_location ?? null

  const myStays = stays
    .filter(s => s.person === currentUser)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  const active   = myStays.filter(s => s.start_date <= today && s.end_date >= today)
  const upcoming = myStays.filter(s => s.start_date > today)
  const past     = myStays.filter(s => s.end_date < today).reverse()

  // Form state
  const formRef = useRef<HTMLDivElement>(null)
  const [showForm,     setShowForm]     = useState(false)
  const [editingStay,  setEditingStay]  = useState<Stay | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const [location,   setLocation]   = useState('')
  const [startDate,  setStartDate]  = useState('')
  const [endDate,    setEndDate]    = useState('')
  const [status,     setStatus]     = useState<'confirmed' | 'tentative'>('confirmed')
  const [arrType,    setArrType]    = useState('')
  const [arrStation, setArrStation] = useState('')
  const [arrTime,    setArrTime]    = useState('')
  const [depType,    setDepType]    = useState('')
  const [depStation, setDepStation] = useState('')
  const [depTime,    setDepTime]    = useState('')
  const [loading,    setLoading]    = useState(false)
  const [deleting,   setDeleting]   = useState<string | null>(null)

  const resetForm = () => {
    setLocation(''); setStartDate(''); setEndDate('')
    setStatus('confirmed')
    setArrType(''); setArrStation(''); setArrTime('')
    setDepType(''); setDepStation(''); setDepTime('')
  }

  const openAdd = () => {
    setEditingStay(null)
    resetForm()
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const openEdit = (stay: Stay) => {
    setEditingStay(stay)
    setLocation(stay.location)
    setStartDate(stay.start_date)
    setEndDate(stay.end_date)
    setStatus(stay.status ?? 'confirmed')
    setArrType(stay.arr_transport_type ?? '')
    setArrStation(stay.arr_station ?? '')
    setArrTime(stay.arr_time ?? '')
    setDepType(stay.dep_transport_type ?? '')
    setDepStation(stay.dep_station ?? '')
    setDepTime(stay.dep_time ?? '')
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingStay(null)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!location.trim() || !startDate || !endDate) return
    setLoading(true)

    const payload = {
      location:           location.trim(),
      start_date:         startDate,
      end_date:           endDate,
      status,
      arr_transport_type: arrType || null,
      arr_station:        (arrType && arrType !== 'car') ? (arrStation.trim() || null) : null,
      arr_time:           (arrType && arrType !== 'car') ? (arrTime || null) : null,
      dep_transport_type: depType || null,
      dep_station:        (depType && depType !== 'car') ? (depStation.trim() || null) : null,
      dep_time:           (depType && depType !== 'car') ? (depTime || null) : null,
    }

    if (editingStay) {
      await supabase.from('stays').update(payload).eq('id', editingStay.id)
      notifyFamily(currentUser, 'De Melo Update',
        `${label} updated their stay in ${location.trim()}: ${fmtDate(startDate)} – ${fmtDate(endDate)}`)
    } else {
      await supabase.from('stays').insert({ person: currentUser, ...payload })
      notifyFamily(currentUser, 'De Melo Update',
        `${label} added a stay in ${location.trim()}: ${fmtDate(startDate)} – ${fmtDate(endDate)}`)
    }

    setLoading(false)
    cancelForm()
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    await supabase.from('stays').delete().eq('id', id)
    setDeleting(null)
    setConfirmingDelete(null)
    onRefresh()
  }

  const StayCard = ({ stay, dim }: { stay: Stay; dim?: boolean }) => {
    const isActive    = stay.start_date <= today && stay.end_date >= today
    const arrSummary  = transportSummary(stay.arr_transport_type, stay.arr_station, stay.arr_time)
    const depSummary  = transportSummary(stay.dep_transport_type, stay.dep_station, stay.dep_time)
    const isEditing   = editingStay?.id === stay.id
    const isConfirming = confirmingDelete === stay.id

    return (
      <div
        className={[
          'bg-white border rounded-2xl p-4 shadow-sm transition-opacity',
          isActive   ? 'border-amber-200' : 'border-stone-100',
          isEditing  ? 'ring-2 ring-stone-300' : '',
          dim        ? 'opacity-50' : '',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-800">{stay.location}</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {formatDate(stay.start_date)} – {formatDate(stay.end_date)}
              </p>
              {arrSummary && (
                <p className="text-xs text-stone-400 mt-1">
                  <span className="text-stone-500 font-medium">Arriving: </span>{arrSummary}
                </p>
              )}
              {depSummary && (
                <p className="text-xs text-stone-400 mt-0.5">
                  <span className="text-stone-500 font-medium">Leaving: </span>{depSummary}
                </p>
              )}
            </div>
          </div>

          {/* Badges + action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {stay.status === 'tentative' && (
              <span className="text-[10px] font-semibold bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                Tentative
              </span>
            )}
            {isActive && (
              <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Now
              </span>
            )}

            {/* Edit button */}
            {!isConfirming && (
              <button
                onClick={() => isEditing ? cancelForm() : openEdit(stay)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  isEditing
                    ? 'border-stone-300 text-stone-500 bg-stone-50'
                    : 'border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300 bg-white'
                }`}
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            )}

            {/* Delete — two-step confirmation */}
            {!isEditing && (
              isConfirming ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-stone-500">Delete?</span>
                  <button
                    onClick={() => handleDelete(stay.id)}
                    disabled={deleting === stay.id}
                    className="text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-md transition-colors disabled:opacity-50"
                  >
                    {deleting === stay.id ? '…' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(null)}
                    className="text-[10px] font-semibold text-stone-500 border border-stone-200 px-2 py-0.5 rounded-md hover:bg-stone-50 transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(stay.id)}
                  className="text-xs text-stone-300 hover:text-red-400 transition-colors px-1.5 py-1"
                  title="Delete stay"
                >
                  ✕
                </button>
              )
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <NotificationPrompt currentUser={currentUser} />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <h2 className="font-serif text-xl font-semibold text-stone-800">My Schedule</h2>
          </div>
          <p className="text-sm text-stone-400 mt-0.5">{label}'s personal stays</p>
          {baseLocation && (
            <p className="text-xs text-stone-400 mt-1">📍 Home base: {baseLocation}</p>
          )}
        </div>
        <button
          onClick={openAdd}
          className="px-3 py-1.5 bg-stone-800 text-white text-sm rounded-xl hover:bg-stone-700 active:bg-stone-900 transition-colors font-medium"
        >
          + Add stay
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div ref={formRef} className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">
            {editingStay ? 'Edit stay' : 'New stay'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Location *"
              autoFocus
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-stone-400 mb-1">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">To</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
            </div>

            {/* Confirmed / Tentative */}
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('confirmed')}
                  className={`py-2 rounded-xl text-sm border transition-colors ${
                    status === 'confirmed'
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'border-stone-200 text-stone-600 bg-white hover:bg-stone-50'
                  }`}
                >
                  ✓ Confirmed
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('tentative')}
                  className={`py-2 rounded-xl text-sm border transition-colors ${
                    status === 'tentative'
                      ? 'bg-stone-500 text-white border-stone-500'
                      : 'border-stone-200 text-stone-600 bg-white hover:bg-stone-50'
                  }`}
                >
                  ? Tentative
                </button>
              </div>
            </div>

            {/* Transport sections */}
            <div className="border-t border-stone-200 pt-3 space-y-4">
              <TransportFields
                label="Arrival transport"
                type={arrType} setType={setArrType}
                station={arrStation} setStation={setArrStation}
                time={arrTime} setTime={setArrTime}
              />
              <TransportFields
                label="Departure transport"
                type={depType} setType={setDepType}
                station={depStation} setStation={setDepStation}
                time={depTime} setTime={setDepTime}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={cancelForm}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving…' : editingStay ? 'Save changes' : 'Save stay'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active stays */}
      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Here now</p>
          {active.map(s => <StayCard key={s.id} stay={s} />)}
        </div>
      )}

      {/* Upcoming stays */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Upcoming</p>
          {upcoming.map(s => <StayCard key={s.id} stay={s} />)}
        </div>
      )}

      {/* Past stays */}
      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Past</p>
          {past.slice(0, 5).map(s => <StayCard key={s.id} stay={s} dim />)}
        </div>
      )}

      {myStays.length === 0 && !showForm && (
        <div className="text-center py-16 text-stone-400 text-sm italic">
          No stays added yet. Press "Add stay" to get started.
        </div>
      )}
    </div>
  )
}
