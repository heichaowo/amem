# Introduction

**openclaw-amem** is an [OpenClaw](https://github.com/openclaw/openclaw) plugin that integrates the **A-MEM** (Agentic Memory) system — featuring dynamic memory networks, automatic link generation, memory evolution, and in-process consolidation, backed by Qdrant + local Transformers.js + LLM.

**No Python required.**

> This project is a production-ready OpenClaw plugin integration of the A-MEM system. For the original research implementation, see [agiresearch/A-MEM](https://github.com/agiresearch/A-MEM).

---

## What is A-MEM?

A-MEM is an advanced memory architecture for LLM agents inspired by the **Zettelkasten method**. Unlike traditional flat vector databases, A-MEM maintains memory as a living, self-evolving semantic graph.

### The 5-step lifecycle

1. **Note Construction** — On write, LLM extracts keywords, tags, a context summary, and categorizes the note (Technical, Business, Personal, Project, Research, System, General).

2. **Link Generation** — Retrieves top-6 candidates; LLM judges whether to link bidirectionally (similarity > 0.3).

3. **Memory Evolution & Strengthening** — Up to 3 linked memories have their attributes evolved based on the new context, potentially triggering additional links.

4. **Hybrid Retrieval** — Fuses vector search (local ONNX `multilingual-e5-small`, 384-dim) and BM25 using Reciprocal Rank Fusion (RRF), boosted by retrieval frequency (heat).

5. **2-hop BFS Graph Expansion** — After RRF top-K selection, BFS traverses the link graph up to 2 hops, appending up to 8 contextually linked notes. Each candidate passes an embedding relevance gate (cos-sim ≥ 0.25) before admission.

6. **Per-Agent Memory Isolation** — Each agent operates in its own private namespace (`agent_id` filter in Qdrant). Memories written by `main` are invisible to `dev` by default. A `shared` scope (explicit `agent_id="shared"`) allows publishing to all agents. See [Agent Isolation](/guide/agent-isolation) for full details.

---

## Architecture

```
OpenClaw Agent
     │
     ├── memory_search(query)  ──►  openclaw-amem plugin (TypeScript, in-process)
     └── memory_add(text)      ──►       │
                                         ▼
                          ┌──────────────┼──────────────┐
                          ▼              ▼               ▼
                       Qdrant     Transformers.js    LLM (Anthropic)
                    (vector store)  (ONNX embed)   (CRUD decision
                      :6333        384-dim local    + link judgment
                   agent_id ISO   + Jieba BM25     + evolution)
```

---

## Academic Background

Based on the paper: _A-MEM: Agentic Memory for LLM Agents_ — [arXiv:2502.12110](https://arxiv.org/abs/2502.12110) (NeurIPS 2025)

```bibtex
@inproceedings{xu2025amem,
  title={A-Mem: Agentic Memory for LLM Agents},
  author={Xu, Wujiang and Liang, Zujie and Mei, Kai and Gao, Hang and Tan, Juntao and Zhang, Yongfeng},
  booktitle={Advances in Neural Information Processing Systems (NeurIPS)},
  year={2025}
}
```
