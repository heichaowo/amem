---
"openclaw-amem": patch
---

Security: the `memory_quality_scan` tool now treats its `outputPath` as a bare
filename written under the review directory, instead of a full path it writes
verbatim. `generateReviewBatch` previously used a caller-supplied `outputPath`
directly, so a prompt-injected agent could pass an absolute path or a `../`
traversal and overwrite an arbitrary file the process could write (CodeQL
`js/path-injection`). An `outputPath` that carries any directory component is
now rejected; a bare filename lands under `AMEM_REVIEW_DIR` (default: the
current working directory). Set `AMEM_REVIEW_DIR` to choose the directory.
