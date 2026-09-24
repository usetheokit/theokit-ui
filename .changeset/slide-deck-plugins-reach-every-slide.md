---
"@theokit/ui": patch
---

`SlideDeck` now relays `plugins` to the thumbnails and the presenter view, not just to the main
viewport.

`plugins` was already public API and already carried on `DeckContext`, and both its docblocks
promised it reached "every inner `<Slide>`". Three of the five inner renderers never received it:
the thumbnail strip and both presenter previews read the context without it. A plugin that is
absent does not degrade to unstyled output — it degrades to raw source, because the sanitizer
strips tags no plugin declared. So a deck using the math or mermaid plugin showed the presenter a
literal `$$…$$` while the audience saw the rendered form, and rendered every thumbnail as a block
of code-fence text instead of the shape the slide actually has.

Passing no `plugins` behaves exactly as before, and a deck that passed them already rendered the
main viewport correctly — what changes is that the other three renderers now agree with it.
