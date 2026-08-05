# Lightweight Runtime Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不增加运行时依赖的前提下，修复研究状态机、并发持久化、阶段续跑完整性、中文门禁、插件分发和 CI 缺口。

**Architecture:** 保留 YAML Spec、纯 reducer、Node CLI 和 JSON run 目录。将状态不变量放入 reducer，将锁与原子写放入独立持久化模块，将哈希与结构验证放入独立完整性模块；CLI 与 plugin scripts 只通过这些边界更新运行状态。

**Tech Stack:** Node.js 22–26 ESM、Node 标准库、AJV 2020、YAML、Bun hooks、GitHub Actions。

## Global Constraints

- 不引入数据库、工作流框架或新的运行时依赖。
- 不缓存完整 LLM 或工具输入输出。
- 所有行为修复先写失败测试并确认失败，再写最小实现。
- 保持现有 CLI 命令兼容，仅新增 `research verify`。
- Windows 与 Ubuntu 均须可运行。
- 不创建 Git commit，除非用户另行明确要求。

---

### Task 1: Reducer 状态不变量

**Files:**
- Modify: `scripts/test-reducer.mjs`
- Modify: `scripts/research-reducer.mjs`

**Interfaces:**
- Consumes: `reduce(runState, event, spec)`
- Produces: reducer 对 gate、barrier、phase 和 subagent ID 的统一拒绝语义。

- [ ] **Step 1: 写错误 gate 和 barrier 绕过失败测试**

在 `scripts/test-reducer.mjs` 增加断言：

```js
result = reduce(runState, { type: "GATE_PASSED", gate: "wrong-gate" }, spec);
assert("wrong gate is rejected", result.error?.includes("does not match"));

const blocked = reduce(
  {
    ...runState,
    currentState: "verify",
    barrier: { expected: 2, completed: 1, pendingSubagents: ["t2"] },
  },
  { type: "GATE_PASSED", gate: "evidence-table-valid" },
  spec,
);
assert("incomplete barrier is rejected", blocked.error?.includes("barrier incomplete"));
```

- [ ] **Step 2: 写重复/未知 subagent 与非法 phase 失败测试**

覆盖：

```js
reduce(verifyState, { type: "SUBAGENT_COMPLETED", subagentId: "unknown" }, spec);
reduce(completedOnce, { type: "SUBAGENT_COMPLETED", subagentId: "t1" }, spec);
reduce(verifyState, { type: "PHASE_ENTER", state: "explore", evidenceTargets: [] }, spec);
reduce(verifyState, {
  type: "PHASE_ENTER",
  state: "verify",
  evidenceTargets: [{ targetId: "t1" }, { targetId: "t1" }],
}, spec);
```

- [ ] **Step 3: 运行并确认测试按预期失败**

Run: `npm run test:reducer`

Expected: 新增断言失败，分别显示错误 gate 被接受、barrier 被绕过、重复完成被计数。

- [ ] **Step 4: 在 reducer 内实现最小强约束**

新增并使用：

```js
function validateGateEvent(runState, spec, event) {
  const stateDef = getStateDef(spec, runState.currentState);
  if (event.gate !== stateDef?.gate) {
    return `Gate "${event.gate}" does not match state "${runState.currentState}" gate "${stateDef?.gate}"`;
  }
  if (
    event.type === "GATE_PASSED" &&
    stateDef.kind === "parallel_subagents" &&
    !isBarrierComplete(runState)
  ) {
    return `Cannot pass state "${runState.currentState}": barrier incomplete`;
  }
  return null;
}
```

`SUBAGENT_COMPLETED` 先检查 ID 是否仍 pending，再增加 completed；`PHASE_ENTER` 检查 state、非空唯一 ID。

- [ ] **Step 5: 运行 reducer 和完整测试**

Run: `npm run test:reducer && npm run validate`

Expected: 全部通过。

---

### Task 2: Run ID 和 CLI 参数安全

**Files:**
- Modify: `scripts/test-research-cli.mjs`
- Modify: `scripts/research-cli.mjs`

**Interfaces:**
- Produces: `validateRunId(runId)`；CLI flags 缺值时统一错误。

- [ ] **Step 1: 写非法 run ID 与缺失 flag 值测试**

测试以下命令失败且不创建目录：

