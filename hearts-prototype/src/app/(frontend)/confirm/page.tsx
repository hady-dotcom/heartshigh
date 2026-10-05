import Link from 'next/link'
import { Flash } from '@/components/app/shell'
import { BrandLockup } from '@/components/brand'
import { PageHelp } from '@/components/app/page-help'
import { getPayloadClient } from '@/server/context'
import { confirmEmailToken } from '@/server/account-actions'

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string; email?: string }> }) {
  const query = await searchParams
  const token = query.token || ''
  let error = ''
  let notice = ''
  if (token) {
    const payload = await getPayloadClient()
    const result = await confirmEmailToken(payload, token)
    if (result.ok) notice = result.notice
    else error = result.error
  } else {
    error = 'This page needs the link from your email.'
  }
  return (
    <main className="door garden-door" data-testid="confirm">
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>Confirm your email <PageHelp topic="confirm" /></h1>
        <Flash error={error} notice={notice} />
        <div className="door-links"><Link href="/login">Sign in</Link></div>
      </div>
    </main>
  )
}
