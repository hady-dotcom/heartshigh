# One long-running server. Postgres and the bucket are outside this image.
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# These let `next build` load the config. They are cleared before the image is run, and boot rejects them if they leak through.
ARG PAYLOAD_SECRET=build-time-placeholder-not-for-runtime-use-32
ARG DATABASE_URL=file:./data/hearts.db
ENV PAYLOAD_SECRET=$PAYLOAD_SECRET
ENV DATABASE_URL=$DATABASE_URL

RUN HEARTS_BUILD=1 NODE_OPTIONS=--max-old-space-size=3072 npm run build \
  && npm prune --omit=dev

ENV PAYLOAD_SECRET=""
ENV DATABASE_URL=""
ENV HEARTS_BUILD=""
ENV NODE_ENV=production
ENV PORT=3000

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["node", "--import", "tsx", "scripts/start-production.ts"]
