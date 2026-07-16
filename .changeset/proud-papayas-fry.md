---
---

No release needed. The plugin's per-agent scope resolution is extracted from
`index.ts` into a dependency-light `scope.ts` and covered by unit tests, with a
`test:unit` script so CI runs them. Pure refactor plus test infrastructure — the
tests are not shipped and the published output and behaviour are unchanged.
