'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cookiesSecure } from '@/lib/env'
import { type DemoBeatId } from '@/lib/demo-stage'
import { requireMaster } from '@/server/context'
import { demoSessionCookies, resetDemoStage, runDemoBeat } from '@/server/demo-stage'

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 2, secure: cookiesSecure() }
}

async function grantSessions() {
  const { payload } = await requireMaster()
  const sessions = await demoSessionCookies(payload)
  const jar = await cookies()
  for (const session of sessions) jar.set(session.name, session.value, cookieOptions())
}

export async function openDemoStage() {
  await grantSessions()
  redirect('/demo-stage')
}

export async function resetDemo() {
  const { payload } = await requireMaster()
  await resetDemoStage(payload)
  await grantSessions()
  redirect('/demo-stage')
}

export async function runBeat(beat: DemoBeatId) {
  const { payload } = await requireMaster()
  return runDemoBeat(payload, beat)
}
