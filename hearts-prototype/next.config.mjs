import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
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

export default withPayload(nextConfig)
