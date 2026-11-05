#!/bin/sh
# Builds the production image and checks it against Postgres and an S3 stand-in on this computer.
# Does not create a hosting account and does not deploy anywhere.
set -eu
cd "$(dirname "$0")/.."

echo "== unit tests =="
npx tsx --test tests/unit/deploy.test.ts

echo "== image =="
sudo docker compose -f docker-compose.prod.yml up -d --build

echo "== wait for health =="
i=0
until curl -fsS http://127.0.0.1:3000/api/health; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "health did not come up"
    sudo docker compose -f docker-compose.prod.yml logs app
    exit 1
  fi
  sleep 5
done
echo

echo "== bootstrap =="
sudo docker compose -f docker-compose.prod.yml exec -T app node --import tsx scripts/bootstrap.ts
sudo docker compose -f docker-compose.prod.yml exec -T app node --import tsx scripts/bootstrap.ts

echo "== starter talks =="
sudo docker compose -f docker-compose.prod.yml exec -T app node --import tsx src/seed/seed.ts --starters

echo "== smoke =="
S3_ENDPOINT=http://127.0.0.1:9000 \
S3_BUCKET=hearts-media \
S3_ACCESS_KEY_ID=hearts \
S3_SECRET_ACCESS_KEY=hearts-secret-key \
S3_REGION=us-east-1 \
BOOTSTRAP_ADMIN_EMAIL=owner@example.com \
BOOTSTRAP_ADMIN_PASSWORD=local-proof-passphrase \
node tests/smoke/production.mjs http://127.0.0.1:3000

echo "== prove done =="
