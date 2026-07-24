# Project overlays（可选）

本目录用于说明如何为**具体目标仓库**叠加项目专有 Cursor rules。这些内容**不是** dev-env 默认安装的一部分。

适用对象：任意需要定制 Agent 行为的应用或 monorepo（例如 [OpenCode](https://github.com/sst/opencode)，或你自己的产品仓）。工作流本身与具体产品品牌无关。

## 用法

1. 在目标仓库维护 `.cursor/rules/*.mdc`（项目约定、本地端口、包名、测试命令等）
2. 需要时从本仓只复制通用 `rules/` / `skills/` / `agents/`，再叠加上目标仓自己的 rules
3. 不要把内部产品专有规则提交回本开源仓

示例：

```bash
# 通用工作流 → 目标项目
cp -r rules/ /path/to/your-app/.cursor/rules/
cp -r agents/ /path/to/your-app/.cursor/agents/

# 目标项目自有规则仍留在该仓库内维护
# /path/to/your-app/.cursor/rules/app-dev.mdc
```
