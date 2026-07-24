---
name: write-idea-docs
description: >-
  在 dev-env 撰写或修订开源设计文档（架构 / 技术栈 / 工作流 / 选型决策）。
  触发：用户要求写架构设计、技术栈总览、方案取舍、选型决策；
  新建或修改 docs/design/ 下 *-architecture.md、*-tech-stack.md、*-workflow.md、*-selection.md。
---

# 设计文档写作

将产品/系统想法写成 **可评审、可落地、可横向对比** 的设计文档。

## 文档类型与命名

| 类型 | 文件名模式 | 输出目录 |
|------|------------|----------|
| 架构 | `{topic}-architecture.md` | `docs/design/` |
| 技术栈 | `{topic}-tech-stack.md` | `docs/design/` |
| 工作流 | `{topic}-workflow.md` | `docs/design/` |
| 选型决策 | `{topic}-selection.md` | `docs/design/` |

## 统一工作流

```
1. 定类型与命名 → 2. 写 metadata → 3. 列大纲 → 4. 写核心 Idea
→ 5. 方案取舍表 → 6. 架构图 → 7. 交叉链接 → 8. 验证
```

选型决策文档必须含：选型前提、竞品对比、编号 catalog（XX-NN）、优先级表（P0–P3）。

模板见 [references/architecture-template.md](references/architecture-template.md)、[references/tech-stack-template.md](references/tech-stack-template.md)。

## 验证

- Mermaid → `npm run validate:mermaid`
- 深度 → [references/depth-checklist.md](references/depth-checklist.md)
- deep-research decide 阶段 → gate `decision-doc-complete`

## 协作

- 画图 → `draw-mermaid-diagrams`
- 由 `deep-research` workflow 的 `decide` 状态调用
