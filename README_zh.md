# openclaw-amem

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![arXiv](https://img.shields.io/badge/arXiv-2502.12110-b31b1b.svg)](https://arxiv.org/abs/2502.12110)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin-blue)](https://github.com/openclaw/openclaw)

**[OpenClaw](https://github.com/openclaw/openclaw) 的 A-MEM 主动记忆后端**

基于 [A-MEM](https://arxiv.org/abs/2502.12110) 论文的 OpenClaw 集成实现 — 动态记忆系统，支持自动**关联生成**和**记忆演化**，底层使用 ChromaDB + SentenceTransformer + LLM。

> **注意：** 本项目是 A-MEM 系统的 OpenClaw 集成实现。原版研究代码和论文复现请参考 [agiresearch/A-MEM](https://github.com/agiresearch/A-MEM)。

---

## 核心特性 ✨

- 🔄 **动态记忆组织** — 基于 Zettelkasten 方法
- 🔗 **自动关联生成** — 新记忆通过 embedding 相似度 + LLM 判断与历史记忆建立双向链接
- 🧬 **记忆演化** — 新记忆加入后，关联旧记忆自动更新 context、tags 和 embedding
- 🔍 **混合检索** — BM25 + 向量搜索 + RRF 融合
- 🤖 **OpenClaw 原生** — 注册为 `memory_search` / `memory_add` 工具，支持 `plugins.slots.memory`
- 🏠 **本地优先** — ChromaDB + SentenceTransformer，无需外部向量数据库

---

## A-MEM 是什么？

A-MEM 是一种受 Zettelkasten 方法启发的 LLM agent 记忆系统。与普通向量库不同，A-MEM 将记忆视为持续自组织的网络：

1. **笔记构建** — 写入时 LLM 自动生成关键词、标签和上下文摘要
2. **关联生成** — 相似度 > 0.3 的候选条目经 LLM 判断，有意义的建立双向链接
3. **记忆演化** — 最多 3 条关联旧记忆的 context/tags/embedding 被同步更新
4. **混合检索** — BM25 + 向量搜索通过 RRF 融合，提升召回鲁棒性

论文：_A-MEM: Agentic Memory for LLM Agents_ — [arXiv:2502.12110](https://arxiv.org/abs/2502.12110)

---

## 架构

```
OpenClaw Agent
     │
     ├── memory_search(query)  ──►  amem-plugin（OpenClaw 插件）
     └── memory_add(text)      ──►       │
                                         ▼
                                  amem_client.py
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              ▼               ▼
                      ChromaDB    SentenceTransformer   LLM (Anthropic)
                    （向量存储）     （embedding）      （笔记构建
                                                      + 关联判断
                                                      + 记忆演化）
```

---

## 环境要求

- Python 3.10+
- conda（推荐 miniforge）
- Anthropic API key（或兼容代理）

---

## 安装

### 1. 创建 conda 环境

```bash
conda create -n amem python=3.10 -y
conda activate amem
pip install anthropic chromadb sentence-transformers rank-bm25
```

### 2. 放置 `amem_client.py`

```bash
mkdir -p ~/.amem
cp amem_client.py ~/.amem/
```

### 3. 配置环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ANTHROPIC_API_KEY` | *必填* | Anthropic API key |
| `ANTHROPIC_BASE_URL` | *官方 API* | 自定义 base URL（如本地代理） |
| `AMEM_LLM_MODEL` | `claude-opus-4-5` | 笔记构建和关联判断用的模型 |
| `AMEM_DB_PATH` | `~/.amem/db/` | ChromaDB 存储路径 |

### 4. 测试

```bash
conda activate amem
python ~/.amem/amem_client.py add "这是我的第一条记忆。"
python ~/.amem/amem_client.py search "第一条记忆"
python ~/.amem/amem_client.py list
```

`add` 预期输出：
```
[add] Constructing note...
  keywords: ['第一条记忆', ...]
  tags: ['general']
  context: 第一条记忆内容摘要。
  saved note xxxxxxxx-...
[done] Note added: xxxxxxxx-...
```

---

## OpenClaw 插件安装

### 1. 复制插件

```bash
cp -r amem-plugin ~/.openclaw/extensions/
```

### 2. 配置 `~/.openclaw/openclaw.json`

```json
{
  "plugins": {
    "allow": ["amem-plugin"],
    "entries": {
      "amem-plugin": {
        "enabled": true,
        "config": {
          "amemScript": "/Users/你的用户名/.amem/amem_client.py",
          "condaEnv": "amem",
          "condaBase": "/opt/homebrew/Caskroom/miniforge/base",
          "userId": "your-username",
          "anthropicApiKey": "sk-ant-...",
          "dbPath": "/Users/你的用户名/.amem/db/"
        }
      }
    },
    "slots": {
      "memory": "amem-plugin"
    }
  }
}
```

### 3. 重启 OpenClaw

```bash
openclaw gateway restart
```

### 插件配置说明

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `amemScript` | `~/.amem/amem_client.py` | amem_client.py 的路径 |
| `condaEnv` | `amem` | conda 环境名 |
| `condaBase` | 自动检测 | conda 根目录 |
| `userId` | `default` | 记忆的用户命名空间 |
| `anthropicApiKey` | `$ANTHROPIC_API_KEY` | API key 覆盖 |
| `anthropicBaseUrl` | `$ANTHROPIC_BASE_URL` | base URL 覆盖 |
| `llmModel` | `$AMEM_LLM_MODEL` | 模型覆盖 |
| `dbPath` | `$AMEM_DB_PATH` | DB 路径覆盖 |

---

## 使用

安装后 agent 获得两个工具：

### `memory_search`
混合检索（BM25 + 向量 + RRF）搜索长期记忆。

```
memory_search(query="MetaSmith 项目状态", limit=5)
```

### `memory_add`
写入新记忆，自动触发关联生成和记忆演化。

```
memory_add(text="决定使用 ChromaDB 作为向量存储，原因是本地优先。")
```

---

## 记忆演化原理 🧬

写入新记忆时：

1. **笔记构建** — LLM 生成关键词、标签、上下文摘要
2. **Embedding** — SentenceTransformer 对富化后的笔记编码
3. **关联生成** — 相似度 > 0.3 的候选条目经 LLM 判断，有意义的建立双向链接
4. **记忆演化** — 最多 3 条关联旧记忆的 context/tags/embedding 被同步更新

这是 A-MEM 论文的核心贡献：记忆不是静态条目，而是持续自组织的网络。

---

## 致谢

本项目实现了以下论文提出的 A-MEM 架构：

> Wujiang Xu et al. _A-MEM: Agentic Memory for LLM Agents_. arXiv:2502.12110, 2025.

原版研究仓库：[agiresearch/A-MEM](https://github.com/agiresearch/A-MEM)

---

## License

MIT
