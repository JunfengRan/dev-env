# Deep Research Gates

Deterministic phase gates for the deep-research workflow.

## Components

- **Hook** (`hooks/before-phase-transition.ts`): on `stop`, runs the gate for the active `.research/<run-id>/` state
- **Scripts** (plugin-local):
  - `scripts/after-subagent-complete.mjs` — append observation + update barrier
  - `scripts/bump-context-pack.mjs` — version snapshot
- **Gate validators** live in the consuming repo at `scripts/gates/*.mjs` (this plugin shells out to them)

## Prerequisites

- Hook runtime: [Bun](https://bun.sh) (`bun run …` in `hooks/hooks.json`)
- Gate scripts + Spec present in the workspace root (`scripts/gates/`, `spec/research-workflow.yaml`)

## Manual gate run

```bash
node scripts/gates/brief-complete.mjs .research/<run-id>
```

## Subagent completion

```bash
node plugins/deep-research-gates/scripts/after-subagent-complete.mjs \
  .research/<run-id> runtime-core artifacts/evidence/runtime-core.json
```

## Context pack bump

```bash
node plugins/deep-research-gates/scripts/bump-context-pack.mjs .research/<run-id> verify
```

## Install

Copy or link this plugin to `~/.cursor/plugins/` and enable it in Cursor plugin settings.
