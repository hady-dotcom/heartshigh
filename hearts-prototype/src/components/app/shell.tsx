import Link from 'next/link'
import type { ReactNode } from 'react'
import { RouteFade } from '@/components/app/route-fade'

export { TabBar, type Tab } from './tab-bar'

function flashText(value: unknown) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(' ')
  return ''
}

export function Flash({ error, notice }: { error?: string | string[]; notice?: string | string[] }) {
  const problem = flashText(error)
  const ok = flashText(notice)
  return (
    <>
      {problem ? <div className="flash error" role="alert" data-testid="error">{problem}</div> : null}
      {ok ? <div className="flash notice" role="status" data-testid="notice">{ok}</div> : null}
    </>
  )
}

export function AppFrame({ children, dark = false, evening = false, testId, tone }: { children: ReactNode; dark?: boolean; evening?: boolean; testId?: string; tone?: 'gather' }) {
  const gather = tone === 'gather'
  return (
    <div className={`app-stage${evening ? ' evening' : ''}${gather ? ' gather-stage' : ''}`}>
      <main className={`app${dark ? ' dark' : ''}${evening ? ' evening' : ''}${gather ? ' gather-shell' : ''}`} data-testid={testId}>
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
  return (
    <>
      {Object.entries(fields).map(([name, value]) => (value === undefined || value === null ? null : <input key={name} type="hidden" name={name} value={String(value)} suppressHydrationWarning />))}
    </>
  )
}
