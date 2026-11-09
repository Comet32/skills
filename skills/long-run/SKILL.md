---
name: long-run
description: Kick off a long autonomous run — finish line, a ledger file, subagent fan-out with evidence checks, and a report that leads with what's blocked on me.
argument-hint: "The whole task, in one message"
disable-model-invocation: true
---

Run the task in the arguments to its **finish line** with as few stops as possible. The **stop rule** decides when to stop and ask; everything else, keep going. Use the stop rule in the user's CLAUDE.md / AGENTS.md when there is one; otherwise stop only when you can't continue without the user, or before anything destructive or outward-facing (deleting data, committing or pushing, writing to a shared environment, sending anything on the user's behalf).

## 1. Fix the finish line

Write the finish line as a checkable, exhaustive condition: "every endpoint uses the new client, the old client is deleted, `pnpm lint` and `pnpm build` pass". Take the checks from the repository's own verification rules (its CLAUDE.md, `package.json` scripts), not from habit.

When the task names its finish line, use it. When it doesn't and the repository can't supply one, write your best reading and start. Ask only when two readings would produce different work.

Done when: the finish line is one sentence a reader could check without asking you.

## 2. Open the ledger

The **ledger** is the run's task list, kept in a file so it survives context compaction and the user can read progress there instead of the scrollback.

- Location: `.scratch/<task-slug>/TASKS.md` when git ignores `.scratch/`; otherwise a scratch or temp directory outside the repository. Tell the user the full path once.
- Shape: the finish line on top, then `- [ ]` items, then a `## Blocked on me` section.
- Tick an item the moment its evidence is in hand. Append work you discover as new items. Fold anything the user adds mid-run in as items too.
- After a compaction, or whenever unsure where the run stands, re-read the ledger before acting.

Done when: every unit of work you can see is an item.

## 3. Fan out independent units

When the work splits into units that share no files (one per service, per module, per endpoint group), give each unit to its own subagent. Brief each with its unit, the finish line for that unit, and the **evidence** it must return: file and line, command and output.

When a subagent reports, check its evidence yourself (open the line, rerun the command) before ticking the item. A claim without evidence goes back as a follow-up, not into the ledger as done. Units that touch the same files run one after another.

Small units (a handful of tool calls) stay in this session. A client without subagents works the units itself, one at a time, with the same evidence bar.

## 4. Work the ledger

Take items in order. Between items, put status notes in the same message as the next action. When an item hits the stop rule, move it to `## Blocked on me` with what you need and why, then carry on with the items that don't depend on it.

Done when: every item is ticked or sits in `## Blocked on me`, and the finish line's checks were actually run and pass (or their failure is itself a Blocked item).

## 5. Report

End the run with three headings, in this order:

- **Blocked on me**: each open decision or approval, one line each, with what happens on yes.
- **Changed**: what is now different, by file or system.
- **Found**: what you learned along the way. Mark anything you couldn't confirm and say where you looked.
