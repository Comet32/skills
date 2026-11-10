# skills

English | [简体中文](README.zh-CN.md)

Global agent skills I wrote and use myself. Each skill is `skills/<name>/SKILL.md` in the open Agent Skills format, so any agent client that supports the format can install it: Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot and more.

## Install

```bash
npx skills add Comet32/skills
```

The installer asks which skills to install and into which clients. Common options:

| To | Use |
|---|---|
| See what is available first | `npx skills add Comet32/skills --list` |
| Install a single skill | `npx skills add Comet32/skills --skill ambitious` |
| Install globally, for every project | add `-g` |
| Pick the clients | add `-a claude-code codex cursor` |

The installer is [vercel-labs/skills](https://github.com/vercel-labs/skills); its docs list the supported clients and their directories.

## Skills

| Skill | What it does | Clients |
|---|---|---|
| [`ambitious`](skills/ambitious/SKILL.md) | Upgrades a task or prompt along three axes (altitude, depth, range) into a more ambitious version. It delivers a proposal and stops for you to pick a direction, executes only after you confirm, and must run an external judge before declaring done. Invoke with `/ambitious <task>`; it replies in your language | All |
| [`grill-afk`](skills/grill-afk/SKILL.md) | A requirements interview that runs itself: a red-team loop walks the requirement tree instead of asking you node by node, and produces a PRD plus a list of the questions only you can answer | All; its subagent split is written for Claude Code, so other clients may run it single-threaded |
| [`long-run`](skills/long-run/SKILL.md) | Kicks off a long autonomous run: fixes a checkable finish line, keeps the task list in a ledger file that survives context compaction, fans independent units out to subagents and checks each one's evidence, and ends with a report that leads with what is blocked on you. Invoke with `/long-run <task>` | All; the subagent fan-out is written for Claude Code, other clients work the units one at a time |
| [`local-chrome`](skills/local-chrome/SKILL.md) | Drives the Chrome running on your own machine through its DevTools port on 127.0.0.1: opens a new foreground tab that keeps your logins, runs a steps script you write (click, type, assert), saves screenshots and a results file, then closes only the tabs it opened. An opt-in resident broker means Chrome asks for "Allow" once instead of on every run. Invoke with `/local-chrome` | All that can run shell commands; needs Node 22+ and Chrome with remote debugging enabled |
| [`sync-mattpocock-skills`](skills/sync-mattpocock-skills/SKILL.md) | Syncs mattpocock/skills to the latest upstream, re-applies local patches and summarises what changed upstream | Claude Code only. Marked internal, so `npx skills add` does not list it by default |

To install one skill on its own, globally:

```bash
npx skills add Comet32/skills --skill ambitious -g
npx skills add Comet32/skills --skill grill-afk -g
npx skills add Comet32/skills --skill long-run -g
npx skills add Comet32/skills --skill local-chrome -g
```

All of these run only when you invoke them explicitly. Claude Code enforces this through `disable-model-invocation`; other clients ignore that field and rely on the wording of each description.

## Developing on your own machine

```bash
git clone git@github.com:Comet32/skills.git ~/Documents/GitHub/skills
~/Documents/GitHub/skills/scripts/link.sh --check
~/Documents/GitHub/skills/scripts/link.sh
```

`link.sh` symlinks every skill under `skills/` into the global skills directory of each client installed on the machine, and links `third-party/mattpocock/` as `~/.claude/skills-sync`. From then on, editing the repo edits the installed skills. An existing target that is not already one of this repo's symlinks is never overwritten, only reported. Run it again after adding a skill.

## Third-party skills I depend on

Third-party skills are not copied into this repo; see [ADR 0001](docs/adr/0001-第三方-skill-不复制进仓库.md) (in Chinese) for why. Install them on a new machine as needed:

| Source | Install | Contents |
|---|---|---|
| [mattpocock/skills](https://github.com/mattpocock/skills) | `third-party/mattpocock/sync.sh`, then upgrade with `/sync-mattpocock-skills` | The 36 skills listed in `manifest`, plus the local patches in `patches/`; installed into Claude Code only |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | `npx skills add Leonxlnx/taste-skill -g` | 13 frontend design-taste skills |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | `npx skills add heygen-com/hyperframes -g` | 11 HyperFrames video-making skills |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | `npx skills add vercel-labs/skills --skill find-skills -g` | `find-skills` |

## Layout

```
skills/<name>/SKILL.md     my own skills; the installer discovers them here
third-party/mattpocock/    sync script, manifest and local patches for mattpocock/skills
scripts/link.sh            symlink install for the author's machines
GLOSSARY.md                terminology (in Chinese)
docs/adr/                  design decisions (in Chinese)
```

## License

[MIT](LICENSE)
