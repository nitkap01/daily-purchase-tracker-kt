#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# deploy.sh  —  Build & push a versioned Docker image for sheets-dashboard
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="nitinkapoor/sheets-dashboard-app"
VERSION_FILE="frontend/src/version.ts"

# ── 1. Prompt for version ─────────────────────────────────────────────────────
read -rp "Enter version tag (e.g. v1.2 or 1.2.0): " VERSION
if [[ -z "$VERSION" ]]; then
  echo "❌  Version cannot be empty."
  exit 1
fi

# Strip leading 'v' for the JS constant (keep full tag for docker)
SEMVER="${VERSION#v}"

# ── 2. Update the frontend version constant ───────────────────────────────────
echo "export const APP_VERSION = '${SEMVER}'" > "$VERSION_FILE"
echo "✅  Updated ${VERSION_FILE} → ${SEMVER}"

# ── 3. Build & push multi-platform image ─────────────────────────────────────
echo ""
echo "🚀  Building ${REPO}:${VERSION} (linux/amd64) …"
docker buildx build \
  --platform linux/amd64 \
  -t "${REPO}:${VERSION}" \
  --push .

echo ""
echo "✅  Pushed ${REPO}:${VERSION}"
echo ""

# ── 4. Commit the version bump ────────────────────────────────────────────────
read -rp "Commit version bump to git? [y/N] " COMMIT
if [[ "${COMMIT,,}" == "y" ]]; then
  git add "$VERSION_FILE"
  git commit -m "chore(release): bump version to ${VERSION}"
  git push
  echo "✅  Committed and pushed version bump"
fi
