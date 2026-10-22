---
name: grill-afk
description: A relentless interview that runs itself — an adversarial red-team loop walks the requirement tree instead of asking the human node by node, and produces a PRD plus an explicit list of the questions only the human can answer.
disable-model-invocation: true
---

# Grilling a requirement with an AFK loop

Grill-Me walks a requirement tree with the human, one round of frontier
questions at a time. That is still O(depth) round trips of synchronous human
attention, and most of those nodes are things you could have looked up yourself.

This skill inverts it: **the machine walks the whole tree first, and the human
only sees what the machine genuinely could not answer.**

The output is a PRD — a complete requirement tree — plus an open-questions list
of everything that needed a human.

## Where the PRD goes

Find the project's issue directory, in this order. Do not invent a location and
do not ask if one of the first three answers:

1. A path the user names.
2. The project's own convention: `docs/agents/issue-tracker.md` if it exists
   (the Matt Pocock setup writes one), otherwise whatever `CLAUDE.md` /
   `AGENTS.md` says about where issues, PRDs or specs live.
3. An existing `.scratch/` directory.
4. Otherwise `.scratch/<feature-slug>/` — create it, and say so once.

Below, `<ISSUE_DIR>/<feature-slug>/` means whatever you settled on.

## The one rule that makes this work

Gaps come in two kinds, and they must never be treated the same:

| Kind | Example | What you do |
|---|---|---|
| **Verifiable** | "What type is this field in the OpenSearch mapping?" "Does this endpoint already return X?" "Which service owns this?" | Go find out. Read the code, the mapping docs, the context files. Write the answer into the PRD as fact, with the source. |
| **Human-only** | "Which of these two behaviours do we want?" "Is this edge case in scope for v1?" "What did you agree with the other team?" | **Write it into the open-questions list. Never write it into the PRD body as a statement.** |

A model asked to produce a complete PRD will quietly turn kind-2 gaps into
plausible-sounding declarative sentences. That is the exact failure this whole
loop exists to prevent — it converts "an explicit question the human would have
answered" into "a default buried in prose that the human will skim past."

If you catch yourself writing a sentence you cannot point to a source for and
the user never said, stop. It is an open question.

## Phase 0 — Scaffold

1. Pick a `<feature-slug>` (kebab-case, from the requirement). Confirm it with the
   user in one line if it is not obvious.
2. Reconnaissance. Read, in this order:
   - the project's agent-facing docs (`CLAUDE.md` / `AGENTS.md`)
   - the domain model, if the project keeps one: `CONTEXT.md`, a context map,
     `docs/adr/`. A project that runs `/grill-with-docs` has these, and they are
     the best ground truth you will get — the glossary turns "this noun has two
     meanings" from a hunch into a checkable gap, and an ADR tells you a
     decision was already weighed rather than overlooked.
   - the docs of each module the requirement plausibly touches
   Dispatch an `Explore` subagent for the code sweep if more than two modules
   are involved. Do not read the whole repo in the main context.
3. Write `<ISSUE_DIR>/<feature-slug>/PRD.md` from
   `references/prd-template.md`. Every node carries a status — `aligned`,
   `assumed` or `open`, defined in that template. A section you cannot fill yet
   gets `open`; do not leave it blank and do not guess it full.
4. Write `<ISSUE_DIR>/<feature-slug>/loop-log.md` with the round-0 counts.

Announce the three loop parameters to the user before the first round:
the pass condition, the exit condition, and the round cap (defaults below).

## Phase 1 — The loop

Each round is exactly these four steps.

### 1. Dispatch the red team

Spawn **one `general-purpose` subagent per round** using the prompt in
`references/redteam-prompt.md`. It gets a fresh context, the current PRD, and
the repo pointers. It does **not** get your reasoning, your drafts, or your
justifications.

The separate context is the point. A model reviewing text it just wrote is
systematically lenient about it; a model seeing that text cold is not. If you
skip the subagent and "review it yourself," this skill degrades into the
single-session self-iteration that reliably declares alignment on round two.

Run the red team in the background so the user can interject.

### 2. Triage every gap it returns

For each gap, decide **verifiable** or **human-only** (see the table above).
When genuinely unsure, treat it as human-only — a needless question costs one
line; a fabricated answer costs a rebuild.

Reject any gap where the red team could not name a concrete wrong decision an
implementer would make. That is a padding finding; drop it and say so in the log.

