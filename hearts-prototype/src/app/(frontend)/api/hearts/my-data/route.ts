import { NextResponse } from 'next/server'
import { now } from '@/lib/clock'
import { hashToken } from '@/lib/account-crypto'
import { tokenFresh } from '@/lib/account-rules'
import { getSession } from '@/server/context'
import { readExportFile } from '@/server/my-data'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') || ''
  if (!token) return NextResponse.json({ error: 'This link needs a token.' }, { status: 400 })
  const { payload } = await getSession()
  const hashed = hashToken(token)
  const found = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 1, where: { dataExportToken: { equals: hashed } } })
  const person = found.docs[0] as { id: number; dataExportExpiresAt?: string; dataExportFile?: string } | undefined
  if (!person || !tokenFresh(person.dataExportExpiresAt, now()) || !person.dataExportFile) {
    return NextResponse.json({ error: 'That download link is not valid any more.' }, { status: 404 })
  }
  const bytes = readExportFile(person.dataExportFile)
  if (!bytes) return NextResponse.json({ error: 'That file is no longer here. Ask for a new download.' }, { status: 404 })
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="my-hearts.zip"',
    },
  })
}
