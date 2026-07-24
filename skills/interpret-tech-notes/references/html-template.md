# HTML 应用技术笔记模板

自包含单文件 HTML，无外部 CDN 依赖，可离线双击打开。

## 文件骨架

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>[项目名] 学习笔记</title>
  <style>
    :root {
      --bg: #fafafa;
      --fg: #1a1a1a;
      --muted: #666;
      --border: #e0e0e0;
      --accent: #2563eb;
      --code-bg: #f4f4f5;
      --card: #fff;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f1117;
        --fg: #e8e8e8;
        --muted: #9ca3af;
        --border: #2d333b;
        --accent: #60a5fa;
        --code-bg: #1c2128;
        --card: #161b22;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.6;
    }
    .layout {
      display: grid;
      grid-template-columns: 240px 1fr;
      max-width: 1200px;
      margin: 0 auto;
    }
    nav {
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      padding: 1.5rem 1rem;
      border-right: 1px solid var(--border);
      font-size: 0.875rem;
    }
    nav a { color: var(--muted); text-decoration: none; display: block; padding: 0.25rem 0; }
    nav a:hover { color: var(--accent); }
    main { padding: 2rem 2.5rem 4rem; max-width: 820px; }
    h1 { font-size: 1.75rem; margin-top: 0; }
    h2 { font-size: 1.25rem; margin-top: 2.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    h3 { font-size: 1.05rem; margin-top: 1.5rem; }
    .meta { color: var(--muted); font-size: 0.9rem; margin-bottom: 2rem; }
    .meta dt { font-weight: 600; display: inline; }
    .meta dd { display: inline; margin: 0 1rem 0 0.25rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 1rem 0; }
    th, td { border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }
    th { background: var(--code-bg); }
    code, pre { font-family: ui-monospace, "Cascadia Code", monospace; font-size: 0.85rem; }
    code { background: var(--code-bg); padding: 0.15rem 0.35rem; border-radius: 3px; }
    pre { background: var(--code-bg); padding: 1rem; overflow-x: auto; border-radius: 6px; }
    .tag { display: inline-block; background: var(--code-bg); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; margin: 1rem 0; }
    details { margin: 1rem 0; }
    summary { cursor: pointer; font-weight: 600; }
    .svg-wrap { overflow-x: auto; margin: 1.5rem 0; }
    @media (max-width: 768px) {
      .layout { grid-template-columns: 1fr; }
      nav { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--border); }
    }
  </style>
</head>
<body>
  <div class="layout">
    <nav aria-label="目录">
      <strong>[项目名]</strong>
      <hr />
      <a href="#s1">§1 心智模型</a>
      <a href="#s2">§2 调用链</a>
      <a href="#s3">§3 核心循环</a>
      <!-- … -->
      <a href="#appendix">附录</a>
    </nav>
    <main>
      <h1>[项目名] 学习笔记</h1>
      <dl class="meta">
        <dt>来源</dt><dd>…</dd>
        <dt>仓库</dt><dd><code>path/to/repo</code></dd>
        <dt>日期</dt><dd>YYYY-MM-DD</dd>
        <dt>读者</dt><dd>算法工程师</dd>
      </dl>
      <p class="card"><strong>一句话：</strong>…</p>

      <section id="s1">
        <h2>§1 整体心智模型与学习路径</h2>
        <!-- 内容 -->
      </section>

      <!-- 架构图：优先内嵌 SVG -->
      <div class="svg-wrap">
        <svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="调用链">
          <!-- 矩形 + 箭头，见 html-template 说明 -->
        </svg>
      </div>

      <section id="appendix">
        <h2>附录</h2>
        <details>
          <summary>关键代码文件速查</summary>
          <table>...</table>
        </details>
      </section>

      <footer style="color: var(--muted); font-size: 0.8rem; margin-top: 3rem;">
        生成时间：YYYY-MM-DD · Learning 仓库
      </footer>
    </main>
  </div>
</body>
</html>
```

## HTML 写作要点

### 结构

- **左侧 sticky nav** + 右侧正文（移动端 nav 置顶）
- 章节 id 与 nav 锚点一一对应：`#s1` … `#s8`、`#appendix`
- 附录用 `<details>` 折叠，降低首屏长度

### 图表

- **优先内嵌 SVG**：架构/序列/数据流；布局规范见 [html-svg-guide.md](html-svg-guide.md)
- SVG 节点标签用真实模块名；`viewBox` 固定，宽度 100% 自适应
- 树形/分层图用 T 型分叉，禁止单点 fan-out 挤在一行
- 若必须用 Mermaid：在 HTML 底部加本地 `mermaid` 脚本 + `mermaid.run()`（仍须目测，不走仓库 CI）

### 表格

- 对照表、代码索引、API role 速查 → `<table>`
- 严重性分级（PR review 风格）可用行 class 或 `data-severity` + CSS 配色

### 代码

- 路径用 `<code>codex-rs/core/src/session/turn.rs</code>`
- 长片段用 `<pre><code>`，可加注释标行号范围

### 可选交互（按需）

- 「复制阅读顺序命令」按钮：`navigator.clipboard.writeText`
- 标签页对比（OpenCode vs Codex）：纯 CSS `:target` 或少量 vanilla JS
- **不要**为笔记引入构建步骤或 npm 依赖

### 配套 Markdown 摘要（双文件时）

```markdown
# [项目名] 学习笔记（摘要）

> **完整版**：[2026-07-14-xxx.html](./2026-07-14-xxx.html)（浏览器打开）
> **来源**：…

## 一句话
…

## 目录
| 章节 | 主题 |
|------|------|
| §1 | … |

## 为何用 HTML 完整版
- 全文约 N 行，含 M 张架构图与横向对比表
- 完整版含可导航目录与折叠附录，适合浏览器精读
```

## 质量要求（与 Markdown 应用技术等价）

HTML 只是载体，**深挖深度不变**：调用链、核心循环、上下文工程、对比表、设计决策、代码索引——全部保留，只是呈现更丰富。
