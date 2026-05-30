'use client'

import { useState } from 'react'

interface OnboardingTourProps {
  currentUser: string
  onComplete: (goToSchedule: boolean) => void
}

interface TabPill {
  icon: string
  label: string
  inMore?: boolean
}

interface Step {
  id: number
  title: string
  text: string
  tabPills?: TabPill[]
  emoji?: string
  isNotification?: boolean
  isFinal?: boolean
}

const STEPS: Step[] = [
  {
    id: 1,
    title: 'Welcome to the De Melo Family Calendar 👋',
    text: "This app helps the whole family stay in sync — who's where, when, who has Phoebe, and who's sleeping in which room in Aix. Let's take a quick tour.",
    emoji: '🏡',
  },
  {
    id: 2,
    title: 'Your schedule',
    text: "Start here. Add your stays for the summer — where you'll be and when. You can mark them as confirmed or tentative, and add your arrival and departure transport details.",
    tabPills: [{ icon: '👤', label: 'My Plan' }],
  },
  {
    id: 3,
    title: 'Family overview',
    text: "See where everyone is, day by day across the whole summer. Solid colours mean confirmed, stripes mean tentative. This is your at-a-glance view of who's where and when.",
    tabPills: [{ icon: '🗺️', label: 'Overview' }],
  },
  {
    id: 4,
    title: 'Calendar view',
    text: "Switch to Calendar view inside Overview for a classic monthly layout — all stays, events, guests, and Phoebe's schedule in one place. Tap any day for the full details.",
    tabPills: [{ icon: '🗺️', label: 'Overview' }],
  },
  {
    id: 5,
    title: 'Family trips',
    text: "Monaco and Dublin are already in here! Add any new family trips or equestrian events. You can confirm whether you're joining each trip with a simple yes / maybe / no.",
    tabPills: [{ icon: '✈️', label: 'Family Trips', inMore: true }],
  },
  {
    id: 6,
    title: "Phoebe's schedule 🐾",
    text: "The most important tab. Track who has Phoebe and when, and see handover dates clearly flagged. Make sure she's always accounted for!",
    tabPills: [{ icon: '🐾', label: 'Phoebe', inMore: true }],
  },
  {
    id: 7,
    title: 'Guests & Aix Rooms',
    text: "Add guests visiting any family home and track their details. In Aix Rooms, assign everyone to a room and see the total occupancy per night — useful for planning cleaning and cooking.",
    tabPills: [
      { icon: '🛎️', label: 'Guests', inMore: true },
      { icon: '🏠', label: 'Aix' },
    ],
  },
  {
    id: 8,
    title: 'Stay in the loop 🔔',
    text: "Enable notifications so you hear whenever someone updates their plans, adds a guest, or changes Phoebe's schedule. You can always change this in your phone settings later.",
    isNotification: true,
  },
  {
    id: 9,
    title: "You're all set! ☀️",
    text: "Start by adding your first stay in My Schedule. The family is waiting to see your plans.",
    isFinal: true,
    emoji: '🌿',
  },
]

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64  = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return new Uint8Array(Array.from(raw, c => c.charCodeAt(0)))
}

