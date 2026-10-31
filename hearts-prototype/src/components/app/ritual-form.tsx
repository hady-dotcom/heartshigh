'use client'

import { useState } from 'react'
import { Hidden } from '@/components/app/shell'

export function RitualForm({ next }: { next: string }) {
  const [writing, setWriting] = useState(false)
  const [note, setNote] = useState('')
  if (!writing) {
    return (
      <button type="button" className="pill teal" data-testid="ritual-open" onClick={() => setWriting(true)}>
        Keep this
      </button>
    )
  }
  return (
    <form className="form-stack" action="/api/hearts" method="post">
      <Hidden fields={{ action: 'ritual', next }} />
      <label>
        What did you do?
        <textarea
          className="field"
          data-testid="ritual-note"
          name="note"
          rows={3}
          maxLength={280}
          required
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="I held back a harsh word."
        />
      </label>
      <button className="pill teal" type="submit" data-testid="ritual-submit" disabled={!note.trim()}>
        Keep this
      </button>
    </form>
  )
}
