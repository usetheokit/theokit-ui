---
'@theokit/ui': patch
---

a `<Slide>` inside a deck cannot be rendered without the deck's relay

`SlideDeck` gained a `components` seam (B-286) and already had `plugins` (B-288), and both were
relayed by writing the same four props at every render site. Five sites carried the same block, and
duplication was the mild half: the real cost is that a SIXTH site added later inherits nothing — it
renders a `<Slide>` that silently drops the deck's overrides, which is the defect both items were
filed to fix.

`<DeckSlide>` reads the relay from context, so a caller says which markdown and which label and
cannot say "without the deck's overrides" — that is not a decision a site inside a deck is allowed to
make. Four of the five sites now go through it.

The fifth is `PrintContainer`, and it stays as it was: its own comment states that it is drilled
rather than context-read and never calls `useDeckContext()`. Converting it would have thrown.
