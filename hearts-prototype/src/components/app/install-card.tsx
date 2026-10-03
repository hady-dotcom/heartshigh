'use client'

import { useEffect, useState } from 'react'
import {
  INSTALL_DISMISSED_KEY,
  INSTALL_INSTALLED_KEY,
  INSTALL_SKIP,
  hasInstallPrompt,
  installCopy,
  installEntry,
  installKind,
  isDisplayStandalone,
  offersInstallButton,
  readInstallFlags,
  shouldShowInstall,
  type HeldInstallPrompt,
  type InstallGlyph,
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
  try { flags = readInstallFlags(window.localStorage) } catch { /* private browsing */ }
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

function Glyph({ name }: { name: InstallGlyph }) {
  if (name === 'share') {
    return (
      <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 10.5H6.2A1.7 1.7 0 0 0 4.5 12.2v6.1A1.7 1.7 0 0 0 6.2 20h11.6a1.7 1.7 0 0 0 1.7-1.7v-6.1a1.7 1.7 0 0 0-1.7-1.7H16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M12 15.2V4.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8.2 7.4 12 3.8l3.8 3.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'menu') {
    return (
      <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="5.5" r="1.6" fill="currentColor" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        <circle cx="12" cy="18.5" r="1.6" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** The first-open card. Pass forced when Me opens it again after a dismissal. */
export function InstallCard({ forced = false, onDismiss }: { forced?: boolean; onDismiss?: () => void }) {
  const [state, setState] = useInstallState()
  const [busy, setBusy] = useState(false)
  if (!state) return null
  const prompt = state.prompt && offersInstallButton(state.kind)
  if (!shouldShowInstall({ standalone: state.standalone, dismissed: state.dismissed, installed: state.installed, forced })) return null
  const copy = installCopy(state.kind, prompt)

  const dismiss = () => {
    try { localStorage.setItem(INSTALL_DISMISSED_KEY, '1') } catch { /* private mode */ }
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
    <section className="card install-card" data-testid="install-card" data-kind={state.kind} data-prompt={prompt ? 'yes' : 'no'}>
      <h2>{copy.heading}</h2>
      <p className="install-lead">{copy.lead}</p>
      {copy.note ? <p className="install-note">{copy.note}</p> : null}
      {copy.steps.length ? (
        <ol className="install-steps">
          {copy.steps.map((step, index) => (
            <li className="install-step" key={step.glyph}>
              <span className="install-glyph" aria-hidden="true"><Glyph name={step.glyph} /></span>
              <p><span className="sr-only">Step {index + 1}. </span>{step.text}</p>
            </li>
          ))}
        </ol>
      ) : null}
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
  if (!state) return null
  const installed = state.installed || state.standalone
  const entry = installEntry(state.kind, installed)
  return (
    <>
      {installed ? (
        <div className="list-link" data-testid="keep-hearts" data-state="installed">
          <span className="grow">{entry.title}<small>{entry.hint}</small></span>
        </div>
      ) : (
        <button type="button" className="list-link" data-testid="keep-hearts" data-state={open ? 'open' : 'ready'} aria-expanded={open} onClick={() => setOpen(true)}>
          <span className="grow">{entry.title}<small>{entry.hint}</small></span>
          <span aria-hidden="true">›</span>
        </button>
      )}
      {open && !installed ? <InstallCard forced onDismiss={() => setOpen(false)} /> : null}
    </>
  )
}
