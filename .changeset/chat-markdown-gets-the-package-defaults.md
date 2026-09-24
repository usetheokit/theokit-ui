---
"@theokit/ui": minor
---

A chat message's markdown renders through this package's own element defaults instead of bare tags.

`slideMarkdownComponents` shipped as the default of `<Slide components>` and was wired in exactly one
place — the slide primitive. It appeared nowhere on the chat path, where `<ChatMessageResponse>`
passed a map holding only `code` and `pre`. So every default this package wrote applied to the slide
surface and none to the chat surface, which is the markdown surface a scaffolded application actually
renders. A `![]()` in an assistant's reply became a bare `<img>` with no `loading="lazy"` and no
`decoding="async"`, fetched and decoded eagerly however far below the fold it sat, while tokens were
still streaming in.

This is a performance and accessibility fix, not a security one. `parseMarkdownToReact` sanitizes with
`allowDangerousHtml=false` and the schema strips `target`, so a markdown link on this path could never
open a new browsing context and no `window.opener` was ever exposed. The `rel="noopener noreferrer"`
an external link now carries is defence in depth, for the reason the slide default already records:
the sanitize baseline is safe and its extension point is not.

Consumers rendering `<ChatMessage>` or `<ChatMessageResponse>` see two added attributes on markdown
images and one on external markdown links. Nothing is removed and no prop changed, so the only code
that can notice is a test asserting on exact rendered markup.

The defaults are supplied at the chat surface rather than merged inside `parseMarkdownToReact`. The
parser keeps handing a caller's `components` map through untouched: merging underneath it would change
what the parser returns for a caller that passed no map at all, which is wider than the gap being
fixed, and it would give this package a third answer to merge-vs-replace beside `<Slide>`'s deliberate
replace. `<Slide>` is unchanged — a supplied map still replaces the defaults there rather than merging
with them.
