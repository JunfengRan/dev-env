# 如何读 research-workflow.yaml

## 必读字段

- `initialState` — run 起点
- `states.<name>.kind` — agent | parallel_subagents | skill | terminal
- `states.<name>.gate` — 对应 `gates` 段的脚本
- `onPass` / `onFail` — gate 后下一状态（fail 常自环）

## parallel_subagents

- `spawn[].foreach` — 通常 `contextPack.L3_evidence_layer.evidenceTargets`
- `sync: all_complete` — 全部 subagent 完成后才可 GATE_PASSED
- 用 `after-subagent-complete.mjs` 更新 barrier

## transitions

- `USER_ABORT` — 任意状态 → `aborted`

## Reducer 事件

`GATE_PASSED` | `GATE_FAILED` | `SUBAGENT_COMPLETED` | `USER_ABORT` | `PHASE_ENTER`

见 `scripts/research-reducer.mjs`。