### 3. Resolve

- **Verifiable** → investigate now. Read the file, run the query, check the doc.
  Write the answer into the PRD node and cite where it came from
  (`path/to/file.ts:42`, a doc path). If investigation fails to settle it, it
  becomes human-only — say why.
- **Human-only** → append to `## Open questions` with:
  its id, the question, **your recommended answer**, the reasoning behind that
  recommendation, and what changes downstream depending on which way it goes.
  Mark the affected PRD node `Status: open` and reference the question id.
- **Inferred but not confirmed** → when you settled something from existing
  convention rather than a citable source, mark the node `assumed` **and** file
  it as an open question anyway. `assumed` is not a third way to avoid asking —
  it is a flag telling the reader that sentence is yours, not theirs.

Never delete a node to make the tree look cleaner. Pruning is the human's call
(Phase 3).

**A subagent's report is second-hand.** When a sweep hands you a line reference
for anything you are about to write into the PRD as a finding, open that line
yourself. A summary reliably drops the sentence that reframes the fact — a
comment saying a behaviour is deliberate, a doc line recording it as a settled
non-goal. Writing "nobody has recorded this problem" about something the code
comments explain is the characteristic failure here, and it is expensive because
it sends the human chasing a decision that was already made.

### 4. Log and test the termination conditions

Append a row to `loop-log.md`:

```
| Round | New verifiable gaps | Resolved | New open questions | Open total | Padding dropped |
```

Then check, **against the log, not against your impression**:

- **PASS** — two consecutive rounds produced zero new verifiable gaps, and the
  open-questions total did not change in either.
- **EXIT** — the open-questions total failed to decrease for two consecutive
  rounds *and* new verifiable gaps are zero. The tree is as aligned as it can
  get without the human.
- **BLOCK** — a human-only question has surfaced that makes further automated
  verification unreliable: the running environment does not match the code you
  can read, the requirement's upstream document is unreachable, the data you
  would verify against is known-wrong. Stop immediately and put that question
  first. Another round here does not produce more alignment, it produces more
  findings whose truth value nobody can judge.
- **CAP** — round 5 (default). Stop regardless and say which condition was
  unmet.

Otherwise, next round.

BLOCK is the one condition you judge rather than count, and the only one that
can fire on round 1. It is not "this is hard" — it is "the ground I am standing
on is not the ground the answer lives on."

The reason the others are counted rather than judged: "I think it's aligned" has no
ground truth and a model will reach for it. A number in a file does.

### Budget

Default cap is 5 rounds. Raise it if the user asks. If a round costs more than
it returns — one gap found, all padding — stop early and say so; do not burn
the cap to look thorough.

## Phase 2 — The finish

Ask which finish the user wants if they have not said. Default is **non-AFK**.

### Non-AFK (default)

Walk `## Open questions` **one at a time**, in dependency order (questions whose
answers change other questions go first). For each: state the question, your
recommended answer, and the reasoning — then stop and wait.

One question per message. Not a batch, not a numbered list of five. The user's
answer to Q1 routinely dissolves Q3 or changes what Q4 should even be.

After each answer: write it into the PRD node, flip that node to
`Status: aligned`, and strike the question from the list.

### AFK

Deliver the PRD and the open-questions list as-is and stop. Say plainly how many
questions are open and that the tree is not aligned until they are answered.
Do not soften this — an unanswered open question is a node the implementation
will get wrong.

## Phase 3 — Iterating on the tree

Once the human has the whole tree, they operate on it rather than rebuilding it.
Support these three, and say so when you hand the PRD over:

| They say | You do |
|---|---|
| "这块还没对齐" / a node is still vague | Re-run one loop round scoped to that subtree only |
| "这部分整个不对，砍了重来" | Delete that subtree, then re-run scoped to the gap it left |
| "这里理解偏了，应该是 X" | Correct the node, then re-run scoped to its descendants — a corrected parent usually invalidates children |

Scoped re-runs use the same red-team prompt with the subtree substituted for the
full PRD. Log them as rounds too.

## What this skill does not do

It does not plan implementation and it does not write code. When the PRD is
aligned, hand off to whatever the project uses next — `/to-spec` and
`/to-tickets` in a Matt Pocock setup, `superpowers:writing-plans` otherwise.
Put the resulting plan wherever that project keeps plans; check `CLAUDE.md`
rather than assuming.

It does not commit. The user reviews and commits themselves.
