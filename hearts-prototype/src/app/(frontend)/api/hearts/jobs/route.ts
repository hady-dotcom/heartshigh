import { NextResponse } from 'next/server'
import { getSession } from '@/server/context'
import { runAccountJobs } from '@/server/account-jobs'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { payload, user } = await getSession()
  const key = req.headers.get('x-hearts-jobs-key') || ''
  if (user?.role !== 'master' && key !== (process.env.HEARTS_JOBS_KEY || '')) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
  }
  return NextResponse.json(await runAccountJobs(payload))
}
