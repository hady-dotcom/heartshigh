'use client'

import { useEffect, useRef, useState } from 'react'
import { demoBoardPath, demoFramePath, isDemoRole, roleLine, type DemoRole, type ParentingCast } from '@/lib/parenting-demo'
import { listenForDemoStep } from '@/components/demo/frame-tools'

const PHONE_W = 390
const PHONE_H = 844
/** Narrow enough for the phone desk, wide enough that a quarter of a big screen stays readable. */
const DESK_W = 460
const DESK_H = 980

export function DemoBoard({ token, cast, step }: { token: string; cast: ParentingCast; step: string }) {
  const [focus, setFocus] = useState<DemoRole | 'all'>(isDemoRole(step) ? step : 'all')

  useEffect(() => listenForDemoStep((role) => {
    setFocus(role)
    const url = new URL(location.href)
    if (role === 'all') url.searchParams.delete('step')
    else url.searchParams.set('step', role)
    history.replaceState(null, '', url)
  }), [])

  function choose(role: DemoRole | 'all') {
    setFocus(role)
    const url = new URL(location.href)
    if (role === 'all') url.searchParams.delete('step')
    else url.searchParams.set('step', role)
    history.replaceState(null, '', url)
  }

  return (
    <main className="parenting-demo" data-testid="parenting-demo">
      <header className="parenting-demo-bar">
        <div>
          <p className="parenting-demo-kicker">Cast your demo</p>
          <h1>Four screens</h1>
        </div>
        <div className="parenting-demo-switch" data-testid="role-switch">
          <button type="button" data-testid="role-switch-all" aria-pressed={focus === 'all'} onClick={() => choose('all')}>All four</button>
          {(['master', 'portal', 'teacher', 'learner'] as const).map((role) => (
            <button key={role} type="button" data-testid={`role-switch-${role}`} aria-pressed={focus === role} onClick={() => choose(role)}>
              {role === 'master' ? cast.master : role === 'portal' ? 'Portal admin' : role === 'teacher' ? 'Teacher' : 'Learner'}
            </button>
          ))}
        </div>
        <form action="/api/hearts/demo" method="post">
          <input type="hidden" name="action" value="reset" />
          <input type="hidden" name="demo" value={token} />
          <input type="hidden" name="next" value={demoBoardPath(token, focus === 'all' ? '' : focus)} />
          <button className="parenting-demo-reset" type="submit" data-testid="demo-reset">Start again</button>
        </form>
      </header>
      <div className="parenting-demo-board" data-testid="demo-board" data-step={focus}>
        {(['master', 'portal', 'teacher', 'learner'] as const).map((role) => (
          <section key={role} className="parenting-demo-cell" data-role={role} data-testid={`demo-panel-${role}`} hidden={focus !== 'all' && focus !== role}>
            <p className="parenting-demo-caption">{roleLine(cast, role)}</p>
            <Frame src={demoFramePath(role, token)} phone={role === 'learner'} testId={`demo-${role}-frame`} />
          </section>
        ))}
      </div>
    </main>
  )
}

function Frame({ src, phone, testId }: { src: string; phone: boolean; testId: string }) {
  const frameW = phone ? PHONE_W : DESK_W
  const frameH = phone ? PHONE_H : DESK_H
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(phone ? 1 : 0.28)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => {
      const width = el.clientWidth
      if (!width) return
      setScale(Math.min(1, width / frameW))
    }
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [frameW])
  return (
    <div ref={box} className={phone ? 'parenting-demo-phone' : 'parenting-demo-desk'}>
      <div style={{ height: Math.max(220, Math.round(frameH * scale)), overflow: 'hidden' }}>
        <iframe
          title={testId}
          data-testid={testId}
          src={src}
          style={{ width: frameW, height: frameH, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left', background: '#fff' }}
        />
      </div>
    </div>
  )
}
