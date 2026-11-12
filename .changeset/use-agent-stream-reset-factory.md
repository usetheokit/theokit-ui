---
"@theokit/ui": patch
---

`useAgentStream` resets to an empty state when its source changes, and accepts a `() => AsyncIterable` factory so each mount opens its own iterator and survives React StrictMode's double mount.
