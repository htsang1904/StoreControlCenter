#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SOURCE_DIR="src"
RESPONSIVE_JS_SOURCE="src/composables/useResponsive.js"

check_pattern() {
  local description="$1"
  shift
  local result

  result="$("$@" || true)"

  if [ -n "$result" ]; then
    echo "Responsive breakpoint guard failed: $description"
    printf '%s\n' "$result"
    exit 1
  fi
}

check_pattern \
  "found legacy Tailwind breakpoint prefixes. Use only tablet:/pc:." \
  rg -nP '(?<!-)\b(xs|sm|md|lg|xl|2xl|3xl):' "$SOURCE_DIR"

check_pattern \
  "found arbitrary responsive prefixes. Keep viewport states limited to mobile/tablet/pc." \
  rg -n '(min|max)-\[[^\]]+\]:' "$SOURCE_DIR"

check_pattern \
  "found viewport media queries outside 48rem/64rem." \
  rg -nP '@media[^\n]*(min-width|max-width|width)(?:(?!48rem|64rem|768px|1024px).)*$' "$SOURCE_DIR"

check_pattern \
  "found viewport logic outside useResponsive.js." \
  rg -n 'matchMedia|innerWidth|outerWidth|screen\.width|clientWidth' "$SOURCE_DIR" -g "!$RESPONSIVE_JS_SOURCE"

echo "Responsive breakpoint guard passed."
