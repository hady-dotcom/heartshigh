import { notFound } from 'next/navigation'
import { requireMaster } from '@/server/context'
import { MasterCourse, MasterLibrary } from '@/screens/desk/master'

export default async function Library({ params, searchParams }: { params: Promise<{ id?: string[] }>; searchParams: Promise<{ error?: string; notice?: string; part?: string }> }) {
  const [{ id = [] }, query] = await Promise.all([params, searchParams])
  const { payload, user } = await requireMaster()
  if (!id.length) return MasterLibrary({ payload, user, query })
  if (id.length > 1 || !Number(id[0])) notFound()
  return MasterCourse({ payload, user, query }, Number(id[0]))
}
