#!/usr/bin/env bash
# Mirror the CNB primary repository to the GitHub-side distribution endpoint.
#
# The GitHub repository exists only to keep existing `uses: owner/repo@ref`
# references working. It is a mirror, never a source of truth; all development
# happens on cnb.cool/h1s97x/plugins/profile-3d-contrib.
#
# Both `main` and `latest` are updated: `@main` reads the default branch, while
# `@latest` is the branch that earlier releases force-pushed for Marketplace users.
#
# Required:
#   GITHUB_TOKEN   GitHub PAT with contents:write on the target repository
# Optional:
#   GITHUB_REPO    default h1s97x/github-profile-3d-contrib
#   GITHUB_BRANCHES  default "main latest"
#   SRC_REF        default HEAD (what to publish)
#
# Usage (from the CNB primary repository checkout):
#   GITHUB_TOKEN=ghp_xxx ./sync-github.sh
#
# Do not commit a token. Do not paste CI logs containing the remote URL.
set -euo pipefail

REPO="${GITHUB_REPO:-h1s97x/github-profile-3d-contrib}"
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

echo "GitHub mirror updated: ${BRANCHES}"
