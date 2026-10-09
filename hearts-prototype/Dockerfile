# One long-running server. Postgres and the bucket are outside this image.
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Captions. yt-dlp 2026.08.19 is fetched here (override with YT_DLP_VERSION, or YT_DLP_CHANNEL=nightly).
# The script checks SHA2-256SUMS and refuses a build older than its version floor. bin/ is not copied into the image.
# Subtitles use --skip-download, so ffmpeg is not installed.
RUN node scripts/get-yt-dlp.mjs

ENV NEXT_TELEMETRY_DISABLED=1
# No secret is passed into the image. While `next build` runs, the config sees the build phase and uses its own
# build-only placeholder and a throwaway SQLite path; boot refuses to start without a real PAYLOAD_SECRET and
# DATABASE_URL from the host's runtime variables. The throwaway database folder is removed so it never ships.
RUN HEARTS_BUILD=1 NODE_OPTIONS=--max-old-space-size=3072 npm run build \
  && rm -rf data \
  && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["node", "--import", "tsx", "scripts/start-production.ts"]
