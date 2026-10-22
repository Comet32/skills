# PRD template

Copy to `<ISSUE_DIR>/<feature-slug>/PRD.md` (see SKILL.md → Where the PRD goes). Delete sections that genuinely do not
apply — but deleting one because it is *hard to fill* is the failure this skill
exists to prevent.

## Node status

Every node carries exactly one:

| Status | Meaning |
|---|---|
| `aligned` | Settled. Either the user said it, or you verified it and cited the source. |
| `assumed` | You inferred it from existing code or convention. Defensible, not confirmed. **Must have a matching entry in Open questions.** |
| `open` | Not settled. Points at the open question blocking it. |

`assumed` exists so a reader can see at a glance which sentences are yours
rather than theirs. A PRD whose nodes are all `aligned` after an AFK round with
no user contact is lying.

---

```markdown
# PRD — <feature name>

Slug: <feature-slug>
Loop: round <N>, <PASS | EXIT | CAP | running>
Open questions: <count>
Updated: <YYYY-MM-DD>

## 1. Problem

What is broken or missing today, and for whom. Not the solution.

Status: <aligned|assumed|open>

## 2. Goal

The outcome that means this is done. One or two sentences.

Status: <...>

## 3. Scope

### In
- ...

### Explicitly out
- ... — <why, and whether it is deferred or rejected>

An empty "Explicitly out" is a gap, not a clean scope.

Status: <...>

## 4. Requirement tree

Nest as deep as the requirement actually goes. Each leaf is something an
implementer could build and a reviewer could check.

### 4.1 <area>
Status: <...>
<the requirement>
Source: <where this came from — the user, or file:line, or a doc path>

#### 4.1.1 <sub-requirement>
Status: <...>
...

## 5. Data and integration

For each: the store, the shape, the owner, the direction of the call, and
whether the change is additive or breaking.

- **<service / index / table>** — <what changes>
  Status: <...>
  Source: <...>

Note here whether a persisted-schema change is involved, and what this project
requires alongside one — a mapping/schema doc update, a migration runbook, a
backfill script. Check `CLAUDE.md` for the rule; many projects have one and it
is easy to miss.

## 6. Acceptance

Each line must be checkable by someone at a terminal.

- [ ] <observable condition>

## 7. Non-functional

Scale, latency, failure mode, backfill of existing data, rollback.
Write "not a concern, because ..." rather than deleting a line you did not think
about.

## 8. Open questions

Ordered so that answering an earlier one may dissolve a later one.

### Q1 — <question>
**Blocks:** <node ids>
**Recommended:** <your answer>
**Why:** <reasoning, and what you checked>
**Changes if the other way:** <what in the tree moves>

### Q2 — ...

## 9. Verified facts

Everything the loop established by looking rather than asking. Kept separate so
the user can spot-check the investigation without re-reading the tree.

| Fact | Source |
|---|---|
| ... | `path/to/file.ts:42` |
```
