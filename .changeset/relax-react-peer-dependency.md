---
"react-realtime-hooks": minor
---

Relax the React peer dependency to `>=18.0.0 <20.0.0` so the package can be installed alongside React 18.x as well as React 19.x. The library does not depend on any React 19.2-only API at runtime; the previous `^19.2.0` range unnecessarily blocked installs on React 18, 19.0, and 19.1.

The CI quality gate now runs the full lint + typecheck + test + build matrix against React 18.3.1, 19.0.0, and 19.2.4, with matching `@types/react` and `@types/react-dom` versions to catch typing regressions on each major.