export default function OnboardingTour({ currentUser, onComplete }: OnboardingTourProps) {
  const [stepIndex, setStepIndex]   = useState(0)
  const [notifState, setNotifState] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle')

  const step    = STEPS[stepIndex]
  const total   = STEPS.length
  const isFirst = stepIndex === 0

  const next = () => {
    if (step.isFinal) { onComplete(true); return }
    setStepIndex(i => Math.min(i + 1, total - 1))
    setNotifState('idle')
  }

  const back = () => {
    setStepIndex(i => Math.max(i - 1, 0))
    setNotifState('idle')
  }

  const handleEnableNotifications = async () => {
    if (typeof Notification === 'undefined') { next(); return }
    setNotifState('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setNotifState('denied')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { next(); return }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      })
      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ person: currentUser, subscription: sub.toJSON() }),
      })
      localStorage.setItem('demelo_notif_prompt', 'granted')
      setNotifState('granted')
      setTimeout(next, 1800)
    } catch {
      setNotifState('idle')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4"
      style={{ background: 'rgba(20, 14, 8, 0.75)' }}
    >
      {/* Backdrop blur layer */}
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      {/* Skip link */}
      <button
        onClick={() => onComplete(false)}
        className="absolute top-5 right-5 text-sm text-stone-400 hover:text-stone-200 transition-colors z-10 px-2 py-1"
      >
        Skip tour
      </button>

      {/* ── Card ── */}
      <div className="relative bg-[#FAF8F3] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden z-10">

        {/* Progress bar */}
        <div className="h-0.5 bg-stone-200">
          <div
            className="h-full bg-stone-600 transition-all duration-500 ease-out"
            style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
          />
        </div>

        <div className="px-6 pt-5 pb-6">

          {/* Step counter + dot strip */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-[11px] text-stone-400 font-medium tabular-nums">
              {stepIndex + 1} of {total}
            </span>
            <div className="flex gap-1 items-center">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={[
                    'rounded-full transition-all duration-300',
                    i === stepIndex
                      ? 'w-5 h-1.5 bg-stone-700'
                      : i < stepIndex
                      ? 'w-1.5 h-1.5 bg-stone-400'
                      : 'w-1.5 h-1.5 bg-stone-200',
                  ].join(' ')}
                />
              ))}
            </div>
          </div>

          {/* Hero emoji (welcome / final steps) */}
          {step.emoji && (
            <div className="text-4xl text-center mb-4">{step.emoji}</div>
          )}

          {/* Title */}
          <h2 className="font-serif text-xl font-semibold text-stone-800 leading-snug mb-3">
            {step.title}
          </h2>

          {/* Tab pills — visual reference to nav tabs */}
          {step.tabPills && step.tabPills.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              {step.tabPills.map(pill => (
                <div key={pill.label} className="flex flex-col items-center gap-1.5">
                  {/* Pill card */}
                  <div className="relative bg-white border-2 border-amber-300 rounded-2xl px-5 py-3 shadow-sm ring-4 ring-amber-100">
                    <span className="text-2xl block text-center leading-none">{pill.icon}</span>
                    <span className="text-xs font-semibold text-stone-700 block text-center mt-1 whitespace-nowrap">
                      {pill.label}
                    </span>
                    {/* Pulsing indicator */}
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500" />
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-400 font-medium text-center leading-tight">
                    {pill.inMore ? '↑ ••• More menu' : '↓ bottom bar'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Body text */}
          <p className="text-sm text-stone-500 leading-relaxed mb-6">
            {step.text}
          </p>

          {/* ── Actions ── */}

          {/* Notification step */}
          {step.isNotification && (
            <div className="space-y-2.5">
              {notifState === 'granted' ? (
                <div className="flex items-center justify-center gap-2.5 py-3.5 bg-green-50 border border-green-200 rounded-2xl">
                  <span className="text-xl">✅</span>
                  <span className="text-sm font-semibold text-green-700">Notifications enabled!</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleEnableNotifications}
                    disabled={notifState === 'loading'}
                    className="w-full py-3.5 bg-stone-800 text-white rounded-2xl text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-60"
                  >
                    {notifState === 'loading' ? 'Setting up…'
                      : notifState === 'denied' ? '🔕 Permission denied — tap Maybe later'
                      : 'Enable notifications 🔔'}
                  </button>
                  <button
                    onClick={next}
                    className="w-full py-2 text-sm text-stone-400 hover:text-stone-600 transition-colors text-center"
                  >
                    Maybe later
                  </button>
                </>
              )}
              {/* Back for notification step */}
              {!isFirst && (
                <button
                  onClick={back}
                  className="w-full py-1 text-xs text-stone-300 hover:text-stone-500 transition-colors text-center"
                >
                  ← Back
                </button>
              )}
            </div>
          )}

          {/* Final step */}
          {step.isFinal && (
            <button
              onClick={() => onComplete(true)}
              className="w-full py-3.5 bg-stone-800 text-white rounded-2xl text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors"
            >
              Let's go →
            </button>
          )}

          {/* Normal steps */}
          {!step.isNotification && !step.isFinal && (
            <div className="flex gap-2.5">
              {!isFirst && (
                <button
                  onClick={back}
                  className="flex-1 py-3.5 border border-stone-200 rounded-2xl text-sm font-medium text-stone-600 hover:bg-stone-50 active:bg-stone-100 transition-colors"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={next}
                className={[
                  'py-3.5 bg-stone-800 text-white rounded-2xl text-sm font-semibold',
                  'hover:bg-stone-700 active:bg-stone-900 transition-colors',
                  isFirst ? 'w-full' : 'flex-[2]',
                ].join(' ')}
              >
                {stepIndex === total - 2 ? 'One more thing →' : 'Next →'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
