---
name: interpret-tech-notes
description: >-
  将论文、博客、前沿应用技术解读为 dev-env 知识库笔记（Markdown 或 HTML）。
  触发：用户要求解读/精读/摘录论文、博客、开源 Agent 项目或应用技术；
  写到 docs/knowledge/；或提到「写笔记」「技术深挖」「学习手册」「会话整合」。
---

# 技术内容解读 → 学习笔记

把外部材料或代码仓库，写成 **可检索、可复习、可横向对比** 的学习笔记。输出到 `docs/knowledge/`。

## 输出目录

| 类型 | 输出目录 |
|------|----------|
| 论文 | `docs/knowledge/papers/` |
| 博客 | `docs/knowledge/blogs/` |
| 应用技术 | `docs/knowledge/apps/` |
| 训练/模型 | `docs/knowledge/training/` |

## 统一工作流

```
0. 选格式 → 1. 收集材料 → 2. 定读者与范围 → 3. 列大纲 → 4. 深挖取证
→ 5. 写正文 → 6. 补附录 → 7. 更新索引 → 8. 验证
```

应用技术必挖 9 项：调用链、核心循环、Thread/Turn 边界、上下文工程、Skills/MCP、Prompt Cache、设计决策、横向对比、测试即规格。

详见 [references/format-guide.md](references/format-guide.md) 与各模板。

## 验证

| 格式 | 验证 |
|------|------|
| Markdown + Mermaid | `npm run validate:mermaid` |
| 应用技术 | [references/depth-checklist.md](references/depth-checklist.md) |
| deep-research consolidate 阶段 | gate `knowledge-note-depth` |

## 协作

- 画图 → `draw-mermaid-diagrams`
- 横向对比 → 先 Read `docs/knowledge/apps/*-note.md`
- 由 `deep-research` workflow 的 `consolidate` 状态调用
