#!/usr/bin/env bash
# Deploy site-root/ to the shifuguru.github.io user-site repo (domain root).
# Requires: gh CLI authenticated as a user with push access to shifuguru.github.io
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_ROOT="$ROOT/site-root"
REPO="shifuguru/shifuguru.github.io"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI (gh) and run: gh auth login"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

for f in index.html ads.txt; do
  test -f "$SITE_ROOT/$f" || { echo "Missing $SITE_ROOT/$f"; exit 1; }
done

if grep -q "pagead2.googlesyndication.com" "$SITE_ROOT/index.html"; then
  echo "Refusing to deploy: index.html still references AdSense script."
  exit 1
fi

put_file() {
  local path="$1"
  local file="$2"
  local sha
  sha="$(gh api "repos/$REPO/contents/$path" --jq .sha 2>/dev/null || true)"
  local args=(
    -X PUT
    -f "message=Deploy site root from ps_and_as ($(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo local))"
    -f "content=$(base64 -w0 "$file" 2>/dev/null || base64 "$file")"
  )
  if [ -n "$sha" ]; then
    args+=(-f "sha=$sha")
  fi
  gh api "repos/$REPO/contents/$path" "${args[@]}"
}

echo "Deploying to https://github.com/$REPO …"
put_file "index.html" "$SITE_ROOT/index.html"
put_file "ads.txt" "$SITE_ROOT/ads.txt"
echo "Done. Check https://shifuguru.github.io/ (allow ~1 min for Pages)."
