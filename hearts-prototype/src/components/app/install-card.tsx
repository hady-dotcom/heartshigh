'use client'

import { useEffect, useState } from 'react'
import { InstallSlides } from '@/components/app/install-demo'
import {
  INSTALL_AGAIN,
  INSTALL_DISMISSED_KEY,
  INSTALL_INSTALLED_KEY,
  INSTALL_SKIP,
  dismissUntil,
  hasInstallPrompt,
  installCopy,
  installEntry,
  installKind,
  installSlides,
  isDisplayStandalone,
  offersInstallButton,
  readInstallFlags,
  shouldShowInstall,
  type HeldInstallPrompt,
  type InstallKind,
} from '@/lib/install-prompt'

type InstallState = {
  kind: InstallKind
  standalone: boolean
  dismissed: boolean
  installed: boolean
  prompt: boolean
}

function readState(): InstallState {
  let flags = { dismissed: false, installed: false }
  try { flags = readInstallFlags(window.localStorage, document.cookie) } catch { /* private browsing */ }
  const nav = navigator as Navigator & { standalone?: boolean }
  const media = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
  return {
    kind: installKind(navigator.userAgent, { maxTouchPoints: navigator.maxTouchPoints || 0 }),
    standalone: isDisplayStandalone(media, nav.standalone),
    dismissed: flags.dismissed,
    installed: flags.installed,
    prompt: hasInstallPrompt(window.__heartsBeforeInstall),
  }
}

function useInstallState() {
  const [state, setState] = useState<InstallState | null>(null)
  useEffect(() => {
    const sync = () => setState(readState())
    sync()
    window.addEventListener('hearts-install-ready', sync)
    window.addEventListener('hearts-installed', sync)
    return () => {
      window.removeEventListener('hearts-install-ready', sync)
      window.removeEventListener('hearts-installed', sync)
    }
  }, [])
  return [state, setState] as const
}

/**
 * The first-open card. Pass forced when Me opens it again after a dismissal. On Home it is a sheet over the page,
 * because it can only be known after the page has loaded, and pushing Home down then would shift everything.
 */
export function InstallCard({ forced = false, onDismiss, sheet = false }: { forced?: boolean; onDismiss?: () => void; sheet?: boolean }) {
  const [state, setState] = useInstallState()
  const [busy, setBusy] = useState(false)
  if (!state) return null
  const prompt = state.prompt && offersInstallButton(state.kind)
  if (!shouldShowInstall({ standalone: state.standalone, dismissed: state.dismissed, installed: state.installed, forced })) return null
  const copy = installCopy(state.kind, prompt)

  const dismiss = () => {
    const until = dismissUntil()
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, until)
      document.cookie = `${INSTALL_DISMISSED_KEY}=${encodeURIComponent(until)}; Max-Age=${30 * 24 * 60 * 60}; Path=/; SameSite=Lax`
    } catch { /* private mode */ }
    setState({ ...state, dismissed: true })
    onDismiss?.()
  }

  const add = async () => {
    const held: HeldInstallPrompt | null | undefined = window.__heartsBeforeInstall
    if (!held || busy) return
    setBusy(true)
    try {
      await held.prompt()
      const choice = await held.userChoice
      window.__heartsBeforeInstall = null
      if (choice?.outcome === 'accepted') {
        try { localStorage.setItem(INSTALL_INSTALLED_KEY, '1') } catch { /* private mode */ }
        try {
          const { track } = await import('@/lib/experiment-track')
          track('install_card_accept', { kind: state.kind })
        } catch { /* ignore */ }
        setState({ ...state, installed: true, prompt: false })
        return
      }
      setState({ ...state, prompt: false })
    } catch {
      setState({ ...state, prompt: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`card install-card${sheet ? ' sheet' : ''}`} data-testid="install-card" data-kind={state.kind} data-prompt={prompt ? 'yes' : 'no'} role={sheet ? 'dialog' : undefined} aria-label={sheet ? copy.heading : undefined}>
      <h2>{copy.heading}</h2>
      <p className="install-lead">{copy.lead}</p>
      {copy.note ? <p className="install-note">{copy.note}</p> : null}
      {installSlides(state.kind).length ? <InstallSlides kind={state.kind} /> : null}
      {copy.manual ? <p className="install-manual">{copy.manual}</p> : null}
      <div className="install-actions">
        {copy.action ? (
          <button type="button" className="pill gold block" data-testid="install-action" disabled={busy} onClick={add}>{copy.action}</button>
        ) : null}
        <button type="button" className="install-skip" data-testid="install-skip" onClick={dismiss}>{INSTALL_SKIP}</button>
      </div>
    </section>
  )
}

/** Me can open the card again. An installed app shows a short confirmation instead. */
export function KeepHearts() {
  const [state] = useInstallState()
  const [open, setOpen] = useState(false)
  const [run, setRun] = useState(0)
  if (!state) return null
  const installed = state.installed || state.standalone
  const entry = installEntry(state.kind, installed)
  const show = () => {
    setRun((n) => n + 1)
    setOpen(true)
  }
  return (
    <>
      {installed ? (
        <div className="list-link" data-testid="keep-hearts" data-state="installed">
          <span className="grow">{entry.title}<small>{entry.hint}</small></span>
        </div>
      ) : (
        <button type="button" className="list-link" data-testid="keep-hearts" data-state={open ? 'open' : 'ready'} aria-expanded={open} onClick={show}>
          <span className="grow">{entry.title}<small>{entry.hint}</small></span>
          <span aria-hidden="true">›</span>
        </button>
      )}
      {!installed ? (
        <button type="button" className="install-again" data-testid="show-again" onClick={show}>{INSTALL_AGAIN}</button>
      ) : null}
      {open && !installed ? <InstallCard key={run} forced onDismiss={() => setOpen(false)} /> : null}
    </>
  )
}
