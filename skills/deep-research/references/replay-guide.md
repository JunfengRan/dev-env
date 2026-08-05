# 可审计阶段续跑

## replay-chain.json

每条 entry 记录：

- 连续 `seq` 与 `recordedAt`
- `phase` / `nextPhase`
- workflow、Schema、Node 版本
- ContextPack snapshot 路径与 SHA-256
- run 内阶段 artifacts 路径与 SHA-256
- gate 与 gate result

成功 `advance` 会自动追加记录。运行：

```bash
node scripts/research-cli.mjs verify .research/<run-id>
```

可检查 Schema、引用路径、序号和内容漂移。

## 能力边界

这是可审计的 **phase resume**，不是完整确定性 replay。它不缓存 LLM
或工具输入输出，不能离线复现模型调用。

需要续跑失败 phase 时：

1. 先运行 `research verify`，确认现有记录未漂移。
2. 读取对应 entry 的 ContextPack snapshot。
3. 通过 reducer/CLI 恢复目标 state，不直接绕过 gate。
4. 重执行 phase；gate 通过后由 CLI 追加新 entry。

## 示例

`docs/examples/sample-research-run/replay-chain.json`
