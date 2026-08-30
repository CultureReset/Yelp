#!/usr/bin/env bash
# Build, then guarantee the server restarts on THAT build.
#
# An earlier version of this script probed the port with `ss`, which is not
# installed here. It silently found nothing, killed nothing, and every
# "restart" left the original server bound — which surfaced as a long run of
# phantom stale-chunk and 404 failures. So: use tools that exist, and verify
# the build actually being served rather than trusting the restart.
set -euo pipefail
PORT="${1:-3100}"
LOG="/tmp/next-$PORT.log"

port_pids() {
  # `|| true` on the grep: with `set -e -o pipefail`, a grep that matches
  # nothing returns 1 and would abort the script during the normal
  # "port is already free" case.
  { lsof -t -i:"$PORT" 2>/dev/null || true; fuser "$PORT"/tcp 2>/dev/null || true; } \
    | tr ' ' '\n' | { grep -E '^[0-9]+$' || true; } | sort -u
}

stop() {
  for _ in $(seq 1 10); do
    pids=$(port_pids)
    [ -z "$pids" ] && return 0
    echo "$pids" | xargs -r kill -9 2>/dev/null || true
    sleep 1
  done
  echo "FAIL: port $PORT still held by: $(port_pids)" >&2
  exit 1
}

stop
npm run build >/dev/null
BUILD_ID=$(cat .next/BUILD_ID)

setsid npx next start -p "$PORT" > "$LOG" 2>&1 < /dev/null &

for _ in $(seq 1 30); do
  sleep 1
  curl -fsS -o /dev/null "http://localhost:$PORT/login" 2>/dev/null || continue

  # The real check: ask the server for an asset only this build has.
  asset=$(find .next/static/chunks -name 'webpack-*.js' -printf '%f\n' | head -1)
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/_next/static/chunks/$asset")
  if [ "$code" = "200" ]; then
    echo "serving build $BUILD_ID on :$PORT"
    exit 0
  fi
  echo "FAIL: port $PORT answers, but not from build $BUILD_ID (asset $asset -> $code)" >&2
  tail -15 "$LOG" >&2
  exit 1
done

echo "FAIL: server never came up" >&2; tail -20 "$LOG" >&2; exit 1
