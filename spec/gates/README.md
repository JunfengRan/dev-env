# Research Gate Scripts

Each gate is a deterministic Node script invoked as:

```bash
node scripts/gates/<gate-name>.mjs <run-dir>
```

Or via the orchestration CLI (preferred for phase transitions):

```bash
node scripts/research-cli.mjs advance [run-dir]
```

## Contract

- **Exit 0**: gate passed
- **Exit 1**: gate failed; print human-readable reason to stderr
- **Input**: run directory containing `artifacts/`, optional `context-pack.json`

## Gates

| Gate | Artifact | Checks |
|------|----------|--------|
| `brief-complete` | `artifacts/research-brief.json` | reader, scope, evidenceTargets[] |
| `explore-min-depth` | `artifacts/explore-notes.md` | min sections + word count |
| `evidence-table-valid` | `artifacts/evidence/*.json` | verdict + filePath per row |
| `knowledge-note-depth` | `docs/knowledge/apps/*-note.md` or run artifact path | call chain section, mermaid count |
| `catalog-numbered` | `artifacts/comparative-catalog.json` | numbered entries |
| `decision-doc-complete` | `docs/design/*-selection.md` or artifact | premise, compare table, priorities |
| `optional` | any | always pass |

## Hook / CLI integration

`plugins/deep-research-gates` stop hook calls `node scripts/research-cli.mjs advance <run-dir>`.

On gate failure, `research-cli` writes the structured reason to ContextPack `L1_session_anchor.gateLastResult` (`result: "fail"`) and exits 1; the hook surfaces a `followup_message`. On pass, it applies `GATE_PASSED`, bumps ContextPack via `bump-context-pack.mjs`, and appends a `replay-chain` entry.
