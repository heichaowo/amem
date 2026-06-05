# Pull Request Template (A-MEM Code Audit)

## 1. Description & Intent (变更描述与意图)
*What changes are made and why?*
*(说明此 PR 作出了哪些修改以及背后的改动意图)*

## 2. Blast Radius Assessment (变更影响面评估)
- [ ] **Low Blast Radius**: Cleanup, docs, lint fixes, or test enhancements.
- [ ] **Normal Blast Radius**: Incremental plugin features, new CLI helpers, or minor tool optimizations.
- [ ] **High Blast Radius**: Changes affecting database schemas, embedding generation, Qdrant connection logic, or backward compatibility.

## 3. Pre-Land Checklists (合并前置自检)
- [ ] **Compilation**: Code builds successfully without any errors (`npm run build` exits with 0).
- [ ] **Modern Entrypoint**: Entry point in `src/index.ts` is wrapped in `definePluginEntry` and exported as `default`.
- [ ] **Manifest Declaration**: Any new tool registered via `api.registerTool` is declared under `contracts.tools` in `openclaw.plugin.json`.
- [ ] **No Hardcoded Paths**: Removed all hardcoded absolute system paths (e.g. `/Users/...`). Paths are resolved dynamically (e.g. via `os.homedir()`).
- [ ] **No Dead Code**: Cleared any unused imports, orphaned variables, and redundant code introduced by this PR.

## 4. Real Behavior Proof (RBP) (强制性真实行为证明)
> ⚠️ **MANDATORY**: Please paste raw terminal logs, output traces, test commands, or database snapshots demonstrating that the changes work as intended under the current HEAD.
> *(请在下方贴入命令执行结果、本地日志输出或运行截图以证明改动逻辑的正确性。未提供真实行为证明的 PR 将被标记为 Block 并拒绝合并)*

```bash
# Example terminal output showing your changes in action:
$ npm run consolidate
...
```
