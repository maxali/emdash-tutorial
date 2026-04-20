#!/usr/bin/env bash
# Compare upstream emdash against this tutorial's pinned revisions.
#
# Reads the pin table in HOWTOUPDATE.md, fetches current upstream state
# via `gh`, and prints:
#   - Whether we're behind / caught up
#   - Every commit since the pin (one-line summaries)
#   - Latest release tag vs our pinned release
#
# Run from repo root: bash .claude/skills/update-emdash-tutorial/scripts/check-upstream.sh

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HOWTO="$REPO_ROOT/HOWTOUPDATE.md"

if [[ ! -f "$HOWTO" ]]; then
  echo "error: HOWTOUPDATE.md not found at $HOWTO" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not installed. Install from https://cli.github.com" >&2
  exit 1
fi

# --- Extract pinned SHAs and release from HOWTOUPDATE.md §1 -----------------

# Table rows look like:
#   | [`emdash-cms/emdash`](...) | commit `f7f4814182e1...` | 2026-04-20 | `main` branch |
#   | [`emdash-cms/emdash`](...) | release `emdash@0.5.0` | 2026-04-14 | npm/release |
#   | [`emdash-cms/templates`](...) | commit `d2f03414bc70...` | 2026-04-13 | `main` branch |

pinned_emdash_sha=$(grep -oE '\`[a-f0-9]{40}\`' "$HOWTO" | head -n 1 | tr -d '`')
pinned_templates_sha=$(grep -oE '\`[a-f0-9]{40}\`' "$HOWTO" | sed -n '2p' | tr -d '`')
pinned_emdash_release=$(grep -oE 'emdash@[0-9.]+' "$HOWTO" | head -n 1)

if [[ -z "$pinned_emdash_sha" || -z "$pinned_templates_sha" ]]; then
  echo "error: could not extract pinned SHAs from HOWTOUPDATE.md §1" >&2
  echo "       the regex expects 40-char hex SHAs in backticks"      >&2
  exit 1
fi

# --- Helpers ----------------------------------------------------------------

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
rule()  { printf '%.s─' $(seq 1 70); echo; }
note()  { printf '  %s\n' "$*"; }

short() { echo "${1:0:10}"; }

compare_commits() {
  local repo="$1" pinned="$2"
  local current count
  current=$(gh api "repos/$repo/commits/main" --jq '.sha')

  if [[ "$current" == "$pinned" ]]; then
    note "✓ up to date ($(short "$current"))"
    return
  fi

  count=$(gh api "repos/$repo/compare/$pinned...main" --jq '.total_commits')
  note "↑ $count new commit(s) on main"
  note "  pinned:  $(short "$pinned")"
  note "  current: $(short "$current")"
  echo
  gh api "repos/$repo/compare/$pinned...main" \
    --jq '.commits[] | "  \(.sha[0:10])  \(.commit.message | split("\n")[0])"' \
    | head -n 40
  local overflow
  overflow=$(( count - 40 ))
  if (( overflow > 0 )); then
    note ""
    note "… and $overflow more. For the full list:"
    note "  gh api \"repos/$repo/compare/$pinned...main\" --jq '.commits[].commit.message'"
  fi
}

compare_release() {
  local latest_tag latest_date
  latest_tag=$(gh api repos/emdash-cms/emdash/releases/latest --jq '.tag_name' 2>/dev/null || echo "unknown")
  latest_date=$(gh api repos/emdash-cms/emdash/releases/latest --jq '.published_at' 2>/dev/null | cut -c1-10 || echo "")

  if [[ "$latest_tag" == "$pinned_emdash_release" ]]; then
    note "✓ release up to date ($latest_tag)"
  else
    note "↑ new release available"
    note "  pinned:  $pinned_emdash_release"
    note "  latest:  $latest_tag  ($latest_date)"
    echo
    gh api repos/emdash-cms/emdash/releases/latest --jq '.body' \
      | head -n 20 \
      | sed 's/^/    /'
  fi
}

# --- Report ----------------------------------------------------------------

rule
bold "emdash tutorial — upstream check"
rule
echo
echo "Pinned (from HOWTOUPDATE.md §1):"
note "emdash main:     $(short "$pinned_emdash_sha")"
note "emdash release:  $pinned_emdash_release"
note "templates main:  $(short "$pinned_templates_sha")"
echo

rule
bold "emdash-cms/emdash — main"
rule
compare_commits "emdash-cms/emdash" "$pinned_emdash_sha"
echo

rule
bold "emdash-cms/emdash — latest release"
rule
compare_release
echo

rule
bold "emdash-cms/templates — main"
rule
compare_commits "emdash-cms/templates" "$pinned_templates_sha"
echo

rule
bold "Next steps"
rule
echo "1. Filter out infra / test / perf-demo commits (see SKILL.md §2)"
echo "2. Map remaining commits to affected chapters (HOWTOUPDATE.md §3)"
echo "3. Edit only those docs/*.html files"
echo "4. npm run build   # rebuild search + stamp assets (mandatory)"
echo "5. npm run dev     # verify locally"
echo "6. Update pin table in HOWTOUPDATE.md §1"
echo "7. git commit + npm run deploy"
echo
