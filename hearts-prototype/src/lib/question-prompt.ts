/**
 * Engagement-point prompts are sometimes a raw ASR line plus a real question.
 * Keep the question; drop a garbled transcript blob.
 */
export function tidyQuestionPrompt(text: string) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  // A short prompt that already starts as a question is the question. A transcript blob in front still falls through.
  if (t.length <= 400 && /^(?:what|why|how|when|where|who|which|is|are|do|does|can|could|would|if)\b/i.test(t) && looksLikeQuestion(t)) return t
  const named = t.match(/((?:What|Why|How|When|Where|Who|Which)\b[^?]*\?)\s*$/i)
  if (named && named[1].length >= 12 && named[1].length <= 220) return named[1].trim()
  const lastQ = t.lastIndexOf('?')
  if (lastQ >= 0) {
    const tail = t.slice(Math.max(0, lastQ - 160), lastQ + 1).replace(/^[^A-Za-z]+/, '')
    const ask = tail.match(/((?:What|Why|How|When|Where|Who|Which|Is|Are|Do|Does|Can|Could|Would|If)\b.*\?)$/i)
    if (ask && ask[1].length <= 220) return ask[1].trim()
  }
  if (looksLikeQuestion(t) && t.length <= 220) return t
  return ''
}

function looksLikeQuestion(text: string) {
  if (/[?]/.test(text)) return true
  return /^(what|why|how|when|where|who|which|is |are |do |does |can |could |would |if |name |describe |notice )/i.test(text)
}

export function usableQuestionPrompt(text: string) {
  return Boolean(tidyQuestionPrompt(text))
}

/**
 * A sheet-imported question is the author's words, including the lead-in.
 * HEARTS still keeps only the question inside a transcript line, and names a blank one Question N.
 */
export function shownQuestionPrompt(text: string, opts: { sheet: boolean; index?: number }) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (opts.sheet) return raw
  return tidyQuestionPrompt(raw) || `Question ${(opts.index ?? 0) + 1}`
}