```text
research-cli init ../../escape
research-cli init 2026-08-05-valid-abc12 --slug
research-cli status --run-id
```

- [ ] **Step 2: 运行测试并确认路径穿越用例失败**

Run: `npm run test:research-cli`

Expected: 旧实现接受非法值或产生非预期错误。

- [ ] **Step 3: 实现严格解析**

```js
const RUN_ID_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])-[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{5,12}$/;

function validateRunId(runId) {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(`invalid run id: ${runId}`);
  }
}
```

`parseArgs()` 对 `--slug`/`--run-id` 的下一个 token 缺失或仍以 `-` 开头时报错。

- [ ] **Step 4: 运行 CLI 测试**

Run: `npm run test:research-cli`

Expected: 全部通过。

---

### Task 3: 跨进程锁和原子写

**Files:**
- Create: `scripts/run-persistence.mjs`
- Create: `scripts/test-run-persistence.mjs`
- Modify: `plugins/deep-research-gates/scripts/after-subagent-complete.mjs`
- Modify: `scripts/research-cli.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `atomicWriteJson(path, value)`
  - `withRunLock(runDir, operation, options?)`
  - `updateRunState(runDir, updater)`

- [ ] **Step 1: 写原子写和锁超时失败测试**

测试：

```js
await withRunLock(runDir, async () => {
  const competing = spawn(process.execPath, [fixture, runDir]);
  assert((await waitForExit(competing)) !== 0);
}, { timeoutMs: 100 });
```

同时验证 `atomicWriteJson` 产生合法 JSON 且不遗留 `.tmp-*`。

- [ ] **Step 2: 写两个并行 subagent 完成进程测试**

创建 expected=2、pending=`["t1","t2"]` 的临时 run，同时启动两个 `after-subagent-complete.mjs`；最终断言：

```js
state.barrier.completed === 2
state.barrier.pendingSubagents.length === 0
observations.length === 2
```

- [ ] **Step 3: 运行并确认并发测试失败**

Run: `node scripts/test-run-persistence.mjs`

Expected: 旧实现出现 completed=1 或 pending 残留。

- [ ] **Step 4: 实现标准库持久化模块**

锁使用 `mkdir(<runDir>/.write-lock)`；锁元数据写入 `owner.json`。循环重试使用 `setTimeout` Promise。JSON 使用同目录临时文件和 `renameSync`。

```js
export async function withRunLock(runDir, operation, options = {}) {
  const release = await acquireRunLock(runDir, options);
  try {
    return await operation();
  } finally {
    release();
  }
}
```

- [ ] **Step 5: 修改 subagent 完成路径**

在锁内读取 state、执行 reducer、成功后依次原子写 state 并追加 observation。Reducer 错误时不写 observation。

- [ ] **Step 6: 将 CLI 的 state、ContextPack 和 replay 写入改为原子写**

所有 `writeJson()` 改用共享 `atomicWriteJson()`；`advance` 和 `apply` 的关联更新包在 `withRunLock()` 内。

- [ ] **Step 7: 加入测试脚本并验证**

`package.json` 增加：

```json
"test:persistence": "node scripts/test-run-persistence.mjs"
```

Run: `npm run test:persistence && npm run validate`

Expected: 全部通过。

---

### Task 4: 可审计阶段续跑和 Schema

**Files:**
- Create: `scripts/run-integrity.mjs`
- Create: `scripts/test-run-integrity.mjs`
- Create: `spec/run-meta.schema.json`
- Create: `spec/run-state.schema.json`
- Create: `spec/replay-chain.schema.json`
- Modify: `scripts/research-cli.mjs`
- Modify: `scripts/validate-research-spec.mjs`
- Modify: `scripts/test-research-cli.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `sha256File(path)`
  - `createReplayEntry(...)`
  - `verifyRun(runDir, spec)`
  - CLI `research verify [run-dir]`

- [ ] **Step 1: 写完整 run、哈希漂移、seq 断裂和路径逃逸测试**

基于临时 run 构造：

```js
const result = verifyRun(runDir, spec);
assert.equal(result.ok, true);
writeFileSync(artifact, "tampered");
assert.match(verifyRun(runDir, spec).errors.join("\n"), /sha256 mismatch/);
```

