# Lightweight Runtime Hardening Design

## Goal

在不引入数据库、工作流框架或新运行时依赖的前提下，修复 `dev-env` 审计发现的状态一致性、并发持久化、阶段续跑、门禁、插件分发和 CI 缺口。

## Scope

本次包含：

- 强化 reducer 的 gate、barrier、subagent 和 phase 事件不变量。
- 为研究运行目录增加跨进程协调、原子 JSON 写入和结构校验。
- 将 replay-chain 明确升级为可审计的阶段续跑记录。
- 修复中文深度门禁、run ID 路径穿越和依赖安全问题。
- 补齐 Cursor 多插件分发、跨平台 CI、Bun hook 验证及文档契约。

本次不包含：

- SQLite、Temporal、LangGraph 等持久化或工作流依赖。
- 完整缓存 LLM/工具输入输出的离线确定性回放。
- 改变现有研究阶段或增加新的 Spec 状态。
- 重写现有 Node CLI 或 gate 架构。

## Architecture

继续保留四个核心层：

1. `spec/research-workflow.yaml` 是工作流结构的唯一真相源。
2. `research-reducer.mjs` 是纯状态转换核心。
3. `research-cli.mjs` 负责文件系统适配、gate 执行和持久化。
4. plugin hooks 只触发 CLI 或通过共享持久化模块提交事件。

新增两个轻量基础模块：

- `scripts/run-persistence.mjs`：锁、原子写、事务式 run 更新。
- `scripts/run-integrity.mjs`：SHA-256、运行目录 Schema 校验、续跑记录验证。

这两个模块只使用 Node 标准库，不增加生产依赖。

## State Machine Invariants

Reducer 必须在任何入口都执行以下约束，而不是依赖 CLI 调用方正确：

- `GATE_PASSED` 和 `GATE_FAILED` 的 `event.gate` 必须等于当前 state 的 gate。
- terminal state 不接受 gate 或 subagent 事件。
- `parallel_subagents` 接受 `GATE_PASSED` 前，barrier 必须满足：
  - `expected > 0`
  - `completed === expected`
  - `pendingSubagents` 为空
- `SUBAGENT_COMPLETED` 的 ID 必须在 `pendingSubagents` 中。
- 重复或未知 subagent 完成事件返回明确错误，不改变 state。
- `PHASE_ENTER.state` 必须等于 `runState.currentState`。
- evidence target ID 必须非空且唯一。

`canTransition()` 不再是未使用的旁路判断；核心约束直接进入 `reduce()`，CLI 和插件无法绕过。

## Concurrency and Persistence

### Lock

每个 run 使用 `<run-dir>/.write-lock/` 作为跨进程锁。目录创建在 Windows、Linux 和 macOS 上均为原子操作。

- 获取失败时短间隔重试，达到超时后返回错误。
- 锁中记录 PID 和创建时间。
- 超过陈旧阈值且持有进程不可确认存活时可恢复。
- 所有 state、ContextPack、observation 和 replay-chain 的关联更新必须在同一锁内执行。
- `finally` 始终释放锁。

### Atomic JSON writes

JSON 写入流程：

1. 在目标文件同目录写入唯一临时文件。
2. 完成 flush/close。
3. rename 覆盖目标文件。
4. 失败时清理临时文件。

这样可以避免进程退出留下半个 JSON 文件。

### Event idempotency

Subagent 完成以 `subagentId` 为幂等键。Reducer 拒绝重复完成，持久化事务在写 observation 前先完成 reducer 校验，因此非法事件不会留下“已完成”观察记录。

## Auditable Phase Resume

`replay-chain.json` 仍保持简单 JSON 数组，但每个 entry 至少包含：

- `seq`
- `recordedAt`
- `phase`
- `nextPhase`
- `workflowId`
- `schemaVersion`
- `nodeVersion`
- `contextPackSnapshot`
- `contextPackSha256`
- `artifacts[]`，每项包含相对路径和 SHA-256
- `gate`
- `gateResult`

新增 `research verify [run-dir]`：

- 校验 `run-meta.json`、`state.json`、`context-pack.json`、`observations.jsonl` 和 `replay-chain.json` 的结构。
- 校验 replay `seq` 连续且唯一。
- 校验 snapshot 和 artifact 引用不能逃出 run 目录。
- 校验引用文件存在且 SHA-256 一致。
- 校验 state 当前阶段存在于 Spec。
- 发现漂移或损坏时以非零状态退出并输出结构化错误。

此能力定义为“可审计阶段续跑”，不声称可以离线重放模型或工具调用。

## Input and Path Safety

- Run ID 必须符合 `{YYYY-MM-DD}-{slug}-{shortHash}`：
  - 日期为四位年、两位月、两位日。
  - slug 仅允许小写字母、数字和单连字符。
  - shortHash 允许 5–12 位小写字母或数字。
