import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { AppleSearch } from '@/components/app/apple-search'
import { MODERN_ACCENT } from '@/lib/portal-look'
import { InsightTracker } from '@/components/app/insight-tracker'
import { PageHelp } from '@/components/app/page-help'
import { RouteFade } from '@/components/app/route-fade'
import { ScrollChrome } from '@/components/app/scroll-chrome'

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

export function AppFrame({ children, dark = false, evening = false, testId, tone, help, trendsOptIn, brand, art, wash, btn }: { children: ReactNode; dark?: boolean; evening?: boolean; testId?: string; tone?: 'gather'; help?: string; trendsOptIn?: boolean; art?: string | null; wash?: string | null; btn?: string | null; brand?: { colour: string; accent: string; name?: string; shell?: 'modern' | 'hearts'; font?: string; scene?: boolean; sceneCss?: string | null } | null }) {
  const gather = tone === 'gather'
  const modern = brand?.shell === 'modern'
  const night = Boolean(evening) && !modern
  const paint = Boolean(brand) && !(brand?.shell === 'hearts' && !brand?.name)
  const branded = {
    ...(paint && brand ? { '--portal-colour': MODERN_ACCENT, '--portal-accent': MODERN_ACCENT } : {}),
    ...(brand?.sceneCss ? { '--scene': brand.sceneCss } : {}),
    ...(art ? { '--art': art } : {}),
    ...(wash ? { '--page': wash } : {}),
    ...(btn ? { '--btn': btn } : {}),
  } as CSSProperties
  const showWord = Boolean(brand?.name) && testId !== 'welcome' && testId !== 'welcome-films'
  return (
    <div className={`app-stage shell-modern${night ? ' evening' : ''}${gather ? ' gather-stage' : ''}${modern && brand?.scene ? ' has-scene' : ''}`} data-portal-brand={brand?.name ? 'yes' : undefined} data-font={modern ? brand?.font || 'system' : 'system'} data-shell={modern ? 'modern' : undefined} style={Object.keys(branded).length ? branded : undefined}>
      <main className={`app${dark ? ' dark' : ''}${night ? ' evening' : ''}${gather ? ' gather-shell' : ''}`} data-testid={testId}>
        {modern ? (
          <header className="glass-bar">
            <div className="glass-row">
              {showWord ? <p className="brand-word shell-brand" data-testid="portal-brand">{brand?.name}</p> : <span />}
              <p className="bar-title" data-testid="bar-title" aria-hidden="true" />
              <PageHelp page={help || testId} plain />
            </div>
            <AppleSearch />
            <ScrollChrome />
          </header>
        ) : (
          <PageHelp page={help || testId} plain={false} />
        )}
        <InsightTracker trendsOptIn={trendsOptIn} />
        {modern || !showWord ? null : <p className="brand-word shell-brand" data-testid="portal-brand">{brand?.name}</p>}
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
