# Replay 与续跑

## replay-chain.json

每条 entry：`seq`, `phase`, `contextPackSnapshot`, `artifact`, `gate`, `gateResult`

## 回放语义

```text
context-pack@vN + prompt + model → artifact
```

MVP：人工从 `snapshots/context-pack@vN.json` 恢复上下文，重跑单 phase。

## 续跑失败 phase

1. 将 `state.json` currentState 设回目标 phase
2. 从 replay-chain 对应 entry 读 snapshot
3. 复制 snapshot 到 `context-pack.json` head
4. 重执行该 phase 指令，gate 通过后 append 新 replay entry

## 示例

`docs/examples/sample-research-run/replay-chain.json`
