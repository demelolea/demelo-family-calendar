/**
 * Client-side helper — fires a push notification to all other family members.
 * Non-blocking: never throws, never delays the main action.
 */
export async function notifyFamily(
  actor: string,          // person key who made the change ('jim', 'isabelle', …)
  title: string,
  body:  string,
  url?:  string,
): Promise<void> {
  try {
    await fetch('/api/push/notify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ actor, title, body, url: url ?? '/' }),
    })
  } catch {
    // Push is best-effort — never block the main action
  }
}
