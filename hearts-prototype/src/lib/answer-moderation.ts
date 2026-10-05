/**
 * Screen a learner answer before it appears in the swarm.
 * Mock-safe: when no model key is set, a plain word list decides.
 * Hidden answers stay on the Care and safety desk. Teacher-facing feedback is untouched.
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

const SELF_HARM = ['kill myself', 'killing myself', 'end my life', 'want to die', 'hurt myself', 'cutting myself']
const ABUSE = ['he hits me', 'she hits me', 'they hit me', 'being abused', 'my dad hits', 'my mum hits', 'someone touched me']

export type SwarmScreen = { show: boolean; reason: string; atRisk: boolean }

export function screenAnswer(text: string): SwarmScreen {
  const body = String(text || '').trim()
  if (!body) return { show: false, reason: 'Empty.', atRisk: false }
  const folded = body.toLowerCase()
  const self = SELF_HARM.find((word) => folded.includes(word))
  if (self) return { show: false, reason: 'Needs a person.', atRisk: true }
  const abuse = ABUSE.find((word) => folded.includes(word))
  if (abuse) return { show: false, reason: 'Needs a person.', atRisk: true }
  const hit = HARM.find((word) => folded.includes(word))
  if (hit) return { show: false, reason: 'Hidden for review.', atRisk: false }
  if (/(https?:\/\/|www\.)\S+/i.test(body) && /password|login|verify|account/i.test(folded)) {
    return { show: false, reason: 'Hidden for review: looks like a phishing link.', atRisk: false }
  }
  return { show: true, reason: 'Clear.', atRisk: false }
}

export function hasModelKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
}

/** Same decision as screenAnswer. A live model can be wired later; mock mode is the default. */
export async function screenAnswerSafe(text: string): Promise<SwarmScreen> {
  return screenAnswer(text)
}
