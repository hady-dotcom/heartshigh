/**
 * Screen a learner answer before it appears in the swarm.
 * Mock-safe: when no model key is set, a plain word list decides.
 * Hidden answers go to the master review queue. Teacher-facing feedback is untouched.
 */

const HARM = [
  'kill yourself',
  'kys',
  'suicide',
  'bomb',
  'shoot',
  'rape',
  'nazi',
  'slur',
  'hate you',
  'die already',
  'i will hurt',
  'i will kill',
]

export type SwarmScreen = { show: boolean; reason: string }

export function screenAnswer(text: string): SwarmScreen {
  const body = String(text || '').trim()
  if (!body) return { show: false, reason: 'Empty.' }
  const folded = body.toLowerCase()
  const hit = HARM.find((word) => folded.includes(word))
  if (hit) return { show: false, reason: `Hidden for review: harmful language (${hit}).` }
  if (/(https?:\/\/|www\.)\S+/i.test(body) && /password|login|verify|account/i.test(folded)) {
    return { show: false, reason: 'Hidden for review: looks like a phishing link.' }
  }
  return { show: true, reason: 'Clear.' }
}

export function hasModelKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
}

/** Same decision as screenAnswer. A live model can be wired later; mock mode is the default. */
export async function screenAnswerSafe(text: string): Promise<SwarmScreen> {
  return screenAnswer(text)
}
