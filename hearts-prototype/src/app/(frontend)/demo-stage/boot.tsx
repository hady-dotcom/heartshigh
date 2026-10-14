'use client'

import { useEffect, useState } from 'react'
import { openDemoStage } from './actions'

export function BootDemo() {
  const [error, setError] = useState('')
  useEffect(() => {
    let gone = false
    openDemoStage().catch((err: unknown) => {
      if (gone) return
      const digest = err && typeof err === 'object' && 'digest' in err ? String((err as { digest?: unknown }).digest || '') : ''
      if (digest.startsWith('NEXT_REDIRECT')) return
      setError(err instanceof Error ? err.message : 'The demo stage could not open.')
    })
    return () => {
      gone = true
    }
  }, [])
  return (
    <main className="demo-boot" data-testid="demo-boot">
      <p>{error || 'Opening the demo stage…'}</p>
    </main>
  )
}
