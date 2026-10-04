'use client'

import { useMemo, useState } from 'react'
import { liveWhenLabel } from '@/lib/live'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function defaultWhen() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(19, 0, 0, 0)
  return date
}

function toHidden(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromParts(day: number, month: number, year: number, hour12: number, minute: number, period: 'am' | 'pm') {
  let hour = hour12 % 12
  if (period === 'pm') hour += 12
  return new Date(year, month, day, hour, minute, 0, 0)
}

/** British date and time, never the browser’s mm/dd/yyyy control. */
export function LiveWhenPicker({ name = 'when', testId = 'desk-live-when' }: { name?: string; testId?: string }) {
  const start = defaultWhen()
  const [day, setDay] = useState(start.getDate())
  const [month, setMonth] = useState(start.getMonth())
  const [year, setYear] = useState(start.getFullYear())
  const hour24 = start.getHours()
  const [hour, setHour] = useState(hour24 % 12 || 12)
  const [minute, setMinute] = useState(0)
  const [period, setPeriod] = useState<'am' | 'pm'>(hour24 >= 12 ? 'pm' : 'am')
  const years = [start.getFullYear(), start.getFullYear() + 1]
  const value = useMemo(() => fromParts(day, month, year, hour, minute, period), [day, month, year, hour, minute, period])
  return (
    <div className="live-when" data-testid={testId}>
      <input type="hidden" name={name} value={toHidden(value)} />
      <div className="live-when-row">
        <label className="stack">Day
          <select aria-label="Day" value={day} onChange={(event) => setDay(Number(event.target.value))}>
            {Array.from({ length: 31 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="stack">Month
          <select aria-label="Month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {MONTHS.map((label, index) => <option key={label} value={index}>{label}</option>)}
          </select>
        </label>
        <label className="stack">Year
          <select aria-label="Year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="live-when-row">
        <label className="stack">Hour
          <select aria-label="Hour" value={hour} onChange={(event) => setHour(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="stack">Minute
          <select aria-label="Minute" value={minute} onChange={(event) => setMinute(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => index * 5).map((item) => <option key={item} value={item}>{pad(item)}</option>)}
          </select>
        </label>
        <label className="stack">am or pm
          <select aria-label="am or pm" value={period} onChange={(event) => setPeriod(event.target.value as 'am' | 'pm')}>
            <option value="am">am</option>
            <option value="pm">pm</option>
          </select>
        </label>
      </div>
      <p className="hint" data-testid="desk-live-when-preview">{liveWhenLabel(value)}</p>
    </div>
  )
}
