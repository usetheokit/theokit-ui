---
"@theokit/ui": patch
---

`useAgentStream` now streams text from the SDK's `"text-delta"` event (`"text_delta"` still works). When a run ends with `done` or `error`, tools still running are marked failed and later events are ignored.
