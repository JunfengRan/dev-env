# Idea 文档深度检查清单

发表前逐项确认：

## 结构与 metadata

- [ ] 文首 metadata 含：文档类型、交叉链接、版本日期
- [ ] 文件名符合 `{topic}-architecture|tech-stack|workflow.md`
- [ ] 同主题 architecture ↔ tech-stack 双向链接

## 内容深度

- [ ] 「核心 Idea」3–5 条，非空泛 slogan
- [ ] 有 **方案取舍表** 或明确设计约束
- [ ] 术语表覆盖文档内非平凡专有词
- [ ] 模块/路径名与架构图节点一致
- [ ] 开放问题或演进路线（若适用）

## 图表

- [ ] Mermaid 遵守 `draw-mermaid-diagrams` 规则
- [ ] `npm run validate:mermaid` 通过
- [ ] 一图一条主链路，无过度拥挤

## 仓库 hygiene

- [ ] 新增主题已更新根目录 README.md 索引
- [ ] 无内部产品/保密信息泄露
- [ ] 外部链接可访问（GitHub / 文档 URL）
