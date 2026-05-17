'use client'

import { PERSON_COLORS } from '@/lib/types'

const PEOPLE = [
  { key: 'jim',      label: 'Jim' },
  { key: 'isabelle', label: 'Isabelle' },
  { key: 'elissa',   label: 'Elissa' },
  { key: 'ines',     label: 'Ines' },
  { key: 'lea',      label: 'Lea' },
]

interface WhoAreYouProps {
  onSelect: (key: string) => void
}

export default function WhoAreYou({ onSelect }: WhoAreYouProps) {
  return (
    <div className="min-h-screen bg-[#F8F6F2] flex items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-stone-800 tracking-tight">De Melo</h1>
          <p className="text-sm text-stone-400 mt-3">Welcome. Who are you?</p>
        </div>

        <div className="space-y-2.5">
          {PEOPLE.map(p => (
            <button
              key={p.key}
              onClick={() => onSelect(p.key)}
              className="w-full py-4 px-5 bg-white border border-stone-200 rounded-2xl text-sm font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 active:scale-[0.98] transition-all shadow-sm flex items-center gap-3.5"
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: PERSON_COLORS[p.key] }}
              />
              {p.label}
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-stone-300 mt-8">
          Your choice is saved on this device
        </p>
      </div>
    </div>
  )
}
