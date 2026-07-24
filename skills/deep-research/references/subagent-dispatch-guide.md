# Subagent 并行与 Barrier

## verify 阶段

1. 从 `research-brief.json` 的 `evidenceTargets[]` 写入 ContextPack L3
2. 对每个 target dispatch `codebase-verifier` subagent
3. 输出 `artifacts/evidence/{targetId}.json`
4. 每个完成后：

```bash
node plugins/deep-research-gates/scripts/after-subagent-complete.mjs \
  .research/<run-id> <targetId> artifacts/evidence/<targetId>.json
```

5. `state.json` barrier.completed === expected 后跑 `evidence-table-valid` gate

## 父 Agent 同步

读 `observations.jsonl` + ContextPack L5，**不依赖** chat 压缩记忆。

## 分工

- subagent：只验证分配到的 target，返回 structured JSON
- 父 agent：合并 mergedEvidence，决定何时 GATE_PASSED