- 禁止绝对路径、`.`、`..`、路径分隔符和空值。
- replay 中的所有相对引用必须经 `resolve()` 后仍位于 run 目录内。
- CLI flag 缺少值时直接报错，不接受 `undefined`。

## Gate Semantics

`countWords()` 改为兼容中英文的内容量估算：

- 拉丁文本按 Unicode 字母/数字词组计数。
- CJK 统一表意、平假名、片假名和韩文按字符计数。
- `explore-min-depth` 使用明确的最小拉丁词数或最小 CJK 字符数，并继续要求至少三个二级标题。

Evidence gate 除字段结构外，还必须：

- 与 ContextPack 中的 evidence target 集合一一对应。
- 拒绝重复 target ID。
- 每个目标至少有一条有效 evidence row。
- 在 barrier 未完成时由 reducer 拒绝推进。

## Schemas

新增：

- `spec/run-meta.schema.json`
- `spec/run-state.schema.json`
- `spec/replay-chain.schema.json`

收紧现有 Schema 中关键对象的 `additionalProperties`，但保留 ContextPack 的可选层级扩展能力。Schema 校验同时进入：

- `npm run validate:research-spec`
- `research verify`
- 样例 research run 验证

## Dependency and Runtime Policy

- 更新 lockfile，使 `fast-uri >= 3.1.5`，`npm audit --audit-level=high` 必须通过。
- 删除 `.npmrc` 的 `puppeteer_skip_download`。
- 新增 `.puppeteerrc.cjs`，设置 `skipDownload: true`。
- `package.json` 声明：
  - Node `>=22 <27`
  - npm `>=10`
- 不新增运行时依赖。

## Cursor Plugin Distribution

- 新增根级 `.cursor-plugin/marketplace.json`，列出两个插件。
- 新增轻量 `scripts/validate-plugins.mjs`，参考 Cursor 官方模板校验：
  - marketplace 与 plugin name 一致。
  - manifest 引用路径存在且不能逃出插件目录。
  - skill/rule/agent frontmatter 必填字段存在。
  - hooks JSON 可解析，命令使用 `${CURSOR_PLUGIN_ROOT}`。
- 修正 continual-learning README，使输出契约统一为 `.cursor/rules/*.mdc`。

## CI

保留现有工作流名称，调整为：

- 核心验证矩阵：
  - `ubuntu-latest` + Node 22
  - `ubuntu-latest` + Node 26
  - `windows-latest` + Node 22
  - `windows-latest` + Node 26
- Bun hook fixture 至少在 Ubuntu 和 Windows 各运行一次。
- 执行 `npm ci`、完整 validate、插件校验和 high 级别 audit。
- GitHub Actions 使用完整 commit SHA，并保留版本注释。
- 显式设置最小 `permissions: contents: read`、合理 timeout 和 concurrency。
- 增加 Dependabot，更新 npm 和 github-actions。

## Tests

沿用当前无测试框架的 Node 脚本，遵循先失败、后实现：

- Reducer：
  - 错误 gate 被拒绝。
  - 未完成 barrier 不能通过。
  - 重复和未知 subagent 被拒绝。
  - phase enter 状态或 target ID 非法时被拒绝。
- Persistence：
  - 多进程同时提交不同 subagent 完成事件不会丢失。
  - 原子写失败不会损坏原文件。
  - 陈旧锁可恢复，活动锁超时。
- Integrity：
  - 完整 run 验证通过。
  - artifact、snapshot 修改后哈希验证失败。
  - 路径逃逸被拒绝。
  - replay seq 断裂被拒绝。
- Gates：
  - 英文样例保持通过。
  - 达标中文内容通过，过短中文失败。
  - evidence target 缺失、重复或多余时失败。
- Plugins：
  - 当前 marketplace 和 manifest 通过。
  - 缺失路径、名称不一致、非法相对路径 fixture 失败。
- CLI：
  - 非法 run ID 和缺值 flag 失败。
  - `research verify` 成功与漂移失败。

## Error Handling

- CLI 对用户输入错误输出单行结构化 JSON 到 stderr，并以 1 退出。
- 锁超时、Schema 失败和哈希漂移都包含文件路径与可执行修复提示。
- Hook 保持 fail-safe：无活动 run 时静默退出；有活动 run 且 gate 失败时发 follow-up；持久化错误不得被描述成普通 gate 不通过。

## Success Criteria

- 所有新增回归测试都先在旧实现上失败，并在修复后通过。
- 两个并发 subagent 完成事件最终得到 `completed === expected` 且 pending 为空。
- 任何错误 gate 或未完成 barrier 都无法通过 reducer、CLI 或 hook 推进。
- `npm run validate`、插件校验、Bun hook fixture 和 `npm audit --audit-level=high` 全部通过。
- Windows 与 Ubuntu、Node 22 与 26 均通过 CI 设计的本地可执行测试。
- 仓库仍只需要 Node；Bun 仅作为插件 hook 的已有前置条件。
