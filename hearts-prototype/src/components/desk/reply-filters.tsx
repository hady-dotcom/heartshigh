'use client'

import { useEffect, useState } from 'react'
import { queuePath, type QueueStatus } from '@/lib/reply-queue'

type Choice = { value: string; label: string }

export function ReplyFilters({
  base,
  status,
  portal,
  learnerId,
  portals,
  learners,
  showAllPortals,
}: {
  base: string
  status: QueueStatus
  portal: string
  learnerId: number | null
  portals: Choice[]
  learners: Choice[]
  showAllPortals: boolean
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  function hrefFor(next: { status?: QueueStatus; portal?: string; learnerId?: number | null }) {
    const portalChoice = next.portal ?? portal
    return queuePath(base, {
      status: next.status ?? status,
      portal: portalChoice === 'all' ? 'all' : portalChoice,
      learnerId: next.learnerId === undefined ? learnerId : next.learnerId,
    })
  }
  function go(next: { status?: QueueStatus; portal?: string; learnerId?: number | null }) {
    window.location.assign(hrefFor(next))
  }
  return (
    <div className="reply-filters" data-testid="reply-filters" data-ready={ready ? 'yes' : 'no'}>
      <div className="reply-status" role="tablist" aria-label="Which answers">
        {(['unanswered', 'all', 'answered'] as const).map((key) => (
          <a key={key} className={status === key ? 'on' : ''} href={hrefFor({ status: key })} data-testid={`queue-filter-${key}`} aria-pressed={status === key}>
            {key === 'unanswered' ? 'Unanswered' : key === 'all' ? 'All' : 'Answered'}
          </a>
        ))}
      </div>
      <label className="reply-pick">
        Portal
        <select data-testid="queue-portal" value={portal || 'all'} onChange={(event) => go({ portal: event.target.value, learnerId: null })}>
          {showAllPortals ? <option value="all">All portals</option> : null}
          {portals.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="reply-pick">
        Learner
        <select data-testid="queue-learner" value={learnerId ? String(learnerId) : ''} onChange={(event) => go({ learnerId: event.target.value ? Number(event.target.value) : null })}>
          <option value="">All learners</option>
          {learners.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
    </div>
  )
}
