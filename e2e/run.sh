#!/usr/bin/env bash
# Reseed, rebuild, serve, then run every check in order.
#
# Reseeding first matters: the claim test transfers a listing and switches the
# signed-in user's active location, so a later run would otherwise open a
# business with no reviews and fail for the wrong reason.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "--- seed"
npx tsx src/db/seed.ts >/dev/null

echo "--- build and serve"
./e2e/serve.sh "${PORT:-3100}"

echo "--- unit"
npx vitest run 2>&1 | grep -E "Test Files|Tests "

# `claim` runs last on purpose: completing a claim switches the signed-in
# user's active location to the newly claimed business, which has no reviews
# and no conversations. Any test after it would fail for the wrong reason.
for f in flows permissions android claim; do
  echo "--- $f"
  node "e2e/$f.mjs"
done

echo "--- all checks passed"
