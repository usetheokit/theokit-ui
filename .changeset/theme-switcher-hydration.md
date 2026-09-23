---
"@theokit/ui": patch
---

`ThemeSwitcher` no longer triggers a React hydration mismatch.

Its screen-reader announcement rendered `mode` as a text node, and `ThemeProvider` resolves `mode`
from `localStorage` and `prefers-color-scheme` inside an effect. The server cannot know either, so
it rendered the default and the client frequently rendered something else — a mismatch by
construction, which React answers by discarding the server markup for that subtree (minified error
#418).

The announcement is now empty until the component has mounted, so the server and the client's first
render agree. Nothing a sighted user sees changed, and the announcement still fires on every
subsequent change.
