# HTML 内嵌 SVG 图表规范

应用技术笔记（`frontier-apps/*.html`、`company-blogs/*.html`）中的架构图、隔间图、对照流程图，优先用**自包含内嵌 SVG**，不依赖 Mermaid CI。

## 必守结构

每个 `<svg>` 必须包含：

```html
<svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="简短中文描述">
```

- `viewBox` 固定宽高，CSS 用 `width:100%; height:auto` 缩放
- `aria-label` 一句话说明图意（验证脚本强制）
- 同一 HTML 内多个 `<svg>` 的 `<marker id="...">` **必须带前缀**（如 `arr-s4`），避免 `url(#arr)` 冲突

## 布局原则（避免「排布不正确」）

### 1. 分层优先于横挤

| 关系 | 推荐布局 | 避免 |
|------|----------|------|
| 继承 / 分叉（baseline → 多频道） | **自上而下树形**：顶层居中 → 水平分叉线 → 垂直到子节点 | 所有节点挤在一行 + 单点 fan-out 斜线 |
| 流水线（A→B→C→D） | 同行等宽列 + **垂直连线**到下一层同列子节点 | 顶层第 2 列连到底层第 1 列 |
| 并列对比（Identity / Memory / Context） | 等宽三列 + 列间水平箭头 + 底部一句结论 | 文字溢出 viewBox、行高不足 |

### 2. 尺寸与留白

- 带多行文字的 `<rect>`：高度 ≥ 56px（双行标题）或 ≥ 72px（三行说明）
- 同级 `<rect>` 水平间距 ≥ 20px，避免验证器报 overlap
- 结论 / caption 放在独立底栏 `<rect>`，不要漂在图外
- `font-size` ≥ 10（正文）、标题 12–13；禁止 8px 微字

### 3. 连线

- 树形分叉：先 **竖线到汇合高度**，再 **横线**，再 **各自垂线**到子节点（T 型分叉）
- 列对齐：父节点中心 x = 子节点中心 x
- 跨层关系用 `stroke-dasharray="4"` 虚线区分「实现细节」与「主路径」

### 4. 配色（本仓库 HTML 笔记）

- 主路径 / 平台：`#3370ff` / `#eef3ff`
- 正向 / public：`#16a34a` / `#f0fdf4`
- 风险 / private：`#dc2626` / `#fef2f2`
- 中性组件：`#888` 描边、`#fff` 填充
- 工具层底栏：`#f4f4f5`

## CSS（`.svg-wrap`）

```css
.svg-wrap { overflow-x: auto; margin: 1.5rem 0; }
.svg-wrap svg { width: 100%; max-width: 100%; height: auto; display: block; }
svg text { font-family: system-ui, sans-serif; }
```

## 验证（发表前必跑）

```bash
# 默认：仅 frontier-apps（新应用技术笔记）
npm run validate:html-svg

# 指定文件
npm run validate:html-svg -- frontier-apps/xxx.html

# 含 company-blogs 历史 HTML
npm run validate:html-svg -- --all
```

脚本 [`scripts/validate-html-svg.mjs`](../../../scripts/validate-html-svg.mjs) 检查：

| 检查项 | 说明 |
|--------|------|
| xmlns / role / aria-label | 结构必备 |
| viewBox 边界 | rect / text / line 不得溢出 |
| 同行 rect 重叠 | 水平挤在一起 |
| fan-out 启发式 | ≥3 条线共享同一起点 → 改树形分叉 |
| 文字落点 | 标签应落在最近 rect 内 |
| marker id 重复 | 同文件内 id 冲突 |

验证通过后，浏览器打开目测一次（暗色模式、窄屏）。

## 参考范例

- 树形隔间图：见 Learning 仓 `frontier-apps/` 示例笔记 §4 Claude Tag（本仓不附带完整笔记）
- 分层架构图：同文件 §1 飞书 Agent 架构
- 三列对比图：同文件 §5 Identity / Memory / Context
