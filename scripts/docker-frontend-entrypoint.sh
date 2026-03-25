#!/bin/sh
set -eu

APP_DIR="/app"
LOCKFILE="$APP_DIR/package-lock.json"
NODE_MODULES_DIR="$APP_DIR/node_modules"
STAMP_FILE="$NODE_MODULES_DIR/.package-lock.sha256"

needs_install="false"
reason=""

if [ ! -d "$NODE_MODULES_DIR" ] || [ -z "$(ls -A "$NODE_MODULES_DIR" 2>/dev/null || true)" ]; then
  needs_install="true"
  reason="node_modules is missing or empty"
fi

if [ -f "$LOCKFILE" ]; then
  current_hash="$(sha256sum "$LOCKFILE" | awk '{print $1}')"
  previous_hash="$(cat "$STAMP_FILE" 2>/dev/null || true)"
  if [ "$current_hash" != "$previous_hash" ]; then
    needs_install="true"
    reason="package-lock.json changed"
  fi
fi

if [ "$needs_install" = "true" ]; then
  echo "[frontend-entrypoint] Installing dependencies: $reason"
  if [ -f "$LOCKFILE" ]; then
    npm ci
    mkdir -p "$NODE_MODULES_DIR"
    sha256sum "$LOCKFILE" | awk '{print $1}' > "$STAMP_FILE"
  else
    npm install
  fi
else
  echo "[frontend-entrypoint] Dependencies unchanged. Skipping install."
fi

exec "$@"
