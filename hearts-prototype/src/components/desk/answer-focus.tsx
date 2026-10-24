'use client'

import { useEffect } from 'react'

/** Scroll the opened answer into view when a teacher follows a new-answer link. */
export function AnswerFocus({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: 'center' })
  }, [id])
  return null
}
