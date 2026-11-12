---
"@theokit/ui": minor
---

`ContextWindowBar` no longer shows an unknown window (`total <= 0` or not finite) as 100% or "NaN%": it renders a neutral "unknown" state with no percentage and no `aria-valuenow`. The default `warnAt` is now 0.75 (was 0.7) to match `contextPressure` in `@theokit/agents`. New props: `pressure` (`"ok" | "warn" | "critical"`, wins over the thresholds) and `estimated` (renders the used count with a leading `~`).
