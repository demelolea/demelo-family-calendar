import webpush from 'web-push'

// Lazily configure VAPID — safe to call multiple times
let configured = false
function ensureVapid() {
  if (configured) return
  const subject   = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) return  // Keys not yet set — skip silently
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export type PushPayload = {
  title: string
  body:  string
  url?:  string
  tag?:  string
}

export async function sendPushToSubscription(
  subscription: webpush.PushSubscription,
  payload: PushPayload,
): Promise<{ success: boolean; expired?: boolean }> {
  ensureVapid()
  if (!configured) return { success: false }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return { success: true }
  } catch (err: unknown) {
    const e = err as { statusCode?: number }
    if (e.statusCode === 410 || e.statusCode === 404) {
      return { success: false, expired: true }  // subscription gone — caller should delete
    }
    console.error('Push send error:', err)
    return { success: false }
  }
}
