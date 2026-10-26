'use client'

import { useEffect, useState } from 'react'
import { readGuestDevice, rememberGuestAnswer } from '@/lib/guest-device'

export type WorkbookCard = {
  vimeoId: string
  title: string
  prompt: string
  place: number
  lessonId: number | null
  courseId: number | null
  pointId: number | null
  href: string | null
  mine: string
  others: { name: string; body: string }[]
}

export function ParentWorkbookBoard({ films, signedIn, next }: { films: WorkbookCard[]; signedIn: boolean; next: string }) {
  const [phone, setPhone] = useState<Record<number, string>>({})
  const [note, setNote] = useState('')
  useEffect(() => {
    const saved = readGuestDevice()
    const found: Record<number, string> = {}
    for (const row of saved.answers) {
      if (row.pointId && row.body.trim()) found[row.pointId] = row.body
    }
    setPhone(found)
  }, [])
  return (
    <div data-testid="workbook-list">
      {films.map((film) => {
        const own = (film.pointId && phone[film.pointId]) || film.mine
        return (
          <article key={film.vimeoId} className="workbook-film" data-testid="workbook-film" data-vimeo={film.vimeoId}>
            <p className="eyebrow">Film {film.place}</p>
            <h2>{film.title}</h2>
            {film.href ? <a href={film.href}>Open this film</a> : null}
            <p className="workbook-question" data-testid="workbook-question">{film.prompt}</p>
            <p className="eyebrow">Your answer</p>
            {own ? <p className="workbook-own" data-testid="workbook-own">{own}</p> : <p className="workbook-prompt" data-testid="workbook-write">Write your answer</p>}
            {film.pointId && !signedIn ? (
              <form
                key={own || 'new'}
                onSubmit={(event) => {
                  event.preventDefault()
                  const body = String(new FormData(event.currentTarget).get('body') || '')
                  if (!body.trim() || !film.lessonId) return
                  rememberGuestAnswer({ lessonId: film.lessonId, pointId: film.pointId || undefined, title: film.prompt, body })
                  setPhone((current) => ({ ...current, [film.pointId as number]: body.trim() }))
                  setNote('Saved on this phone.')
                }}
              >
                <textarea name="body" rows={3} defaultValue={own} placeholder="Write your answer" data-testid="workbook-text" />
                <button type="submit" className="pill" data-testid="workbook-save">Save on this phone</button>
              </form>
            ) : null}
            {film.pointId && signedIn ? (
              <form action="/api/hearts" method="post">
                <input type="hidden" name="action" value="answer" />
                <input type="hidden" name="point" value={film.pointId} />
                <input type="hidden" name="next" value={next} />
                <textarea name="body" rows={3} defaultValue={own} required placeholder="Write your answer" data-testid="workbook-text" />
                <button type="submit" className="pill" data-testid="workbook-save">Save in your workbook</button>
              </form>
            ) : null}
            <p className="eyebrow">Other parents</p>
            <ul className="workbook-others">
              {film.others.map((row) => (
                <li key={row.name} data-testid="workbook-other">
                  <b>{row.name}</b>
                  <p>{row.body}</p>
                </li>
              ))}
            </ul>
          </article>
        )
      })}
      {note ? <p data-testid="workbook-saved">{note}</p> : null}
    </div>
  )
}
