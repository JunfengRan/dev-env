> **来源**：dev-env 示例
> **阅读日期**：2026-07-24
> **读者定位**：系统工程师
> **范围**：虚构 Sample Runtime 的记忆与压缩机制

# Sample Runtime 学习笔记

## 目录

| 章节 | 主题 | 关键文件 |
|------|------|----------|
| 1 | 调用链 | src/session/loop.ts |
| 2 | 压缩 | src/compaction/truncate.ts |

## 1. 调用链

用户输入 → SessionLoop → LLM → Tools → SQLite 持久化。

```mermaid
flowchart LR
    User[UserInput] --> Loop[SessionLoop]
    Loop --> LLM[LLMProvider]
    LLM --> Tools[ToolRunner]
    Tools --> Store[SQLiteStore]
```

## 2. 核心循环

ReAct 变体，单层 while pending。

```mermaid
sequenceDiagram
    participant Loop as SessionLoop
    participant LLM as LLMProvider
    Loop->>LLM: streamTurn
    LLM-->>Loop: tool_calls
```

## 3. 上下文工程

History 投影每轮重算；compact 时 head/tail 截断。

## 代码索引

- `src/session/loop.ts` — 主循环
- `src/compaction/truncate.ts` — 压缩策略
