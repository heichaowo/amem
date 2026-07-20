---
'openclaw-amem': patch
---

Fix a false-positive "agent_end hook has never fired" warning. On an idle
gateway — restarted and left untouched for 10 minutes — the self-check logged
that the hook was likely blocked, even though no conversation had happened so
nothing should ever have fired it. The check now warns only after real activity
(a memory tool ran, i.e. a conversation occurred) with the hook still never
firing, which is the genuine "blocked by security policy" signal.
