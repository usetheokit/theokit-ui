---
"@theokit/ui": patch
---

`AgentComposer` opens the command menu only for a `/` at the start of the first line, until the first whitespace, and Enter submits whenever the open menu has no matching item. A message with a path like `/tmp/out` can be sent, and `run /c` is no longer replaced by `/clear`. `@` and `#` mentions still work mid-sentence.
