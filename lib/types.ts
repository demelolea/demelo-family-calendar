export interface Event {
  id: string
  title: string
  person: string
  start_date: string
  end_date: string
  location?: string
  trip_type?: string
  travel_direction?: string
  transport_type?: string
  transport_station?: string
  transport_time?: string
  created_at: string
}

export interface Stay {
  id: string
  person: string          // lowercase key: 'jim', 'isabelle', etc.
  location: string
  start_date: string
  end_date: string
  arr_transport_type?: string   // 'flight' | 'train' | 'car'
  arr_station?: string
  arr_time?: string
  dep_transport_type?: string
  dep_station?: string
  dep_time?: string
  created_at: string
}

export interface Location {
  id: string
  person: string
  current_location: string
  updated_at: string
}

export interface PhoebeSchedule {
  id: string
  with_whom: string
  start_date: string
  end_date: string
  notes?: string
}

export interface Guest {
  id: string
  guest_name: string
  house: 'aix' | 'geneva'
  arrival_date: string
  departure_date: string
  invited_by?: string
  allocated_room?: string   // one of AIX_ROOMS ids; null = unallocated
}

export interface RoomAllocation {
  id: string
  room: string
  occupant_name: string
  start_date: string
  end_date: string
  notes?: string
}

export interface TripRsvp {
  id: string
  trip_id: string
  person: string
  response: 'yes' | 'no' | 'maybe'
}

export interface CalendarEntry {
  id: string
  title: string
  person: string
  color: string
  start_date: string
  end_date: string
  location?: string
  type: 'event' | 'phoebe' | 'guest' | 'stay'
  transport_type?: string
  travel_direction?: string
  transport_station?: string
  transport_time?: string
  invited_by?: string
}

export const PERSON_COLORS: Record<string, string> = {
  jim: '#4A7C59',
  isabelle: '#E07B70',
  elissa: '#8B6BA8',
  ines: '#D4789C',
  lea: '#4A9B9B',
  family: '#5B8EC4',
  phoebe: '#D4A843',
  guest: '#8A8A8A',
}

export const PERSON_LABELS: Record<string, string> = {
  jim: 'Jim',
  isabelle: 'Isabelle',
  elissa: 'Elissa',
  ines: 'Ines',
  lea: 'Lea',
  family: 'Family Trip',
  phoebe: 'Phoebe',
  guest: 'Guest',
}

export const FAMILY_MEMBERS = [
  { value: 'jim', label: 'Jim' },
  { value: 'isabelle', label: 'Isabelle' },
  { value: 'elissa', label: 'Elissa' },
  { value: 'ines', label: 'Ines' },
  { value: 'lea', label: 'Lea' },
  { value: 'family', label: 'Family Trip' },
]

export const FAMILY_KEYS = ['jim', 'isabelle', 'elissa', 'ines', 'lea']

// Aix house rooms — canonical order, shared by AixHouse and GuestVisits
export const AIX_ROOMS = [
  { id: 'ground_floor_room', label: 'Ground floor room' },
  { id: 'lea',               label: 'Lea' },
  { id: 'middle',            label: 'Middle' },
  { id: 'elissa',            label: 'Elissa' },
  { id: 'ines',              label: 'Ines' },
  { id: 'terrace',           label: 'Terrace' },
  { id: 'second_floor_room', label: '2nd floor room' },
  { id: 'master',            label: 'Master' },
] as const

export const TRANSPORT_ICONS: Record<string, string> = {
  flight: '✈',
  train: '🚂',
  car: '🚗',
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
