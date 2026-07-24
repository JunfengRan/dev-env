---
name: brainstorm
description: >-
  启发式创意澄清：在实现或深度研究前，通过对话细化意图、约束与方案取舍。
  触发：新功能/架构构思、需求模糊、方案取舍、用户说 brainstorm/头脑风暴/先设计再写。
  非硬门禁——用户已有明确计划或改动显然琐碎时可跳过。
---

# Brainstorm（启发式，非流水线）

把模糊想法变成可评审的短设计。本 skill **不进入** `spec/research-workflow.yaml`，也不阻断 gate / reducer。

## 何时用 / 何时跳过

| 建议使用 | 可以跳过 |
|----------|----------|
| 新功能、新模块、行为变更且意图未对齐 | 用户已给出可执行 plan / US |
| 多方案取舍未定 | 单行修复、文案、显然琐碎的改动 |
| 即将写 architecture / selection 文档 | 用户明确说「直接做，别 brainstorm」 |
| deep-research 的 brief 前研究问题仍糊 | 证据目标与读者已写清 |

默认姿态：**建议 → 征求同意 → 再展开**。不要未经提示就开长篇 brainstorm。

## 融合原则（来源）

| 理念 | 来源 | 在本 skill 中的形态 |
|------|------|---------------------|
| 一次一问、多选优先 | Superpowers brainstorming | 澄清阶段默认一次一问 |
| 2–3 方案 + 推荐 | Superpowers | 探索阶段必给取舍与推荐 |
| 分段呈现设计、增量确认 | Superpowers | 按复杂度缩放段落 |
| YAGNI / 范围过大先拆 | Superpowers | 多子系统先分解再 brainstorm 第一块 |
| 现有代码优先、边界清晰 | Superpowers | 先读仓再提案；单位职责单一 |
| 方案取舍表 + metadata | write-idea-docs | 落盘时用设计文档习惯 |
| 证据意识 | deep-research / interpret-tech-notes | 涉及实现断言时标「待验证」 |
| Spec 自检 | Superpowers self-review | 落盘后扫 TBD/矛盾/歧义 |

## 轻量流程（可中途退出）

```
0. 征得同意（一句）→ 1. 扫项目上下文 → 2. 澄清（一次一问）
→ 3. 2–3 方案取舍 → 4. 短设计确认 → 5. 可选落盘 → 6. 交接下一 skill
```

任一步用户说「够了 / 直接做」→ 立即结束 brainstorm，进入实现或 research。

### Step 0：征得同意

示例：

> 这块看起来还没对齐意图/方案。要不要先快速 brainstorm（几轮澄清 + 方案对比）？也可以直接做。

### Step 1：项目上下文

- 读相关文件、docs、近期结构；跟随现有模式
- 请求过大（多个独立子系统）→ **先拆分**，再对第一块 brainstorm
- 不跑无关重构

### Step 2：澄清

- **一次一问**；能多选就多选
- 聚焦：目的、约束、成功标准、非目标
- 不要一次抛出问卷

### Step 3：方案取舍

- 给出 **2–3** 个可行路径
- 每项：要点、代价、适用场景
- **先写推荐项 + 理由**（不要假中立堆砌）

### Step 4：短设计

按复杂度缩放：琐碎几句；复杂则分节（架构 / 组件 / 数据流 / 错误与测试），每节可问「这样可以吗」。

设计时检查：

- 单元是否单一职责、接口是否清晰
- 能否在不读内部的情况下理解用途
- 是否违反 YAGNI

### Step 5：可选落盘

用户需要可追溯文档时写入：

- 产品/架构向：`docs/design/YYYY-MM-DD-<topic>-brainstorm.md`（或交给 `write-idea-docs` 升格为 `*-architecture.md`）
- 研究向：把结论摘要并入 `.research/<run-id>/artifacts/research-brief.json` 的 scope / evidenceTargets 草稿

落盘后快速自检：无 TBD、无自相矛盾、范围可执行、歧义已拍板。

### Step 6：交接（非强制链）

| 下一意图 | 交接 |
|----------|------|
| 写实现计划 | 用户确认后进入 `.cursor/plans/` 或写作计划流程 |
| 写设计文档 | `write-idea-docs` |
| 深度研究/选型 | `deep-research`（从 brief 起；brainstorm 不占 Spec state） |
| 直接编码 | 回到 `dev-workflow` 快速路径 |

**不要**把 brainstorm 当成必须接到 writing-plans / deep-research 的硬终端态。

## 与硬流水线的边界

- **不**新增 Spec state、gate、reducer 事件
- **不**在 stop hook 里强制跑 brainstorm
- **不**因「太简单」以外的原因默认拦截所有编码（与 Superpowers HARD-GATE 不同：此处为启发式）
- Visual companion / 浏览器 mockup：**可选**；无本地 companion 服务时用 Mermaid / 文字对比即可（`draw-mermaid-diagrams`）

## 产出检查（若落盘）

见 [references/heuristic-checklist.md](references/heuristic-checklist.md)。
