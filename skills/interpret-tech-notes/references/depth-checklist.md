# 深度自查清单

发表笔记前按类型与格式勾选。

## 通用（三类都要）

- [ ] 文件名：`YYYY-MM-DD-简短标题.md`（+ 可选同名 `.html`）
- [ ] 文首 metadata：来源、日期、读者定位
- [ ] 目录或索引，便于跳转
- [ ] 术语首次出现有简短定义
- [ ] 关键结论有出处（章节 / URL / 文件路径）
- [ ] 未读内容标「待验证」，无编造
- [ ] 已更新对应目录 `README.md` 索引行（链到 `.md`）

## 格式选型

- [ ] 论文/博客 → Markdown（未误用 HTML）
- [ ] 应用技术 ≥150 行或 ≥3 图 → 已考虑 HTML 或双文件
- [ ] 双文件时 `.md` 含完整版 HTML 链接与「为何用 HTML」一句

## 论文（Markdown）

- [ ] 说清 **核心问题** 与 **方法直觉**（非公式堆砌）
- [ ] 实验表：主结果 + 至少一个消融或局限
- [ ] 「与 Agent 关联」有可迁移工程思想
- [ ] 个人评价：价值分 + 是否值得精读

## 博客（Markdown）

- [ ] 有一句话核心主张
- [ ] 2–4 个论点，每条有 **论据 + 我的理解**
- [ ] 标明事实 vs 推断
- [ ] 可行动清单 ≥ 3 条
- [ ] 与仓库内已有笔记/论文有对照（若相关）

## 应用技术（Markdown 或 HTML，深挖标准相同）

### 结构

- [ ] 目录索引含 **关键文件** 列（或 HTML nav 等价）
- [ ] 有一句话心智模型
- [ ] 分阶段学习路径
- [ ] 附录：代码索引 + 阅读顺序/命令

### 技术深度

- [ ] **调用链** 从用户输入到持久化完整可追溯
- [ ] **核心循环** 层级表 + 序列/流程图（Mermaid 或 SVG）
- [ ] **Thread/Turn/Session/Event/Item** 概念边界（若项目存在）
- [ ] **上下文工程**：history vs 每轮重算、首轮 vs diff
- [ ] **Compaction / Memory / Token Budget**（若项目存在）
- [ ] **Prompt Cache** 影响表
- [ ] **Skills/MCP/Tool/Sandbox** 加载与治理
- [ ] **3–7 条关键设计决策**（含 why）
- [ ] **横向对比表**（突出差异）
- [ ] 至少 **2 张架构/流程图**

### 格式专项

**Markdown**

- [ ] Mermaid 已 `npm run validate:mermaid`（若含图）

**HTML**

- [ ] 自包含，无外部 CDN
- [ ] 明暗色 `prefers-color-scheme`
- [ ] sticky nav 锚点可跳转
- [ ] 附录 `<details>` 折叠（若较长）
- [ ] 每个 `<svg>` 有 `viewBox`、`xmlns`、`aria-label`；marker id 不重复
- [ ] `npm run validate:html-svg` 通过（新笔记默认扫 `frontier-apps/`）
- [ ] 浏览器打开目测通过

### 证据

- [ ] 关键路径在仓库中 Grep/Read 验证存在
- [ ] 集成测试若断言 request body，已写入并解释

## 质量红线（任一命中则返工）

- 只罗列目录结构，没有调用链
- 只翻译官方 slogan，没有代码/协议级细节
- 对比表只写「都支持 MCP」类空话
- 应用技术笔记没有代码文件索引
- 把 steer / interrupt / compaction 混为一谈未定义
- 长应用技术强行塞单文件 Markdown 导致不可读（应升 HTML）
- HTML 只有样式没有实质深挖内容
