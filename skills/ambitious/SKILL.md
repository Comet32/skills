---
name: ambitious
description: Upgrade a task or prompt into a more ambitious version along three axes (altitude, depth, range), and execute only after the user confirms. Use only when the user explicitly mentions ambitious.
disable-model-invocation: true
---

# Ambitious

Upgrade the user's task (or a prompt) along three independent axes, produce an upgraded prompt that can be run as is, **stop and wait for the user to pick a direction**, and only then do the work.

- **Altitude**: climb the ladder of goals — **which thing to do**. Ask "why" of the task and hand the model the goal one level up.
- **Depth**: same task, drill down into materials, tools and verification — **how professionally it gets done**.
- **Range**: bring in more disciplines sideways — **how many fields it draws on**.

Climbing down the altitude ladder (breaking the task into finer steps for the model) is micromanagement and has nothing to do with depth; depth always means "the same task, done by the model the way a top expert would do it".

Source: Felix Rieseberg, *How to be more ambitious: A tutorial for humans with models* (2026-10-13). Speed (doing the same thing faster) is out of scope for this skill.

Write everything the user reads in the user's language.

## Steps

### 1. Restate and gate

In one sentence, restate what the task literally is and who currently decides "how": whether the user has already prescribed the steps (micromanagement, so step 3 has a lot of room to climb) or has left that to the model.

**Gate**: when the task is done in one step and leaves no downstream decision or reuse value (fixing a typo, looking up a fact, converting a format), tell the user "this isn't worth upgrading", give the ordinary way to do it, and stop.

**Deliverable**: by default the work is executed in the current environment. When the user makes clear the prompt is meant for somewhere else (another repo, another agent, another machine), the deliverable is "prompt only".

Done when: a one-sentence restatement + the gate verdict (continue / stop) + the deliverable (execute / prompt only).

### 2. Survey the environment

First read the project's own conventions and home-grown tools (`CLAUDE.md` / `AGENTS.md` / `CONTEXT.md` / `docs/adr/`, in-house plugins or scripts); the upgrade has to build on them. Then actually check what is available: data sources, MCP connectors, CLIs, repos, tests and scripts, and any **behavioural data** (logs, usage records, review history, conversation history) that reflects the current state. Every direction's feasibility later rests on what you find here, not on assumptions.

Stop once the next three steps have their inputs; this is not a full census. For privacy-sensitive sources (conversation history, personal logs, files containing credentials), record only that they exist; reading their contents goes on the step 6 prerequisites for the user's consent.

When the deliverable is "prompt only", the current environment is not where the work will run: skip the hands-on survey and put the data sources and tools the target environment must have on the step 6 prerequisites.

Done when: an "available / missing" list where every item is a specific name (a particular MCP, table or command) plus one key number, not a category. When the task itself does not depend on data or tools (copy, design, planning work), keep the list honestly short; writing "none" is fine.

### 3. Altitude

1. Keep asking "why are we doing this" and build a goal ladder of at least 3 rungs, from the original task up to the point where you hit the fundamental reason the thing (or the institution behind it) exists.
2. Mark each rung with whether the model can **sense** it on its own (get data on the current state) and **verify** it on its own (confirm it got it right). The highest rung with both is the recommended rung; for the rungs above it, list what is missing.
3. Signals: the result will be discussed in a meeting afterwards → worth raising. Creative work (the artefact is the point) → altitude gives way to depth and range. A goal so high the model can neither sense nor verify it ("go make money") → don't pick it.

**When the original task is already a high, vague wish** ("make X easier to use", "improve Y"), the job of this step is not to keep climbing but to **pin it to a measurable rung**: find the rung nearest the original task where sensing and verifying both hold, and translate "better" into a metric that can be computed.

Done when: every rung of the ladder carries sense and verify marks (✓ / △ partial / ✗), and "better" on the recommended rung maps to one specific metric.

### 4. Depth

For the task at the recommended rung, answer each of these, every answer landing on a concrete object:

