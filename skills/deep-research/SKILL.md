---
name: deep-research
description: >-
  按 spec/research-workflow.yaml 编排多角度深度研究：状态机、ContextPack、subagent barrier、gate 放行。
  触发：深入分析、技术选型、竞品对比、源码验证、决策文档、deep research。
---

# Deep Research（薄编排层）

**阶段定义不在本 SKILL** — 唯一真相源是 [`spec/research-workflow.yaml`](../../spec/research-workflow.yaml)。

## 启动 / 恢复 Run

1. 用 CLI 新建 run（推荐）或恢复已有目录（见 [`spec/run-directory.md`](../../spec/run-directory.md)）：

```bash
node scripts/research-cli.mjs init <run-id> --slug <slug>
# 或: npm run research -- init <run-id> --slug <slug>
```

2. 确认 `run-meta.json`、`state.json`、`context-pack.json`、`observations.jsonl`、`replay-chain.json` 已生成
3. Read Spec + 当前 `state.json` 的 `currentState`（也可用 `node scripts/research-cli.mjs status`）

## 每轮循环

```
读 Spec 当前 state → 按 contextSlice 组装 ContextPack 注入
→ 执行（agent / skill / parallel_subagents）
→ 写 artifacts → research-cli advance（gate + reducer + bump）
→ 写 observation（subagent 用 after-subagent-complete）
```

## 状态类型

| kind | 行为 |
|------|------|
| `agent` | 主 deep-research agent 执行 |
| `parallel_subagents` | dispatch codebase-verifier；barrier 同步 |
| `skill` | 调用 interpret-tech-notes 或 write-idea-docs |
| `terminal` | 结束 |

## 禁止

- 未跑 gate / 未 `advance` 就宣称 phase 完成
- 跳过 Spec 未定义的 transition
- 子 agent 结论只写 chat 不写 `observations.jsonl`
- 手改 `state.json` barrier（应走 reducer / CLI / after-subagent-complete）

## References

- [read-spec-guide.md](references/read-spec-guide.md)
- [context-pack-guide.md](references/context-pack-guide.md)
- [subagent-dispatch-guide.md](references/subagent-dispatch-guide.md)
- [replay-guide.md](references/replay-guide.md)
- [plan-critique-playbook.md](references/plan-critique-playbook.md)
- [depth-checklist-decision.md](references/depth-checklist-decision.md)

## 工具命令

```bash
node scripts/research-cli.mjs init <run-id> --slug <slug>
node scripts/research-cli.mjs status [run-dir]
node scripts/research-cli.mjs advance [run-dir]
node scripts/research-cli.mjs apply <run-dir> '<event-json>'
node scripts/gates/<gate>.mjs .research/<run-id>
node plugins/deep-research-gates/scripts/after-subagent-complete.mjs .research/<run-id> <subagentId> <artifact>
node plugins/deep-research-gates/scripts/bump-context-pack.mjs .research/<run-id> <phase>
npm run validate:research-spec
```
