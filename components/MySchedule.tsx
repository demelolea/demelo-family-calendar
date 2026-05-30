'use client'

import { useState, useRef } from 'react'
import { Stay, Location, RoomAllocation, AIX_ROOMS, PERSON_COLORS, PERSON_LABELS } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { notifyFamily } from '@/lib/notify'
import NotificationPrompt from './NotificationPrompt'

interface MyScheduleProps {
  currentUser: string
  stays: Stay[]
  locations: Location[]
  roomAllocations: RoomAllocation[]
  onRefresh: () => void
}

const TRANSPORT_TYPES = [
  { value: 'flight', label: '✈ Flight' },
  { value: 'train',  label: '🚂 Train' },
  { value: 'car',    label: '🚗 Car' },
]

const ROOM_LABEL = (id: string) => AIX_ROOMS.find(r => r.id === id)?.label ?? id

function isAixLocation(loc: string) {
  return loc.toLowerCase().includes('aix')
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function transportSummary(type?: string, station?: string, time?: string) {
  if (!type) return null
  const icons: Record<string, string> = { flight: '✈', train: '🚂', car: '🚗' }
  const parts = [icons[type] ?? type]
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

// ── Room drawer ────────────────────────────────────────────────────────────────

type RoomDrawerData = {
  displayName: string
  startDate: string
  endDate: string
  currentRoomId: string | null
  currentAllocationId: string | null
}

interface RoomDrawerProps {
  data: RoomDrawerData
  currentUser: string
  saving: boolean
  onAssign: (roomId: string) => void
  onRemove: () => void
  onSkip: () => void
  isPrompt?: boolean   // true = just saved a new stay, false = editing existing
}

function RoomDrawer({ data, saving, onAssign, onRemove, onSkip, isPrompt }: RoomDrawerProps) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onSkip}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-4 pb-10">
        {/* Drag handle */}
        <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="mb-4">
          {isPrompt ? (
            <>
              <p className="font-semibold text-stone-800">Assign a room in Aix? 🏠</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {data.displayName} · {formatDate(data.startDate)} – {formatDate(data.endDate)}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-stone-800">{data.displayName}'s room</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {data.currentRoomId
                  ? `Currently in ${ROOM_LABEL(data.currentRoomId)} · tap to move`
                  : 'Tap a room to assign'}
              </p>
            </>
          )}
        </div>

        {/* Room grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {AIX_ROOMS.map(room => {
            const isCurrent = data.currentRoomId === room.id
            return (
              <button
                key={room.id}
                onClick={() => onAssign(room.id)}
                disabled={saving}
                className={[
                  'py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all text-left',
                  isCurrent
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400 active:bg-stone-50',
                ].join(' ')}
              >
                {room.label}
                {isCurrent && <span className="block text-[10px] opacity-60 mt-0.5">Assigned ✓</span>}
              </button>
            )
          })}
        </div>

        {/* Remove / skip */}
        {data.currentRoomId ? (
          <button
            onClick={onRemove}
            disabled={saving}
            className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Remove from room'}
          </button>
        ) : (
          <button
            onClick={onSkip}
            className="w-full py-2 text-sm text-stone-400 hover:text-stone-600 transition-colors text-center"
          >
            Skip for now
          </button>
        )}
      </div>
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MySchedule({ currentUser, stays, locations, roomAllocations, onRefresh }: MyScheduleProps) {
  const today     = new Date().toISOString().slice(0, 10)
  const color     = PERSON_COLORS[currentUser] ?? '#8A8A8A'
  const label     = PERSON_LABELS[currentUser] ?? currentUser
  const baseLocation = locations.find(l => l.person === currentUser)?.current_location ?? null

  const myStays   = stays
    .filter(s => s.person === currentUser)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  const active   = myStays.filter(s => s.start_date <= today && s.end_date >= today)
  const upcoming = myStays.filter(s => s.start_date > today)
  const past     = myStays.filter(s => s.end_date < today).reverse()

  // ── Form state ──────────────────────────────────────────────────────────────
  const formRef = useRef<HTMLDivElement>(null)
  const [showForm,          setShowForm]          = useState(false)
  const [editingStay,       setEditingStay]       = useState<Stay | null>(null)
  const [confirmingDelete,  setConfirmingDelete]  = useState<string | null>(null)

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

  // ── Room drawer state ───────────────────────────────────────────────────────
  const [roomDrawer, setRoomDrawer] = useState<RoomDrawerData | null>(null)
  const [roomSaving, setRoomSaving] = useState(false)

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Find the room allocation for the current user overlapping a given stay. */
  const getAssignedRoom = (stay: Stay): { roomId: string; allocationId: string } | null => {
    const alloc = roomAllocations.find(a =>
      a.occupant_name.toLowerCase() === label.toLowerCase() &&
      a.start_date <= stay.end_date && a.end_date >= stay.start_date,
    )
    return alloc ? { roomId: alloc.room, allocationId: alloc.id } : null
  }

  const openRoomDrawerForStay = (stay: Stay) => {
    const assigned = getAssignedRoom(stay)
    setRoomDrawer({
      displayName:          label,
      startDate:            stay.start_date,
      endDate:              stay.end_date,
      currentRoomId:        assigned?.roomId ?? null,
      currentAllocationId:  assigned?.allocationId ?? null,
    })
  }

  // ── Form helpers ────────────────────────────────────────────────────────────
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

  // ── Save stay ───────────────────────────────────────────────────────────────
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

    const isAix    = isAixLocation(location.trim())
    const isNewAix = isAix && !editingStay

    if (editingStay) {
      await supabase.from('stays').update(payload).eq('id', editingStay.id)
      notifyFamily(currentUser, 'De Melo Update',
        `${label} updated their stay in ${location.trim()}: ${formatDate(startDate)} – ${formatDate(endDate)}`)
    } else {
      await supabase.from('stays').insert({ person: currentUser, ...payload })
      notifyFamily(currentUser, 'De Melo Update',
        `${label} added a stay in ${location.trim()}: ${formatDate(startDate)} – ${formatDate(endDate)}`)
    }

    setLoading(false)
    cancelForm()
    onRefresh()

    // After a new Aix stay, prompt for room assignment
    if (isNewAix) {
      setRoomDrawer({
        displayName:          label,
        startDate,
        endDate,
        currentRoomId:        null,
        currentAllocationId:  null,
      })
    }
  }

  // ── Delete stay ─────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeleting(id)
    await supabase.from('stays').delete().eq('id', id)
    setDeleting(null)
    setConfirmingDelete(null)
    onRefresh()
  }

  // ── Room assignment ──────────────────────────────────────────────────────────
  const handleAssignRoom = async (roomId: string) => {
    if (!roomDrawer || roomSaving) return
    setRoomSaving(true)

    // Remove existing allocation if any
    if (roomDrawer.currentAllocationId) {
      await supabase.from('room_allocations').delete().eq('id', roomDrawer.currentAllocationId)
    }

    // Insert new allocation
    await supabase.from('room_allocations').insert({
      room:          roomId,
      occupant_name: roomDrawer.displayName,
      start_date:    roomDrawer.startDate,
      end_date:      roomDrawer.endDate,
    })

    const actor = PERSON_LABELS[currentUser] ?? currentUser
    notifyFamily(currentUser, 'Room assigned 🏠',
      `${actor} assigned themselves to ${ROOM_LABEL(roomId)} in Aix`)

    setRoomSaving(false)
    setRoomDrawer(null)
    onRefresh()
  }

  const handleRemoveRoom = async () => {
    if (!roomDrawer || roomSaving) return
    setRoomSaving(true)

    if (roomDrawer.currentAllocationId) {
      await supabase.from('room_allocations').delete().eq('id', roomDrawer.currentAllocationId)
    }

    const actor = PERSON_LABELS[currentUser] ?? currentUser
    notifyFamily(currentUser, 'Room cleared 🏠',
      `${actor} removed their room assignment in Aix`)

    setRoomSaving(false)
    setRoomDrawer(null)
    onRefresh()
  }

  // ── Stay card ────────────────────────────────────────────────────────────────
  const StayCard = ({ stay, dim }: { stay: Stay; dim?: boolean }) => {
    const isActive     = stay.start_date <= today && stay.end_date >= today
    const arrSummary   = transportSummary(stay.arr_transport_type, stay.arr_station, stay.arr_time)
    const depSummary   = transportSummary(stay.dep_transport_type, stay.dep_station, stay.dep_time)
    const isEditing    = editingStay?.id === stay.id
    const isConfirming = confirmingDelete === stay.id
    const isAix        = isAixLocation(stay.location)
    const assigned     = isAix ? getAssignedRoom(stay) : null

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

              {/* Room badge — only for Aix stays */}
              {isAix && (
                <button
                  onClick={() => openRoomDrawerForStay(stay)}
                  className={[
                    'mt-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors',
                    assigned
                      ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200',
                  ].join(' ')}
                >
                  🏠 {assigned ? ROOM_LABEL(assigned.roomId) : 'No room assigned'}
                  <span className="opacity-50">›</span>
                </button>
              )}
            </div>
          </div>

          {/* Badges + actions */}
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

  // ── Render ───────────────────────────────────────────────────────────────────
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

            {/* Aix room hint */}
            {isAixLocation(location) && !editingStay && (
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                🏠 You'll be able to choose your room after saving.
              </p>
            )}

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

      {/* Room assignment drawer */}
      {roomDrawer && (
        <RoomDrawer
          data={roomDrawer}
          currentUser={currentUser}
          saving={roomSaving}
          onAssign={handleAssignRoom}
          onRemove={handleRemoveRoom}
          onSkip={() => setRoomDrawer(null)}
          isPrompt={!roomDrawer.currentRoomId && !roomAllocations.some(a =>
            a.occupant_name.toLowerCase() === label.toLowerCase() &&
            a.start_date <= roomDrawer.endDate && a.end_date >= roomDrawer.startDate,
          )}
        />
      )}
    </div>
  )
}
