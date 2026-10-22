#!/usr/bin/env bash
# Sync the skills listed in ./manifest from github.com/mattpocock/skills into
# ~/.claude/skills, then re-apply local customizations from ./patches.
#
# Usage: sync.sh [ref]        ref = branch, tag or commit SHA (default: main)
#        sync.sh --check [ref] dry run: report what would change, write nothing
#
# Safety: everything is staged in a temp dir first. If any patch fails to
# apply, the script exits before touching ~/.claude/skills.
set -euo pipefail

REPO="mattpocock/skills"
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.claude/skills"
CHECK=0
if [ "${1:-}" = "--check" ]; then CHECK=1; shift; fi
REF="${1:-main}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> Fetching $REPO@$REF"
SHA="$(gh api "repos/$REPO/commits/$REF" --jq .sha)"
gh api "repos/$REPO/tarball/$SHA" > "$TMP/src.tgz"
mkdir "$TMP/src"
tar xzf "$TMP/src.tgz" -C "$TMP/src" --strip-components=1
UP="$TMP/src/skills"
PREV_SHA="$(cat "$HERE/UPSTREAM_SHA" 2>/dev/null || echo none)"
echo "    upstream: $SHA (previous: $PREV_SHA)"

# Resolve each manifest entry to its upstream folder.
mkdir "$TMP/stage"
NAMES=()
MISSING=()
while IFS= read -r line; do
  name="${line%%#*}"; name="$(echo "$name" | tr -d '[:space:]')"
  [ -z "$name" ] && continue
  case "$name" in */*|.*) echo "invalid manifest entry: $name" >&2; exit 1;; esac
  src="$(find "$UP" -mindepth 2 -maxdepth 2 -type d -name "$name" -not -path '*/deprecated/*' | head -1)"
  if [ -z "$src" ]; then MISSING+=("$name"); continue; fi
  if [ -L "$DEST/$name" ]; then echo "refusing: $DEST/$name is a symlink" >&2; exit 1; fi
  cp -R "$src" "$TMP/stage/$name"
  NAMES+=("$name")
done < "$HERE/manifest"

# Apply patches in lexical order against the staged copies.
shopt -s nullglob
for p in "$HERE"/patches/*.patch; do
  if ! patch -p1 -d "$TMP/stage" --forward --batch --dry-run --silent < "$p" >/dev/null; then
    echo "PATCH FAILED: $(basename "$p") — upstream changed the patched lines." >&2
    echo "Nothing was written. Re-create the patch against the new upstream and re-run." >&2
    patch -p1 -d "$TMP/stage" --forward --batch --dry-run < "$p" >&2 || true
    exit 2
  fi
  patch -p1 -d "$TMP/stage" --forward --batch --silent < "$p"
  echo "    patched: $(basename "$p")"
done
find "$TMP/stage" \( -name '*.orig' -o -name '*.rej' \) -delete

# Report and install.
ADDED=(); UPDATED=(); SAME=()
for name in "${NAMES[@]}"; do
  if [ ! -d "$DEST/$name" ]; then ADDED+=("$name")
  elif diff -rq "$TMP/stage/$name" "$DEST/$name" >/dev/null 2>&1; then SAME+=("$name")
  else UPDATED+=("$name"); fi
done

# Upstream skills not in the manifest (candidates to add).
UNLISTED=()
for d in "$UP"/*/*/; do
  n="$(basename "$d")"
  case "$(basename "$(dirname "$d")")" in deprecated) continue;; esac
  [[ " ${NAMES[*]} " == *" $n "* ]] || UNLISTED+=("$(basename "$(dirname "$d")")/$n")
done

echo "==> Added (${#ADDED[@]}): ${ADDED[*]:-}"
echo "==> Updated (${#UPDATED[@]}): ${UPDATED[*]:-}"
echo "==> Unchanged (${#SAME[@]})"
echo "==> In manifest but gone upstream (${#MISSING[@]}, left untouched): ${MISSING[*]:-}"
echo "==> Upstream but not in manifest (${#UNLISTED[@]}): ${UNLISTED[*]:-}"

if [ "$CHECK" = 1 ]; then echo "(--check: nothing written)"; exit 0; fi

for name in ${ADDED[@]+"${ADDED[@]}"} ${UPDATED[@]+"${UPDATED[@]}"}; do
  rsync -a --delete "$TMP/stage/$name/" "$DEST/$name/"
done
cp "$TMP/src/CHANGELOG.md" "$HERE/CHANGELOG.md"
echo "$PREV_SHA" > "$HERE/PREVIOUS_SHA"
echo "$SHA" > "$HERE/UPSTREAM_SHA"
echo "==> Done. UPSTREAM_SHA=$SHA"
