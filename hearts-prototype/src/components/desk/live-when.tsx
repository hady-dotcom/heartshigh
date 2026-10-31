'use client'

import { useMemo, useState } from 'react'
import { liveWhenHidden, liveWhenPreview, londonTomorrowEvening, type LiveWhenParts } from '@/lib/live'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** British date and time, never the browser’s mm/dd/yyyy control. The first paint uses London, not the machine clock. */
export function LiveWhenPicker({ name = 'when', testId = 'desk-live-when' }: { name?: string; testId?: string }) {
  const start = londonTomorrowEvening()
  const [day, setDay] = useState(start.day)
  const [month, setMonth] = useState(start.month)
  const [year, setYear] = useState(start.year)
  const [hour, setHour] = useState(start.hour)
  const [minute, setMinute] = useState(start.minute)
  const [period, setPeriod] = useState<'am' | 'pm'>(start.period)
  const years = [start.year, start.year + 1]
  const parts = useMemo<LiveWhenParts>(() => ({ day, month, year, hour, minute, period }), [day, month, year, hour, minute, period])
  return (
    <div className="live-when" data-testid={testId}>
      <input type="hidden" name={name} value={liveWhenHidden(parts)} />
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
      <p className="hint" data-testid="desk-live-when-preview">{liveWhenPreview(parts)}</p>
    </div>
  )
}
