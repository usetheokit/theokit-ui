---
"@theokit/ui": minor
---

`Slide` renders markdown through this package's own components instead of bare tags.

`components` was already public API and nothing supplied a default, so every consumer that did not
pass one rendered a user's markdown as raw `<a>` and `<img>`: a link opening wherever its href
pointed, with no `rel`, and an image with no `alt` and no lazy loading. The default now passes every
href through `safeHref`, gives an external link `rel="noopener noreferrer"`, and gives an image an
empty `alt` rather than none when the markdown omitted it.

Passing `components` still replaces the default wholesale — it is a fallback, not a merge, so an
application that supplied its own map behaves exactly as before.
