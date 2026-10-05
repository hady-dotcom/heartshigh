'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, type MouseEvent, type ReactNode } from 'react'

const FADE_MS = 400

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function waitForHeading(text: string) {
  const start = performance.now()
  return new Promise<void>((resolve) => {
    const check = () => {
      const heading = document.body.querySelector('h1')
      const shown = Boolean(heading && heading.getClientRects().length && (heading.textContent || '').includes(text))
      if (shown || performance.now() - start > 2500) resolve()
      else requestAnimationFrame(check)
    }
    check()
  })
}

function holdCurrentScreen() {
  const shell = document.createElement('div')
  shell.setAttribute('data-nav-fade', '')
  shell.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden;'
  const clone = document.body.cloneNode(true) as HTMLElement
  clone.querySelectorAll('script').forEach((node) => node.remove())
  clone.style.margin = '0'
  clone.style.transform = `translateY(${-window.scrollY}px)`
  clone.style.width = `${document.documentElement.clientWidth}px`
  shell.appendChild(clone)
  document.documentElement.appendChild(shell)
  return shell
}

/**
 * Crossfades into the next screen. The view-transition API drops the animation when the next
 * page is still loading, which reads as a hard cut, so the current screen is held on top and
 * faded out only after the new heading is visible.
 */
export function FadeLink({ href, className, testId, readyText, children }: { href: string; className?: string; testId?: string; readyText: string; children: ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    router.prefetch(href)
  }, [href, router])

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (reducedMotion()) return
    event.preventDefault()
    const shell = holdCurrentScreen()
    router.push(href)
    void (async () => {
      await waitForHeading(readyText)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const animation = shell.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'linear', fill: 'forwards' })
      await animation.finished.catch(() => undefined)
      shell.remove()
    })()
  }

  return (
    <Link className={className} href={href} data-testid={testId} onClick={onClick}>
      {children}
    </Link>
  )
}
