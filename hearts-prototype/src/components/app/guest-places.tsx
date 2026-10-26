'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeepPlaceSheet } from '@/components/journey/sheet'
import { dismissGuestOffer, readGuestDevice, rememberGuestName, rememberGuestWeekdays, type GuestDeviceState } from '@/lib/guest-device'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

async function offerAccount(account: { name: string; email: string; password: string }, portal: string) {
  const response = await fetch(`/api/workbook/opening?portal=${portal}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scenesVersion: 1, taps: [], account }),
  }).catch(() => null)
  if (!response) return 'That did not go through. Check your connection and try again.'
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) return data.error || 'That did not go through. Please try again.'
  window.location.assign(window.location.pathname)
  return null
}

function KeepOffer({ portal, loginHref }: { portal: string; loginHref: string }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" className="guest-offer" data-testid="keep-offer" onClick={() => setOpen(true)}>
        Keep my place on another phone
      </button>
    )
  }
  return (
    <KeepPlaceSheet
      gentle
      reason="place"
      loginHref={loginHref}
      offline={false}
      onClose={() => { dismissGuestOffer(); setOpen(false) }}
      onSubmit={(account) => offerAccount(account, portal)}
    />
  )
}

/** A done tick for a film this phone has already finished. */
export function GuestDone({ lessonId }: { lessonId: number }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    setDone(readGuestDevice().progress.some((row) => row.lessonId === lessonId && row.done))
  }, [lessonId])
  if (!done) return null
  return <span className="done-check" data-testid="film-done">Done</span>
}

/** Continue from the film saved on this phone. The first paint matches a new visit. */
export function GuestCourseResume({ base, courseId, total, firstId, firstPlace }: { base: string; courseId: number; total: number; firstId: number | null; firstPlace: number }) {
  const [href, setHref] = useState(firstId ? `${base}/course/${courseId}?part=${firstId}` : `${base}/courses`)
  const [label, setLabel] = useState(`Start film ${firstPlace}`)
  const [line, setLine] = useState(`0 of ${total} films`)
  useEffect(() => {
    const mine = readGuestDevice().progress.filter((row) => row.courseId === courseId)
    const finished = new Set(mine.filter((row) => row.done).map((row) => row.lessonId))
    setLine(`${finished.size} of ${total} films`)
    const open = mine.find((row) => !row.done)
    if (open) {
      setHref(`${base}/course/${courseId}?part=${open.lessonId}`)
      setLabel(`Continue film ${open.place}`)
    }
  }, [base, courseId, total])
  return (
    <>
      <p data-testid="sequence-progress">{line}</p>
      {firstId ? <Link className="pill gold block" href={href} data-testid="start-part">{label}</Link> : null}
    </>
  )
}

export function GuestWeekBody({ base, portal }: { base: string; portal: string }) {
  const [state, setState] = useState<GuestDeviceState | null>(null)
  const [days, setDays] = useState<number[]>([])
  useEffect(() => {
    const saved = readGuestDevice()
    setState(saved)
    setDays(saved.weekdays)
  }, [])
  const latest = state?.progress[0]
  const toggle = (day: number) => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort())
  return (
    <div className="app-scroll">
      <div className="app-head"><h1>My week</h1></div>
      <p className="guest-blurb">Your week stays on this phone. Nothing here asks you to sign in.</p>
      {latest ? (
        <a className="guest-catalog" href={latest.courseId ? `${base}/course/${latest.courseId}?part=${latest.lessonId}` : `${base}/courses`} data-testid="week-continue">
          <span>
            <b>{latest.done ? 'Watch again' : 'Continue'}</b>
            <small>{latest.place}. {latest.title}</small>
          </span>
          <span aria-hidden>›</span>
        </a>
      ) : (
        <p className="card" data-testid="week-empty">Films you start show up here. <a href={`${base}/courses`}>Browse courses</a></p>
      )}
      <form className="card guest-week-form" onSubmit={(event) => { event.preventDefault(); setState(rememberGuestWeekdays(days)) }}>
        <p className="eyebrow">Days that suit you</p>
        <div className="guest-days" role="group" aria-label="Days">
          {DAYS.map((label, day) => (
            <label key={label}>
              <input type="checkbox" checked={days.includes(day)} onChange={() => toggle(day)} />
              {label}
            </label>
          ))}
        </div>
        <button type="submit" className="pill gold" data-testid="week-save">Save on this phone</button>
        {state?.weekdays.length ? <p data-testid="week-saved">Saved for {state.weekdays.map((day) => DAYS[day]).join(', ')}.</p> : null}
      </form>
    </div>
  )
}

export function GuestMeBody({ base, portal }: { base: string; portal: string }) {
  const [state, setState] = useState<GuestDeviceState | null>(null)
  const [name, setName] = useState('')
  const [opening, setOpening] = useState(0)
  useEffect(() => {
    const saved = readGuestDevice()
    setState(saved)
    setName(saved.name)
    try {
      const heart = JSON.parse(window.localStorage.getItem('hearts.heart.v1') || 'null') as { taps?: { option?: string }[] } | null
      setOpening((heart?.taps || []).filter((tap) => tap.option && tap.option !== 'pass').length)
    } catch {
      setOpening(0)
    }
  }, [])
  const loginHref = `/login?next=${encodeURIComponent(`${base}/me`)}`
  return (
    <div className="app-scroll">
      <div className="app-head"><h1>Me</h1></div>
      <p className="guest-blurb">Your name, films and answers stay on this phone.</p>
      <form className="card" onSubmit={(event) => { event.preventDefault(); setState(rememberGuestName(name)) }}>
        <label htmlFor="guest-name">What should we call you?</label>
        <input id="guest-name" className="field" value={name} maxLength={80} data-testid="name-input" onChange={(event) => setName(event.target.value)} />
        <button type="submit" className="pill gold" data-testid="name-save">Save on this phone</button>
        {state?.name ? <p data-testid="me-name">{state.name}</p> : null}
      </form>
      <p className="eyebrow">Workbook</p>
      <a className="list-link" href={`${base}/workbook`} data-testid="me-workbook">
        <span className="grow">Workbook<small>The first ten films, your answer, and a few from other parents</small></span>
        <span aria-hidden>›</span>
      </a>
      <p className="eyebrow">On this phone</p>
      <p data-testid="guest-opening">{opening} opening answer{opening === 1 ? '' : 's'} saved</p>
      {state?.progress.length ? state.progress.slice(0, 8).map((row) => (
        <a key={row.lessonId} className="guest-catalog" href={`${base}/course/${row.courseId}?part=${row.lessonId}`} data-testid="guest-progress">
          <span><b>{row.title}</b><small>{row.done ? 'Watched' : 'In progress'} · Film {row.place}</small></span>
          <span aria-hidden>›</span>
        </a>
      )) : <p className="card">Press play on a film and it will be listed here.</p>}
      {state?.answers.length ? (
        <>
          <p className="eyebrow">Workbook</p>
          {state.answers.map((row) => (
            <article key={`${row.lessonId}-${row.pointId || row.at}`} className="card" data-testid="guest-saved-answer">
              <b>{row.title}</b>
              <p>{row.body}</p>
            </article>
          ))}
        </>
      ) : null}
      <KeepOffer portal={portal} loginHref={loginHref} />
    </div>
  )
}
