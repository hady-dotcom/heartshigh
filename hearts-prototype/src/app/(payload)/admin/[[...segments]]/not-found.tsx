import config from '@payload-config'
import { NotFoundPage } from '@payloadcms/next/views'
import { importMap } from '../importMap.js'

const NotFound = ({ params, searchParams }: { params: Promise<{ segments: string[] }>; searchParams: Promise<Record<string, string | string[]>> }) =>
  NotFoundPage({ config, importMap, params, searchParams })

export default NotFound
