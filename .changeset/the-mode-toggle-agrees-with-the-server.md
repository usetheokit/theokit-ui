---
'@theokit/ui': patch
---

the mode toggle's label and icon no longer disagree with the server

`ThemeSwitcher` reads `mode` in three places and only one of them was guarded. The `sr-only` live
region was fixed earlier; the toggle button's `aria-label` and the icon were not, and both diverge for
the same reason — the server has no `mode`, so it renders `defaultMode` while the client may render
something else.

The icon was the worse half. `<Moon>` and `<Sun>` are different components with different SVG
children, so the mismatch was structural: React discarded the server markup and rebuilt the whole
tree, which is the value of SSR thrown away on every page load.

Measured in a real browser against the published 1.12.0 — Chrome over CDP, a built scaffold, the
theokit repo's `scripts/probe-hydration.mjs`:

| | uncaught exceptions |
|---|---|
| 1.12.0 as published | 1 — React #418, `args[]=HTML` |
| with this change | **0** |

Guarded the same way the live region already is, rather than inventing a second pattern. That choice
has a property worth naming: `mounted` is false on the server AND on the client's first render, so the
two agree by construction and it does not matter what makes `mode` differ afterwards.

No layout shift — `size-9` is on the button, the placeholder is `size-4`. The button stays operable
while unmounted and carries a mode-neutral label until it knows which way it toggles.
