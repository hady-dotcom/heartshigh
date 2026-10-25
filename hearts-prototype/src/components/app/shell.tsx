import Link from 'next/link'
import { useContext, type CSSProperties, type ReactNode } from 'react'
import { InsightTracker } from '@/components/app/insight-tracker'
import { PageHelp } from '@/components/app/page-help'
import { PortalBrandContext } from '@/components/app/portal-brand'
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

export function AppFrame({ children, dark = false, evening = false, testId, tone, help, trendsOptIn, brand: brandProp }: { children: ReactNode; dark?: boolean; evening?: boolean; testId?: string; tone?: 'gather'; help?: string; trendsOptIn?: boolean; brand?: { colour: string; accent: string; name?: string } | null }) {
  const inherited = useContext(PortalBrandContext)
  const colour = brandProp?.colour || inherited?.colour
  const accent = brandProp?.accent || inherited?.accent
  const name = brandProp?.name || inherited?.name || ''
  const brand = colour && accent ? { colour, accent, name } : null
  const gather = tone === 'gather'
  const branded = brand ? ({ '--portal-colour': brand.colour, '--portal-accent': brand.accent } as CSSProperties) : undefined
  const showWord = Boolean(name) && testId !== 'welcome' && testId !== 'welcome-films'
  return (
    <div className={`app-stage${evening ? ' evening' : ''}${gather ? ' gather-stage' : ''}`} data-portal-brand={brand ? 'yes' : undefined} style={branded}>
      <main className={`app${dark ? ' dark' : ''}${evening ? ' evening' : ''}${gather ? ' gather-shell' : ''}`} data-testid={testId}>
        <PageHelp page={help || testId} />
        <InsightTracker trendsOptIn={trendsOptIn} />
        {showWord ? <p className="brand-word shell-brand" data-testid="portal-brand">{name}</p> : null}
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
