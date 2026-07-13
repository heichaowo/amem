---
"openclaw-amem": patch
---

Security: the `memory_quality_scan` tool now confines its output file to the
review directory instead of writing to any path it is handed. `generateReviewBatch`
previously used a caller-supplied `outputPath` verbatim, so a prompt-injected
agent could pass an absolute path or a `../` traversal and overwrite an arbitrary
file the process could write (CodeQL `js/path-injection`). Paths that escape the
root are now rejected before any filesystem access. The root defaults to the
current working directory; set `AMEM_REVIEW_DIR` to allow another location.