另测 `../outside.json` 和 seq `[1, 3]`。

- [ ] **Step 2: 运行并确认缺少完整性模块**

Run: `node scripts/test-run-integrity.mjs`

Expected: 模块不存在或所需导出不存在。

- [ ] **Step 3: 编写三个 JSON Schema**

Schema 使用 draft 2020-12，关键对象 `additionalProperties: false`；replay entry 按设计文档要求声明必填字段和 artifacts 数组。

- [ ] **Step 4: 实现哈希与安全路径解析**

```js
export function resolveInside(base, relative) {
  const root = resolve(base);
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error(`path escapes run directory: ${relative}`);
  }
  return target;
}
```

SHA-256 使用 `createHash("sha256")`。

- [ ] **Step 5: 生成增强 replay entry**

成功 advance 后记录 snapshot 哈希、全部 state outputs 的现存文件哈希、Node 版本、workflow/schema 版本和 next phase。

- [ ] **Step 6: 实现 `research verify`**

输出：

```json
{"ok":true,"runDir":"...","entries":3}
```

失败时 stderr 输出 `{"ok":false,"errors":[...]}` 并退出 1。

- [ ] **Step 7: 将 Schema 和样例 run 纳入 validate**

`validate-research-spec.mjs` 编译所有 Schema，并验证 `docs/examples/sample-research-run/`。

- [ ] **Step 8: 运行完整性、CLI 和完整测试**

Run: `npm run test:integrity && npm run test:research-cli && npm run validate`

Expected: 全部通过。

---

### Task 5: 中英文门禁和 evidence 完整性

**Files:**
- Modify: `scripts/gate-utils.mjs`
- Modify: `scripts/gates/explore-min-depth.mjs`
- Modify: `scripts/gates/evidence-table-valid.mjs`
- Modify: `scripts/test-gates.mjs`

**Interfaces:**
- Produces: `measureContent(text) => { latinWords, cjkChars }`

- [ ] **Step 1: 写中文达标/过短和 target 集合失败测试**

构造至少 3 个 `##` 标题和超过阈值的中文正文，期望通过；短中文期望失败。构造 ContextPack targets `t1,t2` 但 evidence 只有 `t1`，期望失败。

- [ ] **Step 2: 运行并确认中文与缺失 target 用例失败**

Run: `npm run test:gates`

Expected: 中文长文被旧 `countWords()` 计为少量词，缺失 target 被旧 evidence gate 接受。

- [ ] **Step 3: 实现 Unicode 内容量统计**

```js
export function measureContent(text) {
  return {
    latinWords: (text.match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((part) => !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(part))
      .length,
    cjkChars: (
      text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? []
    ).length,
  };
}
```

门禁满足 `latinWords >= 200 || cjkChars >= 400`。

- [ ] **Step 4: evidence gate 对齐 ContextPack targets**

读取 `L3_evidence_layer.evidenceTargets`；校验文件 targetId 集合无缺失、无多余、无重复，每个目标至少一条 row。

- [ ] **Step 5: 运行 gate 与完整测试**

Run: `npm run test:gates && npm run validate`

Expected: 全部通过。

---

### Task 6: 依赖与运行时配置

**Files:**
- Delete: `.npmrc`
- Create: `.puppeteerrc.cjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: 无 npm unknown config 警告；high audit 为零。

- [ ] **Step 1: 记录当前失败证据**

Run: `npm audit --audit-level=high`

Expected: `fast-uri 3.1.4` high 漏洞。

Run: `npm run validate`

Expected: 出现 `Unknown project config "puppeteer_skip_download"` 警告。

- [ ] **Step 2: 迁移 Puppeteer 配置**

`.puppeteerrc.cjs`：

```js
module.exports = {
  skipDownload: true,
};
```

删除 `.npmrc`。

- [ ] **Step 3: 声明运行时范围**

`package.json` 增加：

```json
"engines": {
  "node": ">=22 <27",
  "npm": ">=10"
}
```

- [ ] **Step 4: 更新漏洞依赖**

Run: `npm audit fix`

只接受将 `fast-uri` 更新到安全补丁；若有额外大版本变化则改用 `npm install --package-lock-only` 定向刷新。

- [ ] **Step 5: 验证无警告和漏洞**

Run: `npm ci && npm run validate && npm audit --audit-level=high`

Expected: 全部通过，无 unknown npm config 警告。

---

### Task 7: Cursor 插件分发与契约校验

**Files:**
- Create: `.cursor-plugin/marketplace.json`
- Create: `scripts/validate-plugins.mjs`
- Create: `scripts/test-plugins.mjs`
- Modify: `plugins/continual-learning-rules/README.md`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateMarketplace(root) => { errors, warnings }`

