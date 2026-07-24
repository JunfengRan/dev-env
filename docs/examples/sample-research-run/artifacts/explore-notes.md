# Explore Notes: Sample Runtime

## Architecture overview

Sample runtime uses a session loop with tool rounds and compaction on overflow.

## Core loop

ReAct-style loop: user message → LLM → tools → persist → repeat until stop.

## Context engineering

History is stored in SQLite; compaction truncates head/tail then calls summary model.

## Open questions

- Cross-session memory: not found in core loop during initial grep of session and tool registry modules.
- Active recall tools: not present in default tool surface exposed to the main agent loop.
- Event bus consistency: CLI and Web surfaces may subscribe to different event topic prefixes, requiring further verification in gateway and SSE adapter code paths.

## Comparison hints

When consolidating, compare memory and compaction behavior against other runtimes using the same catalog dimensions: cross-session recall, compact strategy, and event delivery semantics.

## Next verification targets

Focus read paths under `src/compaction/` and `src/tools/registry.ts` for evidence rows in the verify phase.

## Session lifecycle notes

Sessions are persisted in SQLite with message parts stored as rows. The main loop loads recent history on each turn and projects a linear transcript for the model. When token estimates exceed configured thresholds, the compaction subsystem truncates older segments before invoking a summary model. This differs from DAG-based transcript systems that retain branch pointers for forked sessions.

## Tool surface

Default tools include file read, shell execution, and search helpers. No first-class memory_search or search_history tool appears in the default registry, which affects cross-session recall and post-compact recovery strategies documented in the comparative catalog phase.
