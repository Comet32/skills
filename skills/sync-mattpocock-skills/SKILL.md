---
name: sync-mattpocock-skills
description: Upgrade the local copies of mattpocock/skills to the latest upstream, re-apply local patches, and summarise what changed.
disable-model-invocation: true
argument-hint: "[ref] — branch, tag or commit SHA (default: main)"
metadata:
  internal: true
---

Everything lives in `third-party/mattpocock/` of the user's skills repo (github.com/Comet32/skills). `scripts/link.sh` exposes it as `~/.claude/skills-sync/`, the path used below:

- `sync.sh [--check] [ref]` — fetches upstream, stages the skills listed in `manifest`, applies `patches/*.patch`, then installs into `~/.claude/skills/`. If any patch fails it exits (code 2) before writing anything.
- `manifest` — the only skills the script touches. Anything else in `~/.claude/skills/` is the user's own.
- `patches/` — local customizations on top of upstream, applied in lexical order.
- `UPSTREAM_SHA` / `PREVIOUS_SHA` — the synced commit and the one before it.
- `backup/<date>/`, `removed/<date>/` — copies taken before overwriting or deleting. Git-ignored; they stay on this machine.

`sync.sh`, `manifest`, `patches/`, `CHANGELOG.md` and the SHA files are tracked in the repo, so commit them after a sync.

## Steps

1. Run `~/.claude/skills-sync/sync.sh --check $ARGUMENTS` and show the summary.
2. If a patch failed: show the upstream change around the failing hunk, propose a re-created patch, and wait for the user's go-ahead before writing it. Do not proceed to step 3 until `--check` passes.
3. Before overwriting, copy the skills listed under "Updated" to `~/.claude/skills-sync/backup/<today>/`.
4. Run `~/.claude/skills-sync/sync.sh $ARGUMENTS`.
5. Summarise the upstream changes since `PREVIOUS_SHA`: read the new entries at the top of `~/.claude/skills-sync/CHANGELOG.md` (or `gh api repos/mattpocock/skills/compare/<PREVIOUS_SHA>...<UPSTREAM_SHA>`). Call out, in Chinese:
   - **Breaking changes / behaviour changes** in skills the user relies on (grilling, grill-with-docs, to-spec, to-tickets, implement, diagnosing-bugs, code-review, domain-modeling).
   - Skills **removed or renamed** upstream — listed by the script as "gone upstream". Propose removing them from `manifest` and moving the local folder to `removed/<today>/`; wait for confirmation.
   - **New skills** listed as "Upstream but not in manifest" — one line each with whether it is model-invocable; ask which to add.
6. Check that nothing in the user's own skills (everything under `skills/` in the repo, e.g. `ambitious`, `grill-afk`) now references a renamed or removed skill.
7. Offer to commit the changed files under `third-party/mattpocock/`.
