import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/server/context'
import { seeHowClipMap } from '@/server/see-how-clips'

export const dynamic = 'force-dynamic'

/** Public map of page id → replacement video. Empty when every page still uses the recording. */
export async function GET() {
  const payload = await getPayloadClient()
  const clips = await seeHowClipMap(payload)
  return NextResponse.json({ clips })
}
