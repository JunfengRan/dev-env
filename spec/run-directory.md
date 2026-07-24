# Research Run Directory Convention

Each deep-research session creates an isolated run under `.research/<run-id>/` (gitignored at workspace root; sample committed under `docs/examples/`).

## Run ID

Format: `{YYYY-MM-DD}-{slug}-{shortHash}`

Example: `2026-07-24-sample-agent-abc12`

Prefer creating runs with:

```bash
node scripts/research-cli.mjs init <run-id> [--slug <slug>]
```

## Layout

```
.research/<run-id>/
├── run-meta.json
├── state.json
├── context-pack.json
├── snapshots/
│   └── context-pack@vN.json
├── observations.jsonl
├── replay-chain.json
└── artifacts/
    ├── research-brief.json
    ├── explore-notes.md
    ├── evidence/
    ├── comparative-catalog.json
    ├── skill-delta.md
    └── ...
```

## state.json

Tracks reducer state: `currentState`, `barrier`, `history`, `aborted`.
Mutations should go through `scripts/research-cli.mjs` (`apply` / `advance`) or `research-reducer.mjs`, not ad-hoc edits.

## ContextPack versioning

- Bump `metadata.context_pack_version` on each successful phase transition
- Snapshot to `snapshots/context-pack@vN.json` via `research-cli advance` (calls `plugins/deep-research-gates/scripts/bump-context-pack.mjs`)
- Gate outcomes are written to `L1_session_anchor.gateLastResult` by `research-cli`

## Active run resolution

When `run-dir` is omitted:

1. `--run-id` flag or `RESEARCH_RUN_ID` env
2. Else newest `.research/*/state.json` by mtime among non-`done` / non-`aborted` runs

## Replay

`replay-chain.json` entries link snapshot + artifact + gate result for phase-level replay.
Successful `advance` appends an entry automatically.

See `docs/examples/sample-research-run/` for a complete example.
