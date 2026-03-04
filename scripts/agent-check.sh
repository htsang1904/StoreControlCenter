#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCOPE="${1:-auto}"

run_frontend=0
run_backend=0

detect_scope_from_changes() {
  local changed
  changed="$(cd "$ROOT_DIR" && git status --porcelain | awk '{print $2}')"

  while IFS= read -r file; do
    [ -z "$file" ] && continue

    case "$file" in
      api/*)
        run_backend=1
        ;;
      src/*|public/*|index.html|vite.config.js|package.json|package-lock.json)
        run_frontend=1
        ;;
    esac
  done <<< "$changed"
}

case "$SCOPE" in
  auto)
    detect_scope_from_changes
    ;;
  frontend|fe|web)
    run_frontend=1
    ;;
  backend|be|api)
    run_backend=1
    ;;
  all)
    run_frontend=1
    run_backend=1
    ;;
  *)
    echo "Invalid scope: $SCOPE"
    echo "Usage: ./scripts/agent-check.sh [auto|frontend|backend|all]"
    exit 2
    ;;
esac

if [ "$run_frontend" -eq 0 ] && [ "$run_backend" -eq 0 ]; then
  echo "No relevant changes detected. Nothing to validate."
  exit 0
fi

cd "$ROOT_DIR"

if [ "$run_frontend" -eq 1 ]; then
  echo "==> Frontend check: npm run build"
  npm run build
fi

if [ "$run_backend" -eq 1 ]; then
  echo "==> Backend check: npm --prefix api run build"
  npm --prefix api run build
fi

echo "All selected checks passed."
