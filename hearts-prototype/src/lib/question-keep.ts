export type KeptQuestion = { id: number; prompt: string }

/** Same question text, ignoring only extra spaces. A blank prompt never matches. */
export function questionKey(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * Re-importing a film replaces its questions.
 * Answers stay on a question whose text did not change. A new or rewritten question starts empty.
 */
export function matchQuestions<T extends KeptQuestion>(existing: T[], nextPrompts: string[]) {
  const used = new Set<number>()
  const kept: { id: number; prompt: string }[] = []
  const fresh: string[] = []
  for (const prompt of nextPrompts) {
    const key = questionKey(prompt)
    const match = key ? existing.find((row) => !used.has(row.id) && questionKey(row.prompt) === key) : undefined
    if (match) {
      used.add(match.id)
      kept.push({ id: match.id, prompt })
    } else fresh.push(prompt)
  }
  const dropped = existing.filter((row) => !used.has(row.id)).map((row) => row.id)
  return { kept, fresh, dropped }
}
