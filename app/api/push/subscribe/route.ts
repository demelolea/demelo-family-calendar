import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// POST /api/push/subscribe — save a push subscription for a family member
export async function POST(req: NextRequest) {
  const { person, subscription } = await req.json()
  if (!person || !subscription?.endpoint) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { person, endpoint: subscription.endpoint, subscription },
      { onConflict: 'endpoint' },
    )

  if (error) {
    console.error('Subscribe upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/push/subscribe — remove a subscription by endpoint
export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json()
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return NextResponse.json({ success: true })
}
