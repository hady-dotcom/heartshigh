'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { EASE, T, animate, reducedMotion } from '@/lib/motion'

export type PathNode = { id: number; title: string; href: string; state: 'done' | 'active' | 'next'; grewNow?: boolean }

/** The Course Garden: one path, the active lesson marked, a seedling in each finished node (spec 7A.3 T10, T12). */
export function GardenPath({ title, nodes }: { title: string; nodes: PathNode[] }) {
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = ref.current
    if (!list) return
    const items = [...list.querySelectorAll<HTMLElement>('.gp-node')]
    const reduced = reducedMotion()
    items.slice(0, 8).forEach((el, at) => {
      animate(el, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], 300, EASE.enter, { delay: reduced ? 0 : at * 40, id: 'garden-node' })
    })
    const grew = list.querySelector<HTMLElement>('.gp-node.grew .gp-seed')
    if (grew) animate(grew, [{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)' }], T.grow, EASE.calm, { id: 'garden-grow' })
    const ring = list.querySelector<HTMLElement>('.gp-node.active .gp-ring')
    if (ring && !reduced) {
      ring.animate([{ transform: 'scale(1)', opacity: 0.9 }, { transform: 'scale(1.35)', opacity: 0 }], { duration: 2000, easing: EASE.calm, iterations: 3, delay: 300 }).id = 'garden-pulse'
    }
  }, [])
  return (
    <section className="garden-path" data-testid="garden-path">
      <p className="eyebrow">Your path · this course</p>
      <h3>{title}</h3>
      <ol ref={ref}>
        {nodes.map((node, at) => (
          <li key={node.id} className={`gp-node ${node.state}${node.grewNow ? ' grew' : ''}${at % 2 ? ' right' : ''}`} data-testid="garden-node" data-state={node.state}>
            <Link href={node.href} aria-label={`${node.title}${node.state === 'done' ? ', finished' : node.state === 'active' ? ', up next' : ''}`}>
              <span className="gp-dot">
                {node.state === 'active' ? <span className="gp-ring" aria-hidden /> : null}
                {node.state === 'done' ? (
                  <svg className="gp-seed" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                    <path d="M12 21v-8" />
                    <path d="M12 14c-3.5 0-5.5-2-6-5 3 0 5.5 1.5 6 5z" fill="currentColor" fillOpacity="0.25" />
                    <path d="M12 12c0-3 2-5 5.5-5.5-.3 3.2-2.3 5.3-5.5 5.5z" fill="currentColor" fillOpacity="0.25" />
                  </svg>
                ) : (
                  <span className="gp-num">{at + 1}</span>
                )}
              </span>
              <span className="gp-title">{node.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