1. What a **top professional** would do here in addition, without being asked.
2. Which **rawest material** they would start from (raw logs, raw tables, source code) rather than an already digested report.
3. The **specific methods and tools** they use (databases, statistical models, profilers, benchmark scripts…). The point is a change of method; a change of wording is only the surface.
4. **External judge**: besides the model and the user, what can prove the result is right — tests, a compiler, a backtest, predictions on held-out data, reconciliation against an authoritative system. Prefer something the model can run itself and get immediate feedback from. The judge's **test questions come from real data or from the user directly**, with a held-out share kept for acceptance only; questions the model writes itself count only as a dev set.

Plus two more:
- **Reproduce the hypothesis**: first test the user's definition of **the problem itself** — rewrite "the problem is X" as "try to reproduce it from the raw data", and list other possible problem definitions. The user has not confirmed a direction yet, so this check uses only data already readable in step 2 and stays at the scale of a few queries or one reproduction script; a check that needs heavy analysis or private data becomes the first step of a direction option, done after confirmation. Once the data overturns or rewrites the problem definition, that is the most important finding of the whole proposal and goes at the very top of step 6. Where possible, add "find a signal nobody knows about yet, and prove it on unseen data".
- **Unreasonable target**: taking the number measured in step 2 as the baseline, set the metric an order of magnitude out (baseline 10s → target 200ms, not 5s), and write into the prompt "This is entirely solvable; keep going." When there is no baseline yet, the first step of the upgraded prompt is to measure it, then set the target from it.

Done when: each of the four questions names a specific file, table, command or metric, and one that genuinely has no counterpart is marked "N/A" with a one-line reason; the external judge can never be N/A and is something runnable (for non-code work: comparison against real samples, a computable metric, or real readers' reactions), with the source of its questions stated; the problem definition is supported by data, rewritten, or marked "unverified" with how to verify it.

### 5. Range

1. **Nouns to verbs**: rewrite the task's object ("a slide deck", "a page") as one verb sentence — whom it actually gets to do what, within how long.
2. **Assemble the team**: from the verbs, derive one by one the disciplines that can contribute a perspective, including at least one **red team** (someone who professionally doubts this output, such as a short seller, a forensic accountant, a security researcher).
3. Write each member as "the specific thing that profession would **do**", giving a list of methods; keep the output's own style, and borrow the methods. Subagents can take on different members in parallel.

Done when: one verb sentence; every member maps to a verb and a concrete action.

### 6. Deliver the proposal and stop

Steps 2–5 are working notes; what you deliver is the conclusion. Output in this order, so the user can decide after reading the first three parts:

1. **Bottom line first** (≤ 5 lines): the first line is the task restatement + "worth upgrading"; then the most important finding (especially a problem definition rewritten in step 4, with the key number behind it) + the recommended direction.
2. **Direction options**: 2–3 of them (for example "depth only", "pin to a measurable rung + depth", "add a range team"), each with its trade-offs and **cost** (rough time, number of subagents, what the user has to put in). When the deliverable is "execute", add one more option: "prompt only, don't execute".
3. **Prerequisites**: what only the user can supply (permissions, data, hand-written test questions, consent to read private data), and which direction each one affects.
4. **Upgraded prompt**: for the recommended direction, one block that can be copied and run as is.
5. **Rationale** (last, kept lean; terminals can't fold, so title it "Rationale (skippable)" and separate it from the first four parts with a horizontal rule): the 2×2 position (guard especially against "high-but-shallow": once the goal is raised, it must come with the external judge from step 4), the goal ladder table, the key points of the four questions, the team table — one table or a few lines each, without retelling the reasoning.

Then stop and wait for the user to pick a direction or make changes.

Done when: all five parts are present; the bottom line is at most 5 lines; the upgraded prompt states the external judge, the source of its test questions and how to run it.

### 7. Execute (after the user confirms)

When the deliverable is "prompt only", or the user picked "prompt only, don't execute", step 6 is the end.

Otherwise the upgraded prompt for the chosen direction is the execution spec: if the user picked a direction other than the recommended one, first write that direction's prompt, then start; if the user edited the prompt, the edited version wins. Before declaring done, run the external judge and report its actual output as evidence; if the judge did not run or did not pass, report the current state and do not declare done. When a judge that needs a real person (real readers, the user's own acceptance check) has not happened yet, still run and report every judge the model can run, report the overall state as "pending acceptance" rather than "done", and say who still needs to do what.
