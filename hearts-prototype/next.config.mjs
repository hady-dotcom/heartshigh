import { withPayload } from '@payloadcms/next/withPayload'
import { securityHeaders } from './security-headers.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  // The e2e suite runs its own server beside a dev server, so it builds into its own folder.
  distDir: process.env.HEARTS_DIST_DIR || '.next',
  // Nothing uses next/image. Leaving the optimiser off keeps /_next/image, the route behind Next 15.4's open
  // image advisories, out of reach until Payload supports a patched Next.
  images: { unoptimized: true },
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },
}

const payloadConfig = withPayload(nextConfig)
const payloadHeaders = payloadConfig.headers
payloadConfig.headers = async () => {
  const rows = (await payloadHeaders()) || []
  // Payload marks the colour-scheme hint as critical, so a fresh browser downloads
  // the document twice. The evening and white shells do not vary on that hint.
  return rows.map((row) => ({
    ...row,
    headers: (row.headers || []).filter((header) => header.key !== 'Critical-CH' && header.key !== 'Accept-CH'),
  }))
}

export default payloadConfig
