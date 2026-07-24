# Plan + Critique  playbook（decide 阶段）

适用于 `decide` 状态写选型决策文档：

1. 用户确认 comparative-catalog.json 后再写 selection
2. 先列 Plan（章节大纲 + catalog 映射），**不修改 plan 文件本身**
3. 按 plan 执行 write-idea-docs
4. 用户 critique → 只改 artifacts/文档，不重开 run
5. gate `decision-doc-complete` 验证：前提、对比表、优先级

## Critique 常见项

- catalog 编号不连续 → 重编号
- 对比表空泛 → 补具体差异
- 缺 MVP 优先级 → 补 P0–P3 表
