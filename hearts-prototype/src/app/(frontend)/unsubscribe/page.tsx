import Link from 'next/link'
import { Flash } from '@/components/app/shell'
import { BrandLockup } from '@/components/brand'
import { getPayloadClient } from '@/server/context'
import { applyUnsubscribe } from '@/server/account-actions'

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ token?: string; user?: string; kind?: string }> }) {
  const query = await searchParams
  let error = ''
  let notice = ''
  if (query.token && query.user) {
    const payload = await getPayloadClient()
    const result = await applyUnsubscribe(payload, Number(query.user), query.kind || 'all', query.token)
    if (result.ok) notice = 'You will not get that kind of email any more. Notes in the app are unchanged.'
    else error = result.error
  } else {
    error = 'This page needs the link from your email.'
  }
  return (
    <main className="door garden-door" data-testid="unsubscribe">
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>Email notes</h1>
        <Flash error={error} notice={notice} />
        <div className="door-links"><Link href="/login">Sign in</Link></div>
      </div>
    </main>
  )
}
