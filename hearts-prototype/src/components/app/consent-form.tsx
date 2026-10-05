'use client'

import { Hidden } from '@/components/app/shell'
import { AGE_LABEL, type AgeBand } from '@/lib/child-safety'
import { useState } from 'react'

const BANDS: AgeBand[] = ['under-13', '13-17', '18+']

export function ConsentForm({ after, next, preset }: { after: string; next: string; preset?: AgeBand | null }) {
  const [age, setAge] = useState<AgeBand | ''>(preset || '')
  const [agreed, setAgreed] = useState(false)
  const ready = Boolean(age && agreed)
  return (
    <form className="card form-stack consent-card" action="/api/hearts" method="post" data-testid="consent-form">
      <Hidden fields={{ action: 'accept-consent', after, next }} />
      <fieldset className="age-bands" data-testid="age-bands">
        <legend>How old are you?</legend>
        {BANDS.map((band) => (
          <label key={band} className="age-band">
            <input
              type="radio"
              name="ageBand"
              value={band}
              checked={age === band}
              onChange={() => setAge(band)}
              required={band === BANDS[0]}
              data-testid={`age-${band}`}
            />
            <span>{AGE_LABEL[band]}</span>
          </label>
        ))}
      </fieldset>
      <label className="consent-line">
        <input type="checkbox" name="agree" value="on" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} required data-testid="consent-agree" />
        <span>I’ve read these and I agree</span>
      </label>
      <button className="pill gold block" type="submit" disabled={!ready} data-testid="consent-submit">
        I agree, let’s begin
      </button>
    </form>
  )
}
