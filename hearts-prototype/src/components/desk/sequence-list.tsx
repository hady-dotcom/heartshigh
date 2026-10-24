'use client'

import { useState } from 'react'
import { Hidden } from '@/components/app/shell'
import { SEQUENCE_COPY, moveItem } from '@/lib/sequence'

export type SequenceRow = { id: number; title: string }

export function SequenceList({ rows, portalSlug, next }: { rows: SequenceRow[]; portalSlug: string; next: string }) {
  const [items, setItems] = useState(rows)
  const [drag, setDrag] = useState<number | null>(null)
  return (
    <form action="/api/hearts" method="post" className="form-stack" data-testid="sequence-order-form">
      <Hidden fields={{ action: 'sequence-order', portalSlug, next }} />
      <input type="hidden" name="order" value={items.map((item) => item.id).join(',')} />
      <ol className="sequence-edit" data-testid="sequence-edit">
        {items.map((item, index) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDrag(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (drag == null) return
              setItems((current) => moveItem(current, drag, index))
              setDrag(null)
            }}
          >
            <span className="sequence-num">{index + 1}</span>
            <input
              name={`title:${item.id}`}
              value={item.title}
              aria-label={`Title ${index + 1}`}
              data-testid="film-title"
              onChange={(event) => {
                const value = event.target.value
                setItems((current) => current.map((row) => (row.id === item.id ? { ...row, title: value } : row)))
              }}
            />
            <button type="button" data-testid="move-up" disabled={index === 0} onClick={() => setItems((current) => moveItem(current, index, index - 1))}>{SEQUENCE_COPY.moveUp}</button>
            <button type="button" data-testid="move-down" disabled={index === items.length - 1} onClick={() => setItems((current) => moveItem(current, index, index + 1))}>{SEQUENCE_COPY.moveDown}</button>
          </li>
        ))}
      </ol>
      <button className="pill ink" type="submit" data-testid="sequence-save-order">Save order</button>
    </form>
  )
}
