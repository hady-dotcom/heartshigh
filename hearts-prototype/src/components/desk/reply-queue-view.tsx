import Link from 'next/link'
import { Hidden } from '@/components/app/shell'
import { ReplyFilters } from '@/components/desk/reply-filters'
import { ReplyKeys } from '@/components/desk/reply-keys'
import {
  earlierCards,
  filterQueue,
  leftCount,
  nextUnanswered,
  queuePath,
  queueStatus,
  stepCard,
  type QueueCard,
  type QueueStatus,
} from '@/lib/reply-queue'

export function ReplyQueueView({
  base,
  cards,
  portals,
  query,
  currentSlug,
  canSeeAllPortals,
  canReply,
}: {
  base: string
  cards: QueueCard[]
  portals: { id: number; slug: string; label: string }[]
  query: { queue?: string; queuePortal?: string; learner?: string; answer?: string }
  currentSlug: string
  canSeeAllPortals: boolean
  canReply: boolean
}) {
  const status: QueueStatus = queueStatus(query.queue)
  const portalChoice = query.queuePortal || currentSlug
  const portalSlug = portalChoice === 'all' ? null : portalChoice
  const learnerId = Number(query.learner) || null
  const scope = { portalSlug, learnerId }
  const visible = filterQueue(cards, { status, ...scope })
  const openId = Number(query.answer) || 0
  const open = visible.find((card) => card.id === openId) || null
  const left = leftCount(cards, scope)
  const learnerOptions = filterQueue(cards, { status: 'all', portalSlug, learnerId: null })
    .reduce<{ value: string; label: string }[]>((list, card) => {
      if (!list.some((item) => item.value === String(card.learnerId))) list.push({ value: String(card.learnerId), label: card.learner })
      return list
    }, [])
    .sort((a, b) => a.label.localeCompare(b.label))
  const nextOpen = open ? nextUnanswered(cards, open.id, scope) : null
  const nextCard = stepCard(visible, open?.id || 0, 1)
  const prevCard = open ? stepCard(visible, open.id, -1) : null
  const pathFor = (answerId?: number | null) => queuePath(base, { status, portal: portalChoice === currentSlug ? null : portalChoice, learnerId, answerId })
  const skipHref = nextOpen ? pathFor(nextOpen.id) : pathFor(null)
  const nextHref = nextCard ? pathFor(nextCard.id) : open ? '' : visible[0] ? pathFor(visible[0].id) : ''
  const prevHref = prevCard ? pathFor(prevCard.id) : open ? '' : visible.length ? pathFor(visible[visible.length - 1].id) : ''
  const playHref = (card: QueueCard) => card.courseId && card.lessonId ? `/p/${card.portalSlug || currentSlug}/course/${card.courseId}?part=${card.lessonId}&t=${Math.max(0, card.second)}` : ''

  return (
    <div data-testid="reply-queue">
      <ReplyKeys nextHref={nextHref} prevHref={prevHref} />
      <div className="reply-bar">
        <p data-testid="queue-left"><b>{left}</b> left</p>
        <p className="hint">On a laptop, Ctrl+Enter sends. J and K move between cards.</p>
      </div>
      <ReplyFilters
        base={base}
        status={status}
        portal={portalChoice}
        learnerId={learnerId}
        portals={portals.map((portal) => ({ value: portal.slug, label: portal.label }))}
        learners={learnerOptions}
        showAllPortals={canSeeAllPortals && portals.length > 1}
      />
      <div className={open ? 'reply-split' : ''}>
        <div className="reply-cards">
          {visible.map((card) => {
            const focused = open?.id === card.id
            return (
              <Link key={card.id} id={`shared-answer-${card.id}`} className="lib-card reply-card" href={pathFor(card.id)} data-testid="shared-answer" data-focused={focused ? 'yes' : 'no'} data-learner={card.learnerId} data-portal={card.portalSlug}>
                <b>{card.learner}</b>
                <span className="hint" data-testid="shared-answer-place">{card.talk} · at {card.minute}</span>
                {card.question ? <span className="hint" data-testid="shared-answer-question">{card.question}</span> : null}
                <span data-testid="shared-answer-text">{card.answer}</span>
              </Link>
            )
          })}
          {!visible.length ? <p className="hint" data-testid="queue-none">Nothing in this list.</p> : null}
        </div>
        {open ? (
          <article className="reply-focus" id="reply-focus" data-testid="reply-focus">
            <h3 data-testid="reply-learner">{open.learner}</h3>
            <p className="hint" data-testid="reply-talk">{open.talk} at {open.minute}</p>
            {playHref(open) ? <a className="btn ghost small" data-testid="play-from-minute" href={playHref(open)}>Play from this minute</a> : null}
            {open.question ? <p data-testid="reply-question">{open.question}</p> : null}
            <p data-testid="reply-full-answer">{open.answer}</p>
            {open.reply ? <p data-testid="queue-saved-reply">Your reply: {open.reply}</p> : null}
            {earlierCards(cards, open).length ? (
              <details data-testid="earlier-answers">
                <summary>Earlier answers</summary>
                {earlierCards(cards, open).map((card) => (
                  <div key={card.id} data-testid="earlier-answer">
                    <p className="hint">{card.talk} at {card.minute}</p>
                    {card.question ? <p>{card.question}</p> : null}
                    <p>{card.answer}</p>
                  </div>
                ))}
              </details>
            ) : null}
            {canReply && open.entryId ? (
              <>
                <form className="form" action="/api/hearts" method="post" data-testid="queue-send-form">
                  <Hidden fields={{ action: 'reply', entry: open.entryId, answer: open.id, href: `/p/${open.portalSlug || currentSlug}/garden/workbook/${open.id}`, next: skipHref }} />
                  <label className="stack">
                    Reply
                    <textarea name="reply" required data-testid="queue-reply" placeholder="Write a reply. They will see it in their workbook." />
                  </label>
                  <div className="reply-actions">
                    <button className="btn ink" type="submit" data-testid="queue-send">Send</button>
                    <a className="btn ghost" data-testid="queue-skip" href={skipHref}>Skip</a>
                    {prevCard ? <a className="btn ghost" data-testid="queue-previous" href={pathFor(prevCard.id)}>Previous</a> : <span className="btn ghost" data-testid="queue-previous" aria-disabled="true">Previous</span>}
                  </div>
                </form>
                <form action="/api/hearts" method="post">
                  <Hidden fields={{ action: 'reply-done', entry: open.entryId, answer: open.id, next: skipHref }} />
                  <button className="btn ghost" type="submit" data-testid="queue-done">Mark done</button>
                </form>
              </>
            ) : null}
          </article>
        ) : null}
      </div>
    </div>
  )
}
