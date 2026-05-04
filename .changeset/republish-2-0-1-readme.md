---
"react-realtime-hooks": patch
---

Republish to ship the README updates that landed after 2.0.0:

- Bundle size badge (bundlephobia min + gzip) and a static "dependencies:
  zero" badge in the badge row.
- "Migrating from 1.x" section linking to `MIGRATING.md`.
- Quick Start examples no longer set `reconnect: { maxAttempts: null }` —
  the new default of `10` is the recommended starting point.

No source, build, or test changes. The published artefact (`dist/`) is
byte-identical to 2.0.0 modulo the version field.
