# dev-env 文档

## 结构

| 路径 | 用途 |
|------|------|
| `docs/knowledge/` | 学习笔记产出（interpret-tech-notes） |
| `docs/design/` | 设计/选型文档产出（write-idea-docs） |
| `docs/examples/` | 独立可读样例 + 完整 research run |
| `docs/examples/overlays/` | 如何为目标仓叠加项目专有 rules（非默认安装；适用于任意应用） |

## Deep Research 四条主线

1. **Spec** — `spec/research-workflow.yaml` 状态机
2. **ContextPack** — `.research/<run-id>/context-pack.json` 分层上下文
3. **Gate** — `scripts/gates/*.mjs` deterministic 放行
4. **Replay** — `replay-chain.json` + snapshots

启发式补充：[`skills/brainstorm`](../skills/brainstorm/SKILL.md) 用于意图/方案澄清，**不是** Spec 阶段。

完整 run 样例：`docs/examples/sample-research-run/`

## 安装

见仓库根 [README.md](../README.md)。

## CI

```bash
npm ci
npm run validate
```
