# Smoke Test Results

Internal regression test suite (`amem-smoketest`) — 31 QA pairs across 8 categories, evaluated with `gemini-3.5-flash-low` as write-side LLM.

> Smoke test is a **regression test**, not a benchmark. The dataset is self-authored and scores are not directly comparable across implementations. The purpose is to verify retrieval quality does not degrade between versions.

---

## Overall results (v0.3.0)

| Metric | Value |
| :--- | :--- |
| **Average Score** | **4.56 / 5.0** |
| **Hit\@1** | **64.0%** |
| **Hit\@3** | **76.0%** |
| **MRR** | **0.693** |

## Results by category

| Category | Avg Score | Notes |
| :--- | :--- | :--- |
| fact | 5.00 / 5.0 | — |
| temporal | 5.00 / 5.0 | — |
| bfs | 5.00 / 5.0 | — |
| multihop | 4.20 / 5.0 | — |
| semantic | 3.60 / 5.0 | Active improvement area |

## BFS ablation

The 2-hop BFS graph expansion is tested in isolation using bfs + multihop categories (10 questions):

| | BFS OFF | BFS ON | Delta |
|:---|:---:|:---:|:---:|
| **Average Score** | 3.00 | 5.00 | **+2.00** |
| bfs category | 2.00 | 5.00 | **+3.00** |
| multihop category | 4.00 | 5.00 | **+1.00** |

BFS provides the largest single improvement of any feature in the retrieval pipeline.

## Category descriptions

| Category | What it tests |
|----------|--------------|
| **fact** | Direct factual recall (e.g. account IDs, registration numbers) |
| **temporal** | Time-ordered facts where older versions should be superseded |
| **bfs** | Multi-note graph traversal — answer requires following link edges |
| **multihop** | Two independent facts that must be joined to answer (e.g. company → registrar → contact email) |
| **semantic** | Paraphrased queries that don't share keywords with stored content |

## Running the smoke test

```bash
cd amem-smoketest
node run_smoketest.mjs
```

By default the smoke test uses `gemini-3.5-flash-low` for write-side LLM operations and `gemini-pro-agent` as judge. Override with:

```bash
AMEM_LLM_MODEL=claude-sonnet-4-6 node run_smoketest.mjs
```
