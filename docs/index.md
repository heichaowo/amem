---
layout: home

hero:
  name: openclaw-amem
  text: Agentic Memory for OpenClaw
  tagline: Memories evolve, not just accumulate. Dynamic graph linking, hybrid retrieval, and LLM-driven evolution judgment. No Python required.
  image:
    src: /logo.webp
    alt: A-MEM Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/heichaowo/amem

features:
  - icon: 🔄
    title: Dynamic Memory Network
    details: Inspired by Zettelkasten. Memories are stored as nodes in a graph with automatic bidirectional link generation and LLM-verified connections — not flat vector rows.
  - icon: 🧬
    title: Memory Evolution & Consolidation
    details: Linked memories evolve context, tags, and embeddings when new details arrive. Same-day semantic duplicates (≥ 0.80 similarity) are auto-merged, and daily consolidation at 02:30 AM keeps the graph clean.
  - icon: 🚦
    title: LLM CRUD Gate & Quality Controls
    details: Hooked into agent_end to run NEW / UPDATE / DELETE / NONE decisions on every conversation. Write-time quality gate rejects low-quality content; memory_quality_scan identifies stale or conflicting entries.
  - icon: 🔍
    title: Hybrid Retrieval & Heat Tracking
    details: BM25 + dense vector hybrid (RRF) with 2-hop BFS graph expansion. Frequently retrieved memories get a logarithmic heat boost dampened by time decay, so fresh facts stay on top.
  - icon: 🧠
    title: Knowledge Classification & Topic Tags
    details: Notes are auto-classified as memory (episodic) or knowledge (durable). Knowledge notes carry topic tags and are excluded from consolidation merging and time-decay penalties.
  - icon: 🀄
    title: Chinese-Optimized BM25
    details: Uses Jieba (via @node-rs/jieba) for CJK word segmentation, dramatically improving recall for Chinese queries. English and mixed-language text fall back to whitespace tokenization automatically.
  - icon: 🔐
    title: Per-Agent Memory Isolation
    details: Each agent operates in its own private namespace. Memories written by main are invisible to dev by default. A shared scope (explicit agent_id="shared") lets the writing agent publish to all agents, with owner/readers/writers access fields on every note.
---
