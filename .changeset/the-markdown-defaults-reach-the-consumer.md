---
'@theokit/ui': patch
---

the markdown element defaults are delivered to the consumer, by both the slide and the chat

`chat-message` imported the shared element-defaults map with a relative specifier that climbed out
of its own directory (`../../primitives/slide/markdown-components`). `registry:validate` refuses any
inlined import starting with `..`, because a component copied into a consumer's project has no such
path to climb — so `Static gates` was red, and `CI` with it.

Measuring the fix found the other half, which predates it: the **slide** artifact referenced that map
too and never shipped it. Its specifier was `./markdown-components`, which the validator allows
because it does not start with `..` — and the artifact carried 16 files, none of them the map. So a
consumer installing `slide` got a component importing a file that was not there.

Both descriptors now declare the map with the target `lib/markdown/element-defaults.tsx`, which puts
it in the build's rewrite table and in the copied file set. The artifacts carry 17 and 18 files, the
import resolves to `@/lib/markdown/element-defaults` on both paths, and `registry:validate` passes
for 100 items.
