#!/usr/bin/env bash
#
# Deploys FightersArena to fightersarena.ideageek.pk.
#
# Run this ON the server (the deploy-fightersarena skill invokes it over SSH):
#   ~/ops/deploy-fightersarena.sh [--seed-content] [--cleanup-demo]
#
# What it does, in order:
#   1. Records the current commit so a failure can be rolled back by hand.
#   2. Pulls main, installs dependencies, builds.
#   3. Copies the standalone bundle's static assets into place (Next's
#      standalone output does not include .next/static or public/).
#   4. Runs migrations, then the reference seed.
#   5. Optionally cleans demo rows and seeds the go-live content.
#   6. Restarts pm2 and health-checks the public URL.
#
# Every step stops the script on failure (set -e), and the skill reports it.
set -euo pipefail

APP_DIR="/var/www/fightersarena"
APP_NAME="fightersarena-web"
APP_URL="https://fightersarena.ideageek.pk"
BRANCH="${DEPLOY_BRANCH:-main}"

SEED_CONTENT=0
CLEANUP_DEMO=0
for arg in "$@"; do
  case "$arg" in
    --seed-content) SEED_CONTENT=1 ;;
    --cleanup-demo) CLEANUP_DEMO=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

step() { echo; echo "=== $* ==="; }

cd "$APP_DIR"

step "Current state"
PREVIOUS_COMMIT="$(git rev-parse --short HEAD)"
echo "commit before deploy: $PREVIOUS_COMMIT"
echo "roll back with: cd $APP_DIR && git checkout $PREVIOUS_COMMIT && npm ci && npm run build && pm2 restart $APP_NAME"

step "Fetching $BRANCH"
git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
NEW_COMMIT="$(git rev-parse --short HEAD)"
echo "commit after fetch: $NEW_COMMIT"

step "Installing dependencies"
npm ci --no-audit --no-fund

step "Building"
# The app reads .env.production at build and run time.
NODE_ENV=production npm run build

step "Publishing standalone assets"
# Next's standalone server does not bundle these, so they are copied beside it.
# The destinations are cleared first: `cp -r src dest` copies *into* dest once dest
# exists, so repeating the deploy would otherwise nest public/public and serve a 404
# for everything added after the first deploy.
rm -rf .next/standalone/.next/static .next/standalone/public
mkdir -p .next/standalone/.next .next/standalone/public
cp -r .next/static .next/standalone/.next/static
if [ -d public ]; then cp -r public/. .next/standalone/public/; fi
cp .env.production .next/standalone/.env.production

# `dotenv/config` reads .env, not .env.production, so the CLI scripts would
# otherwise fall back to their development defaults. Export the real values
# for the database steps below.
step "Loading production environment"
set -a
# shellcheck disable=SC1091
. "$APP_DIR/.env.production"
set +a
echo "database role: $(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+).*|\1|')"

step "Running migrations"
npm run db:migrate

step "Seeding reference data"
# Insert-only: re-running never resets the superadmin password.
npm run db:seed

if [ "$CLEANUP_DEMO" = "1" ]; then
  step "Removing demo rows"
  npm run db:cleanup-demo -- --apply
fi

if [ "$SEED_CONTENT" = "1" ]; then
  step "Seeding go-live content"
  # Guarded by an audit marker, so a second run is a no-op.
  npm run db:seed:content
fi

step "Restarting $APP_NAME"
pm2 restart "$APP_NAME" --update-env
pm2 save

step "Health check"
sleep 4
for attempt in 1 2 3 4 5; do
  CODE="$(curl -ksS -o /dev/null -w '%{http_code}' "$APP_URL" || echo 000)"
  echo "attempt $attempt: HTTP $CODE"
  [ "$CODE" = "200" ] && break
  [ "$attempt" = "5" ] && { echo "health check failed" >&2; exit 1; }
  sleep 5
done

echo
echo "DEPLOY_OK $PREVIOUS_COMMIT -> $NEW_COMMIT"
