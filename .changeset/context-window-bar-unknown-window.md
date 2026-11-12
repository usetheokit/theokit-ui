---
"@theokit/ui": minor
---

`ContextWindowBar` now renders an "unknown" state (no percentage, neutral tone, no `aria-valuenow`) when `total` is 0 or not finite, instead of 100% or "NaN%". Its default `warnAt` is 0.75 to match `contextPressure`. New props: `pressure` (`"ok" | "warn" | "critical"`, overrides the thresholds) and `estimated` (prefixes the used count with "~").
