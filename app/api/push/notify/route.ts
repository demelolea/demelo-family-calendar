import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToSubscription, PushPayload } from '@/lib/push'
import webpush from 'web-push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// POST /api/push/notify — fan-out a notification to all subscribers except actor
export async function POST(req: NextRequest) {
  const { actor, title, body, url } = await req.json()
  if (!actor || !title || !body) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Fetch all subscriptions except the actor's
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, subscription')
    .neq('person', actor)

  if (error) {
    console.error('Notify fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, total: 0 })
  }

  const payload: PushPayload = { title, body, url: url ?? '/', tag: 'demelo' }

  // Send to all subscribers, collect expired endpoints
  const results = await Promise.all(
    subs.map(async sub => ({
      id:      sub.id,
      endpoint: sub.endpoint,
      ...(await sendPushToSubscription(
        sub.subscription as webpush.PushSubscription,
        payload,
      )),
    })),
  )

  // Clean up expired subscriptions (410/404 responses from push service)
  const expiredIds = results.filter(r => r.expired).map(r => r.id)
  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds)
  }

  const sent  = results.filter(r => r.success).length
  const total = subs.length
  return NextResponse.json({ sent, total })
}
