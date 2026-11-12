#!/usr/bin/env bash
# Mirror the CNB primary repository to the GitHub-side distribution endpoint.
#
# The GitHub repository exists only to keep existing `uses: owner/repo@ref`
# references working. It is a mirror, never a source of truth; all development
# happens on cnb.cool/h1s97x/plugins/profile-3d-contrib.
#
# The GitHub repository was renamed to `h1s97x/profile-3d-contrib` (the same
# name as the CNB primary repository). The old `github-profile-3d-contrib`
# name returns HTTP 301, so old `uses:` coordinates still resolve, but this
# script targets the current name explicitly.
#
# `main` and `latest` are both updated: `@main` reads the default branch, while
# `@latest` is the moving branch used by earlier release automation. The most
# recent tag is pushed too (for example `v1.0.1`), so pinned `uses:` coordinates
# resolve. A tag stays attached to its release commit even when `main` advances.
#
# Required:
#   GITHUB_TOKEN   GitHub PAT with contents:write on the target repository
# Optional:
#   GITHUB_REPO     default h1s97x/profile-3d-contrib
#   GITHUB_BRANCHES default "main latest"
#   GITHUB_TAGS     tags to push; default = nearest tag reachable from SRC_REF
#   SRC_REF         default HEAD (what to publish)
#
# Usage (from the CNB primary repository checkout):
#   GITHUB_TOKEN=ghp_xxx ./sync-github.sh
#
# Do not commit a token. Do not paste CI logs containing the remote URL.
set -euo pipefail

REPO="${GITHUB_REPO:-h1s97x/profile-3d-contrib}"
BRANCHES="${GITHUB_BRANCHES:-main latest}"
SRC_REF="${SRC_REF:-HEAD}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    echo "ERROR: GITHUB_TOKEN is required (contents:write on ${REPO})." >&2
    exit 1
fi

REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"

for branch in ${BRANCHES}; do
    echo "-> ${REPO}:${branch} <- ${SRC_REF}"
    if ! git push --force --quiet "${REMOTE}" "${SRC_REF}:refs/heads/${branch}" 2>/dev/null; then
        echo "ERROR: push to ${REPO}:${branch} failed (check the PAT scope and branch protection)." >&2
        exit 1
    fi
done

TAGS="${GITHUB_TAGS:-$(git describe --tags --abbrev=0 "${SRC_REF}" 2>/dev/null || true)}"
for tag in ${TAGS}; do
    echo "-> ${REPO}:refs/tags/${tag}"
    if ! git push --force --quiet "${REMOTE}" "refs/tags/${tag}:refs/tags/${tag}" 2>/dev/null; then
        echo "ERROR: push of tag ${tag} failed." >&2
        exit 1
    fi
done

echo "GitHub mirror updated: branches [${BRANCHES}], tags [${TAGS:-none}]"
