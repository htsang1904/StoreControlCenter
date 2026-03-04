#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/.agent"
OUT_FILE="$OUT_DIR/PROJECT_RECAP.md"
MODE="${1:-write}"

cd "$ROOT_DIR"

generated_at="$(date '+%Y-%m-%d %H:%M:%S %z')"
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
head_commit="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
status_lines="$(git status --short 2>/dev/null || true)"

if [ -n "$status_lines" ]; then
  tree_state="dirty"
else
  tree_state="clean"
fi

changed_files="$(printf '%s\n' "$status_lines" | awk '{print $2}' | sed '/^$/d' || true)"

if [ -n "$changed_files" ]; then
  total_changed="$(printf '%s\n' "$changed_files" | wc -l | tr -d ' ')"
  frontend_changed="$(printf '%s\n' "$changed_files" | awk '/^(src\/|public\/|index.html|vite.config.js|package.json|package-lock.json)/{print}' | wc -l | tr -d ' ')"
  backend_changed="$(printf '%s\n' "$changed_files" | awk '/^api\//{print}' | wc -l | tr -d ' ')"
  other_changed="$((total_changed - frontend_changed - backend_changed))"
else
  total_changed="0"
  frontend_changed="0"
  backend_changed="0"
  other_changed="0"
fi

recent_commits="$(git log --oneline -n 5 2>/dev/null || true)"

mkdir -p "$OUT_DIR"

{
  echo "# Project Recap"
  echo
  echo "- Generated at: $generated_at"
  echo "- Branch: \`$branch\`"
  echo "- HEAD: \`$head_commit\`"
  echo "- Working tree: \`$tree_state\`"
  echo
  echo "## Change Scope"
  echo
  echo "- Total changed files: \`$total_changed\`"
  echo "- Frontend-related: \`$frontend_changed\`"
  echo "- Backend-related: \`$backend_changed\`"
  echo "- Other: \`$other_changed\`"
  echo
  echo "## Changed Files"
  echo
  if [ -n "$status_lines" ]; then
    printf '%s\n' "$status_lines" | head -n 120 | while IFS= read -r line; do
      echo "- \`$line\`"
    done
  else
    echo "- _No local changes_"
  fi
  echo
  echo "## Recent Commits"
  echo
  if [ -n "$recent_commits" ]; then
    printf '%s\n' "$recent_commits" | while IFS= read -r line; do
      echo "- \`$line\`"
    done
  else
    echo "- _No commit history available_"
  fi
  echo
  echo "## Quick Commands"
  echo
  echo "- Validate changed scope: \`./scripts/agent-check.sh auto\`"
  echo "- Frontend build: \`npm run build\`"
  echo "- Backend build: \`npm --prefix api run build\`"
} > "$OUT_FILE"

if [ "$MODE" = "--stdout" ]; then
  cat "$OUT_FILE"
  exit 0
fi

echo "Recap updated: $OUT_FILE"
