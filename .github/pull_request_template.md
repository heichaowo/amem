# Pull Request Template

## 1. Description & Intent
*What changes are made and why?*

## 2. Blast Radius Assessment
- [ ] **Low Blast Radius**: Cleanup, docs, lint fixes, or test enhancements.
- [ ] **Normal Blast Radius**: Incremental plugin features, new CLI helpers, or minor tool optimizations.
- [ ] **High Blast Radius**: Changes affecting database schemas, embedding generation, Qdrant connection logic, or backward compatibility.

## 3. Pre-Land Checklists
- [ ] **Compilation**: Code builds successfully without any errors (`pnpm -r build` exits with 0).
- [ ] **Modern Entrypoint**: Plugin entry point in `packages/openclaw-amem/src/index.ts` is wrapped in `definePluginEntry` and exported as `default`.
- [ ] **Manifest Declaration**: Any new tool registered via `api.registerTool` is declared under `contracts.tools` in `packages/openclaw-amem/openclaw.plugin.json`.
- [ ] **No Hardcoded Paths**: Removed all hardcoded absolute system paths. Paths are resolved dynamically (e.g. via `os.homedir()` or environment variables).
- [ ] **No Dead Code**: Cleared any unused imports, orphaned variables, and redundant code introduced by this PR.

## 4. Real Behavior Proof (RBP)
> ⚠️ **MANDATORY**: Please paste raw terminal logs, output traces, test commands, or database snapshots demonstrating that the changes work as intended under the current HEAD.

```bash
# Example terminal output showing your changes in action:
$ pnpm -r build
...
```
