# ContextPack 分层与 slice

Schema: `spec/context-pack.schema.json`

| 层 | 用途 | Spec contextSlice 名 |
|----|------|----------------------|
| L0 | 研究边界 | L0_constraints |
| L1 | 当前 state / gate 结果 | L1_session_anchor |
| L2 | 探索摘要 | L2_dialogue_window |
| L3 | 证据目标与合并 | L3_evidence_layer |
| L4 | 已有笔记与对比维 | L4_knowledge_refs |
| L5 | subagent 观测 | L5_subagent_observations |

## Task Observation Context

写入 `metadata`: `pipeline_id`, `phase_id`, `context_pack_version`, `run_id`

## 版本化

每次 phase transition 后：

```bash
node plugins/deep-research-gates/scripts/bump-context-pack.mjs .research/<run-id> <phase>
```

## 示例

见 `docs/examples/sample-research-run/context-pack.json`
