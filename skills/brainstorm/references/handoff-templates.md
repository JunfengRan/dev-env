# 交接模板

## → write-idea-docs

```markdown
Brainstorm 结论摘要：
- 问题：…
- 推荐方案：…（相对 A/B 因 …）
- 约束：…
- 非目标：…
请升格为 docs/design/<topic>-architecture.md（或 -selection.md）。
```

## → deep-research brief

```json
{
  "reader": "…",
  "scope": "（来自 brainstorm 的问题边界）",
  "researchType": "selection_compare",
  "evidenceTargets": [
    { "targetId": "…", "repoPath": "…", "focusPaths": ["…"] }
  ],
  "notesFromBrainstorm": "推荐方案与待验证断言…"
}
```

写入 `.research/<run-id>/artifacts/research-brief.json` 后走正常 gate，**不要**为此新增 Spec state。

## → 实现

一句话交接：

> 已对齐：做 X，不做 Y；采用方案 B。开始按 plan / 直接改代码。
