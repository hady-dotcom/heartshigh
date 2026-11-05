'use client'

import { useEffect } from 'react'
import { demoBoardPath, demoFramePath, isDemoRole, roleLine, roleName, type DemoRole, type ParentingCast } from '@/lib/parenting-demo'

export function DemoFrameTools({ token, role, cast, seq }: { token: string; role: DemoRole; cast: ParentingCast; seq: number }) {
  useEffect(() => {
    const stamp = () => {
      document.querySelectorAll('a[href]').forEach((node) => {
        const link = node as HTMLAnchorElement
        if (link.target === '_top' || link.dataset.demoSkip === 'yes') return
        let url: URL
        try {
          url = new URL(link.href, location.origin)
        } catch {
          return
        }
        if (url.origin !== location.origin) return
        if (url.searchParams.get('demo') === token) return
        url.searchParams.set('demo', token)
        url.searchParams.set('as', role)
        link.href = `${url.pathname}${url.search}${url.hash}`
      })
      document.querySelectorAll('form').forEach((form) => {
        const action = form.getAttribute('action') || ''
        if (action.startsWith('/api/hearts') && !action.startsWith('/api/hearts/demo')) form.action = '/api/hearts/demo'
        const add = (name: string, value: string) => {
          if (form.querySelector(`input[name="${name}"]`)) return
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = name
          input.value = value
          form.append(input)
        }
        add('demo', token)
        add('demoAs', role)
      })
    }
    stamp()
    const watch = new MutationObserver(stamp)
    watch.observe(document.body, { childList: true, subtree: true })
    return () => watch.disconnect()
  }, [role, token])

  useEffect(() => {
    let current = seq
    const tick = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/hearts/demo?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
        if (!response.ok) return
        const body = (await response.json()) as { seq?: number }
        if (typeof body.seq === 'number' && body.seq !== current) {
          current = body.seq
          location.reload()
        }
      } catch {
        // The next check will try again.
      }
    }, 1500)
    return () => window.clearInterval(tick)
  }, [seq, token])

  function step(next: DemoRole | 'all') {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'hearts-demo-step', role: next, token }, location.origin)
      return
    }
    location.href = next === 'all' ? demoBoardPath(token) : demoFramePath(next, token)
  }

  return (
    <div className="demo-role-switch" data-testid="role-switch" data-role={role}>
      <p data-testid="role-switch-line">{roleLine(cast, role)}</p>
      <div className="demo-role-switch-row">
        {(['master', 'portal', 'teacher', 'learner'] as const).map((item) => (
          <button key={item} type="button" data-testid={`role-switch-${item}`} aria-pressed={item === role} onClick={() => step(item)}>
            {item === 'master' ? cast.master : item === 'portal' ? 'Portal admin' : item === 'teacher' ? 'Teacher' : 'Learner'}
          </button>
        ))}
        <button type="button" data-testid="role-switch-back" onClick={() => step('all')}>All four screens</button>
      </div>
      <p className="demo-role-now">Signed in here as {roleName(cast, role)}</p>
    </div>
  )
}

export function listenForDemoStep(onStep: (role: DemoRole | 'all') => void) {
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== location.origin) return
    const data = event.data as { type?: string; role?: string }
    if (data?.type !== 'hearts-demo-step') return
    if (data.role === 'all' || isDemoRole(data.role)) onStep(data.role)
  }
  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}
