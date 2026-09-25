---
'@theokit/ui': patch
---

`theme-provider` and `token-usage-chart` now ship every file they import

A consumer running `shadcn add theme-provider` received seven files, one of which imported three
modules that were not in the payload and re-exported seventeen more. `token-usage-chart` shipped one
file importing a second. Both were broken on install and nothing said so.

Measured on this registry: **27 same-directory imports across 2 of 100 artifacts**, every one a
runtime import rather than `import type`. `theme-provider` goes from 7 files to 25 — the transitive
closure of what `themes/index.ts` actually needs, since that file is not a barrel: it defines
`builtinThemes`, which `theo-ui-provider` consumes.

`registry:validate` now refuses the state that allowed it. The two other relative shapes were
already covered and this one was covered by nobody: `..` is refused outright, and `@/…` resolves
through `registryNameFromTarget`, which then demands the owning item be in `registryDependencies`.
`./density` matched neither, so nothing asked whether the file was there at all.

The check accepts a path shipped by a **declared** `registryDependency` rather than only by the
artifact itself. That is not a loophole — the consumer installs that item too, so the file arrives —
and without it the check pushes an author toward declaring the same file in two artifacts, which is
worse than the gap it closes: two artifacts then write the same path on install. Found by making
exactly that mistake: satisfying the first version of the check duplicated `lib/cn.ts`, `lib/env.ts`
and `lib/safe-href.ts`, and the fix was to declare `safe-href` as a dependency instead.

Verified the check arms rather than merely passing: injecting `import … from "./a-file-nobody-ships"`
into a built artifact exits 1 and names the path; removing it exits 0.
