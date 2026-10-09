export type CostKeys = { anthropic: boolean; openai: boolean }

/** Rough token estimate for one call. Labelled as an estimate in the desk, never a bill. */
export function estimatePaidCost(input: { chars: number; calls: number; keys: CostKeys }) {
  const inputTokens = Math.ceil(Math.min(Math.max(0, input.chars), 24_000) / 4) + 900
  const outputTokens = 800
  const calls = Math.max(1, input.calls)
  const anthropic = ((inputTokens * 3 + outputTokens * 15) / 1_000_000) * calls
  const openai = ((inputTokens * 0.15 + outputTokens * 0.6) / 1_000_000) * calls
  if (input.keys.anthropic) return { usd: Math.max(anthropic, input.keys.openai ? openai : 0), provider: 'anthropic' as const }
  if (input.keys.openai) return { usd: openai, provider: 'openai' as const }
  return null
}

export function formatPaidCost(usd: number) {
  if (usd < 0.01) return 'under 1 cent'
  return `about $${usd < 0.1 ? usd.toFixed(3) : usd.toFixed(2)}`
}

export function paidCostLabel(input: { chars: number; calls: number; keys: CostKeys; kind: string }) {
  const estimate = estimatePaidCost(input)
  const calls = Math.max(1, input.calls)
  if (!estimate) return 'No model key is set, so this run stays on the built-in path and costs nothing.'
  const noun = `${calls} ${input.kind} call${calls === 1 ? '' : 's'}`
  return `Estimate if you tick paid AI: ${formatPaidCost(estimate.usd)} for ${noun}. This is a rough estimate, not a bill.`
}
