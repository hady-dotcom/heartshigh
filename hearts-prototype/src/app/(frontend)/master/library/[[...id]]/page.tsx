import { notFound } from 'next/navigation'
import { requireMaster } from '@/server/context'
import { MasterCourse, MasterLibrary, MasterTalk } from '@/screens/desk/master'

export default async function Library({ params, searchParams }: { params: Promise<{ id?: string[] }>; searchParams: Promise<{ error?: string; notice?: string; part?: string; page?: string; films?: string; show?: string; q?: string; teacher?: string; door?: string; status?: string; length?: string; source?: string; added?: string; tp?: string }> }) {
  const [{ id = [] }, query] = await Promise.all([params, searchParams])
  const { payload, user } = await requireMaster()
  if (!id.length) return MasterLibrary({ payload, user, query })
  if (id[0] === 'talk') {
    const talkId = Number(id[1])
    if (id.length !== 2 || !talkId) notFound()
    return MasterTalk({ payload, user, query }, talkId)
  }
  if (id.length > 1 || !Number(id[0])) notFound()
  return MasterCourse({ payload, user, query }, Number(id[0]))
}
