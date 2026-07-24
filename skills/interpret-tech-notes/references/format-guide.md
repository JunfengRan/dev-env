# 输出格式选型：Markdown vs HTML

参考 [Anthropic：HTML 的非理性有效](https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html)，结合 **Learning 仓库** 与 **Cursor 实际展示能力** 做取舍。

## 结论（本仓库策略）

**不全量替换 Markdown。** 采用混合格式：

| 格式 | 默认用于 | 原因 |
|------|----------|------|
| **Markdown** | 论文、博客、短笔记、索引 | GitHub 原生渲染、Grep/Agent 友好、diff 可读、已有 Mermaid CI |
| **HTML** | 长应用技术深挖、多图架构说明、需浏览器阅读的 explainer | 信息密度、导航、SVG/CSS、可折叠、浏览器直接打开分享 |
| **双文件** | 超长应用技术（推荐） | `.md` 摘要 + 索引入口；`.html` 完整交互版 |

## Cursor vs Claude Code 的差异（必知）

Anthropic 文章的场景是 **Claude Code 在浏览器里直接预览 HTML artifact**。Cursor 不同：

| 能力 | Markdown | HTML |
|------|----------|------|
| 编辑器内阅读 | ✅ 预览友好 | ⚠️ 多为源码视图，需「在浏览器打开」 |
| Chat 内嵌渲染 | ✅ 代码块/表格可读 | ❌ 不会像 Claude artifact 一样内嵌交互页 |
| Agent 读取成本 | ✅ 低（纯文本） | ⚠️ 标签冗余，token 更高 |
| Grep / git diff | ✅ 清晰 | ❌ diff 噪声大 |
| GitHub 浏览 | ✅ 原生 + Mermaid | ⚠️ 显示源码，需本地/部署后看效果 |
| 复杂布局 / 标签页 / 着色分级 | ⚠️ 受限 | ✅ CSS + SVG |
| 离线自包含分享 | ⚠️ 依赖 GitHub 渲染 | ✅ 单文件双击即读 |

因此：**在 Cursor 里写笔记，仍应以 Markdown 为 Agent 协作主格式；HTML 是人类精读与对外分享的主格式。**

## 决策树

```
开始
  │
  ├─ 论文 / 博客摘录？ ──→ Markdown（固定）
  │
  ├─ 应用技术深挖？
  │     │
  │     ├─ 预估 < 150 行 且 ≤ 2 张图？ ──→ Markdown
  │     │
  │     ├─ ≥ 150 行 或 ≥ 3 张架构图？ ──→ HTML（或 MD 摘要 + HTML 全文）
  │     │
  │     ├─ 需要标签页 / 折叠附录 / 严重性配色？ ──→ HTML
  │     │
  │     └─ 用户要求「浏览器可读 / 可分享 explainer」？ ──→ HTML
  │
  └─ 不确定？ ──→ 先 Markdown；超长再拆 HTML
```

## 双文件模式（应用技术推荐）

```
docs/knowledge/papers/    → 仅 .md
docs/knowledge/blogs/     → 仅 .md
docs/knowledge/apps/
  ├── 2026-07-14-cursor-agent.md      # 摘要：metadata + 一句话 + 目录 + 链接
  └── 2026-07-14-cursor-agent.html    # 全文：调用链、对比、SVG、附录
```

- `README.md` 索引**只链到 `.md`**（摘要里含 HTML 链接）
- Agent 后续会话优先读 `.md`；人类深挖点进 `.html`

## 格式与图表

| 场景 | Markdown 路径 | HTML 路径 |
|------|---------------|-----------|
| 流程/序列图 | Mermaid（遵守 `draw-mermaid-diagrams`） | 内嵌 SVG（优先）或 Mermaid.js（自包含脚本） |
| 对照表 | Markdown table | `<table>` + 列宽/斑马纹 |
| 代码索引 | 表格 + 反引号路径 | `<code>` + 可点击锚点 |
| 验证 | `npm run validate:mermaid` | `npm run validate:html-svg`（见 [html-svg-guide.md](./html-svg-guide.md)） |

## 何时不用 HTML

- 论文/博客（篇幅短，不值得维护 HTML diff）
- 主要靠 Agent grep 检索的速查片段
- 用户明确要「纯 Markdown / GitHub 友好」
