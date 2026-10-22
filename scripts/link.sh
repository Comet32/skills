#!/usr/bin/env bash
# Symlink every skill under skills/ into each agent client's global skills
# directory, so editing this repo edits the installed skills. Meant for the
# author's own machines; everyone else installs with `npx skills add Comet32/skills`.
#
# Usage: scripts/link.sh            create missing links
#        scripts/link.sh --check    dry run: report what would change, write nothing
#
# Safety: an existing target that is not already our symlink is never touched,
# only reported.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK=0
if [ "${1:-}" = "--check" ]; then CHECK=1; fi

# Global skills directories, taken from the agent table of the `skills` CLI
# (github.com/vercel-labs/skills, src/agents.ts). A directory is used only when
# its parent (the client's own config folder) exists on this machine.
TARGETS=(
  "$HOME/.claude/skills"               # Claude Code
  "$HOME/.agents/skills"               # Codex, Cline, Warp, Kimi Code CLI, ...
  "$HOME/.cursor/skills"               # Cursor
  "$HOME/.gemini/skills"               # Gemini CLI
  "$HOME/.gemini/antigravity/skills"   # Antigravity
  "$HOME/.copilot/skills"              # GitHub Copilot
  "$HOME/.config/opencode/skills"      # OpenCode
  "$HOME/.config/agents/skills"        # Amp
  "$HOME/.deepagents/agent/skills"     # Deep Agents
  "$HOME/.firebender/skills"           # Firebender
)
CLAUDE_TARGET="$HOME/.claude/skills"
# Skills that only work in Claude Code: linked into CLAUDE_TARGET alone.
CLAUDE_ONLY=(sync-mattpocock-skills)

link() {
  local src="$1" dst="$2"
  if [ -L "$dst" ]; then
    [ "$(readlink "$dst")" = "$src" ] && return 0
    echo "skip (symlink to $(readlink "$dst")): $dst"; return 0
  fi
  if [ -e "$dst" ]; then echo "skip (exists, not a symlink): $dst"; return 0; fi
  if [ "$CHECK" = 1 ]; then echo "would link: $dst"; return 0; fi
  mkdir -p "$(dirname "$dst")"
  ln -s "$src" "$dst"
  echo "linked: $dst"
}

for target in "${TARGETS[@]}"; do
  [ -d "$(dirname "$target")" ] || continue
  for dir in "$ROOT"/skills/*/; do
    name="$(basename "$dir")"
    if [[ " ${CLAUDE_ONLY[*]} " == *" $name "* ]] && [ "$target" != "$CLAUDE_TARGET" ]; then continue; fi
    link "$ROOT/skills/$name" "$target/$name"
  done
done

# The mattpocock sync tooling keeps its historical path.
if [ -d "$HOME/.claude" ]; then link "$ROOT/third-party/mattpocock" "$HOME/.claude/skills-sync"; fi

if [ "$CHECK" = 1 ]; then echo "(--check: nothing written)"; fi
