import { NextResponse } from 'next/server'
import { mailCatcherOn, readCaughtMail } from '@/lib/mail-catcher'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!mailCatcherOn()) return NextResponse.json({ error: 'The mail catcher is off.' }, { status: 404 })
  return NextResponse.json({ emails: readCaughtMail() })
}
