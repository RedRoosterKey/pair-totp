#!/usr/bin/env bash
# Wait for GitHub Pages to finish building the commit you pushed, then open the site.
# Push first (git push). Uncommitted changes only warn; unpushed commits fail.
#     tools/deploy.sh
set -euo pipefail
shellcheck "$0" || exit 1
cd "$(dirname "$0")/.."

URL=https://redroosterkey.github.io/pair-totp/

[ -z "$(git status --porcelain)" ] || echo "Warning: uncommitted changes, which are not part of this deploy." >&2
python3 tools/update-sri.py --check || echo "Warning: integrity hashes are out of date." >&2

git fetch --quiet origin main
unpushed=$(git rev-list --count origin/main..HEAD)
[ "$unpushed" -eq 0 ] || { echo "$unpushed unpushed commit(s). Run git push first." >&2; exit 1; }

sha=$(git rev-parse HEAD)
echo "Waiting for the Pages build of ${sha:0:7}..."
id=
for _ in $(seq 30); do
  id=$(gh run list --workflow pages-build-deployment --commit "$sha" --json databaseId -q '.[0].databaseId')
  [ -n "$id" ] && break
  sleep 3
done
[ -n "$id" ] || { echo "No Pages run showed up for ${sha:0:7}." >&2; exit 1; }

gh run watch "$id" --exit-status
open "$URL"