- [ ] **Step 1: 写 manifest 缺失、名称不一致和路径逃逸测试**

临时 fixture 分别包含：

```json
{"name":"wrong-name","source":"./plugins/valid"}
```

和 manifest 路径 `"skills": "../outside"`；断言 errors 包含对应原因。

- [ ] **Step 2: 运行并确认 validator 尚不存在**

Run: `node scripts/test-plugins.mjs`

Expected: 模块或导出不存在。

- [ ] **Step 3: 添加 marketplace manifest**

列出：

```json
{
  "name": "dev-env-plugins",
  "owner": {"name": "Junfeng Ran"},
  "metadata": {"description": "Lightweight Cursor agent workflow plugins", "version": "1.0.0"},
  "plugins": [
    {"name": "deep-research-gates", "source": "./plugins/deep-research-gates"},
    {"name": "continual-learning-rules", "source": "./plugins/continual-learning-rules"}
  ]
}
```

- [ ] **Step 4: 实现轻量官方模板等价校验**

校验 marketplace、plugin manifest、相对路径、frontmatter 与 hook 命令。导出 validator 供 fixture 测试，直接执行时打印结果并设置退出码。

- [ ] **Step 5: 修正文档**

将 continual-learning README 中所有 `AGENTS.md` 描述改为分类 `.cursor/rules/*.mdc`，安装说明与 marketplace 方式一致。

- [ ] **Step 6: 加入 validate 并运行**

`package.json` 增加 `validate:plugins` 和 `test:plugins`，并串入 `validate`。

Run: `npm run test:plugins && npm run validate:plugins && npm run validate`

Expected: 全部通过。

---

### Task 8: CI、安全自动更新与最终文档

**Files:**
- Modify: `.github/workflows/validate-research.yml`
- Modify: `.github/workflows/validate-mermaid.yml`
- Create: `.github/dependabot.yml`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `skills/deep-research/references/replay-guide.md`
- Modify: `spec/run-directory.md`
- Modify: `package.json`

**Interfaces:**
- Produces: 跨平台矩阵、安全固定 Actions、准确的阶段续跑文档。

- [ ] **Step 1: 更新核心 CI 矩阵**

配置：

```yaml
permissions:
  contents: read
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  research:
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [22, 26]
```

步骤执行 `npm ci`、`npm run validate`、`npm audit --audit-level=high`。

- [ ] **Step 2: 固定 Actions 完整 SHA**

通过 `gh api` 从官方仓库解析当前 release tag 对应 commit；写成：

```yaml
- uses: actions/checkout@<40-char-sha> # v4
- uses: actions/setup-node@<40-char-sha> # v4
```

- [ ] **Step 3: 增加 Bun hook smoke job**

在 Ubuntu/Windows 安装固定 Bun 版本，向两个 hook 输入 fixture JSON，断言进程正常退出且输出为合法 JSON 或空。

- [ ] **Step 4: 增加 Dependabot**

每周更新 npm 与 github-actions，限制同时打开 PR 数量。

- [ ] **Step 5: 更新运行时和续跑文档**

文档明确：

- `research verify`
- replay-chain 是可审计阶段续跑，不是完整 LLM 重放
- 新 Schema 与哈希字段
- marketplace 安装方式
- Node 22–26 与 Bun hook 前置条件

- [ ] **Step 6: 最终验证**

Run:

```text
npm ci
npm run validate
npm audit --audit-level=high
bun run plugins/deep-research-gates/hooks/before-phase-transition.ts < fixture
bun run plugins/continual-learning-rules/hooks/continual-learning-stop.ts < fixture
git diff --check
git status --short
```

Expected:

- 所有测试和校验通过。
- audit 为 0 high/critical。
- 无 npm unknown config 警告。
- hook 进程成功。
- diff 无空白错误。
- 仅出现本计划范围内的修改。
