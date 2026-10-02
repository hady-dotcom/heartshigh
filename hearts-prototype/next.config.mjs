import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },
}

export default withPayload(nextConfig)
