---
name: deep-research-gates
description: >-
  修复 deep-research 阶段 gate 失败：读 gate stderr、补 artifacts、重跑 gate 脚本。
  触发：gate failed、beforePhaseTransition 失败、research 阶段无法推进。
---

# Deep Research Gates 修复

当 deterministic gate 失败时：

1. 读 ContextPack `L1_session_anchor.gateLastResult.reason` 或 gate stderr
2. 对照 `spec/gates/README.md` 修复对应 artifact
3. 重跑：`node scripts/research-cli.mjs advance .research/<run-id>`（或 `node scripts/gates/<gate>.mjs .research/<run-id>`）
4. 通过后由 `research-cli advance` / reducer `GATE_PASSED` 更新 `state.json`

Gate 列表见 `spec/research-workflow.yaml` 的 `gates` 段。
