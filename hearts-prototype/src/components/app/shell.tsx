import Link from 'next/link'
import type { ReactNode } from 'react'
import { InsightTracker } from '@/components/app/insight-tracker'
import { RouteFade } from '@/components/app/route-fade'

export { TabBar, type Tab } from './tab-bar'

export function Flash({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error ? <div className="flash error" role="alert" data-testid="error">{error}</div> : null}
      {notice ? <div className="flash notice" role="status" data-testid="notice">{notice}</div> : null}
    </>
  )
}

export function AppFrame({ children, dark = false, evening = false, testId, trendsOptIn, tone }: { children: ReactNode; dark?: boolean; evening?: boolean; testId?: string; trendsOptIn?: boolean; tone?: 'gather' }) {
  const gather = tone === 'gather'
  return (
    <div className={`app-stage${evening ? ' evening' : ''}${gather ? ' gather-stage' : ''}`}>
      <main className={`app${dark ? ' dark' : ''}${evening ? ' evening' : ''}${gather ? ' gather-shell' : ''}`} data-testid={testId}>
        <InsightTracker trendsOptIn={trendsOptIn} />
        <RouteFade>{children}</RouteFade>
      </main>
    </div>
  )
}

export function Back({ href, label }: { href: string; label: string }) {
  return (
    <Link className="back" href={href} data-testid="back">
      ‹ {label}
    </Link>
  )
}

export function Hidden({ fields }: { fields: Record<string, string | number | undefined | null> }) {
  return Object.entries(fields).map(([name, value]) => {
    if (value === undefined || value === null) return null
    return <input key={name} type="hidden" name={name} defaultValue={String(value)} suppressHydrationWarning />
  })
}
