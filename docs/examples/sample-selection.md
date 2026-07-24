> **文档类型**：开源设计想法 · 技术选型探讨
> **版本**：v1.0 · 2026-07

# Sample Agent Base Selection

## 选型前提

目标读者：系统工程师，需要可 fork 的 TS 基座，不可接受重度 Gateway 运维。

## 竞品对比

| 维度 | Runtime A | Runtime B | Sample |
|------|-------------|-------------|--------|
| 跨 Session 记忆 | 有 | 无 | 无 |
| Compaction | DAG | head/tail | head/tail |
| 上手成本 | 高 | 中 | 低 |

## 缺陷 catalog

| ID | 缺陷 | 验证 |
|----|------|------|
| SR-01 | 无跨 Session 记忆 | true |
| SR-02 | Compact 后不可工具化召回 | true |
| SR-03 | Event 总线按 surface 分裂 | partial |

## 后续迭代优先级

| 优先级 | 项 | 理由 |
|--------|-----|------|
| P0 | 执行安全 | 无 OS 沙箱 |
| P1 | 记忆工具 | 办公体验 |
| P2 | Event 分层 | 可观测性 |
