---
"@theokit/ui": minor
---

`SlideDeck` accepts a `components` map and forwards it to every slide it renders.

`Slide` has accepted `components` — a map of markdown element renderers — as public API since the
primitive shipped. `SlideDeck` never declared it, so an application that renders a deck rather than
a single slide had no way to supply its own anchor or image renderer. The seam existed on the
primitive and was unreachable through the composite every consumer actually uses.

Nothing changes for a deck that passes nothing: the composite forwarded no value before, so the
primitive's default was already in force, and it still is. What becomes possible is overriding it.

The map reaches all five renderers a deck mounts — the slide on screen, both presenter previews,
each thumbnail and the hidden print container — so a supplied renderer cannot apply on screen while
the print output and the thumbnail rail quietly keep the defaults.

The prop is typed from the primitive rather than restated, so the two cannot drift apart: whatever
`Slide` accepts, a deck accepts.

As on the primitive, a supplied map REPLACES this package's defaults rather than merging with them.
A deck passing `{ a: MyLink }` also gives up the built-in `img` renderer and the `loading="lazy"`,
`decoding="async"` and `alt` normalisation it applies — and `components={{}}` gives up all of them
while supplying nothing. Pass a memoised map: a new object identity on every render re-parses every
slide.
