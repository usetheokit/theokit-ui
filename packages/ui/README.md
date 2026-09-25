<div align="center">

<!-- Absolute raw.githubusercontent URL on purpose: this README IS the npm package
     README, and npmjs.com does not resolve repository-relative image paths. -->
<img src="https://raw.githubusercontent.com/usetheokit/theokit-ui/main/assets/banner.svg" alt="@theokit/ui — React components for AI-agent surfaces" width="840" />

**`@theokit/ui`** · the **Build** (UI) auxiliary of the [Theo ecosystem](https://usetheo.dev)

# The UI your agent already needs.

A React component library built for AI-agent surfaces — coding agents and chat. **103 components** designed for what you'd otherwise build from scratch. The visual surface verb of **Chat. Build. Deploy.**

*Editorial typography. Three runtime-swappable themes. shadcn-compatible registry. Apache-2.0.*

<!-- BEGIN:counts -->
[![license](https://img.shields.io/badge/license-Apache--2.0-7C3AED?style=flat-square)](./LICENSE)
[![react](https://img.shields.io/badge/react-18+-7C3AED?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![tests](https://img.shields.io/badge/tests-1744%20passing-success?style=flat-square)](#quality-gates)
[![components](https://img.shields.io/badge/components-103-7C3AED?style=flat-square)](#component-catalog)
[![shadcn](https://img.shields.io/badge/shadcn-compatible-000?style=flat-square)](https://ui.shadcn.com/docs/registry)
<!-- END:counts -->

[Quickstart](#quickstart) · [Components](#component-catalog) · [Themes](#themes) · [Design System](./wiki/design-system/index.md) · [Quality Gates](./wiki/quality-gates/index.md) · [Contributing](./CONTRIBUTING.md) · [Security](./SECURITY.md)

</div>

---

## The shift

There is a version of your product where the agent UI is half-built before you start.

The chat thread, the tool calls, the streaming assistant message, the model selector, the cost meter, the context window indicator, the audit log row, the permission modal, the build log stream — all rendered. All themed. All accessible. You write product logic. The interface ships with you.

## Why `@theokit/ui`

Most component libraries optimize for marketing pages. `@theokit/ui` is built for the surfaces that AI agents actually need — surfaces where transparency, density of information, and developer trust matter more than hero sections.

- **Built for AI agents.** Primitives for skills, cron jobs, permission matrices, MCP servers, memory editing, hook config, audit logs, model cards, token usage charts, sub-agent dispatch — the components a transparent agent UI actually needs.
- **Built on `@usetheo/ui`.** Generic primitives, auth surfaces, and cloud-ops composites (project cards, deployment rows, env var editors, domain config, preview environments, rollback flows, metrics panels) live in [`@usetheo/ui`](https://github.com/usetheodev/usetheo-ui) — the community-standard layer `@theokit/ui` builds on. Need those too? Install `@usetheo/ui` alongside.
- **Themeable at runtime.** Eleven themes out of the box, swapped live via `<ThemeProvider />` — or define your own with `defineTheme()`.
- **shadcn-compatible registry.** Copy individual components into your project (`npx shadcn add …`) or install the whole package — your call.
- **shadcn v4 conventions.** Every component emits `data-slot` (and `data-variant`/`data-size` where it varies) so you target and override styles by attribute, not Tailwind class order. The `"use client"` directive is preserved in the build, so client components are safe to import into a React Server Component tree when installed from npm.
- **Per-subpath types.** `import { AgentEvent } from "@theokit/ui/agent-event"` resolves an isolated `AgentEvent` declaration, not the whole barrel's type surface.
- **Standard React + Tailwind package.** React is the only required peer (18 or 19); Radix UI, CVA, cmdk, and lucide ship as dependencies. Pairs with TheoKit, or runs standalone in any React app.

The agent UI gap is real — most teams reach for shadcn for the primitives and build the agent-specific parts from scratch, losing weeks before shipping a real surface.

| Surface need | `@theokit/ui` | shadcn / Radix | Tremor | Build it yourself |
|---|---|---|---|---|
| Generic primitives (buttons, tables, dialogs) | **Via `@usetheo/ui`** (same Radix foundation) | Yes | Limited | Slow |
| Agent-specific primitives (`AgentEvent`, `ToolCall`, `MCPServerCard`) | **Yes** | None | None | Weeks |
| cloud-ops composites (deploy, rollback, env vars) | **Via `@usetheo/ui`** (`BuildLogStream` ships here) | None | None | Weeks |
| Three runtime-swappable themes | **Built-in** | DIY | DIY | DIY |
| shadcn-compatible registry | **Yes** | Original | No | N/A |
| ESM-only, tree-shake via barrel | **Yes** | Yes | Yes | DIY |
| a11y enforced as a quality gate | **Yes** — axe over every story, plus a gate-enforced floor of 30 interactive primitives | Per-component, manual | Manual | Often skipped |

Same Radix UI underneath as shadcn — no philosophy fight. We just shipped the next 103 components you were about to write.

## What you'd build

- **Coding assistant interface.** Chat thread, streaming assistant, tool-call timeline, file diff viewer, permission matrix, sub-agent dispatch.
- **Agent dashboard.** Run stats, session timeline, MCP server admin, cron job scheduler, memory editor, audit log, model card, cost meter.
- **Internal AI tools.** Quick-action chips, intent selector, system-prompt editor, skill manager, rule editor, lane board.
- **Coding-agent onboarding.** Folder selector, recent folders list, project switcher, build log stream.

> Need generic primitives, auth surfaces, or the full cloud-ops dashboard (deployment rows, env var editors, domain config, preview environments, rollback flows, metrics panels)? Those moved to [`@usetheo/ui`](https://github.com/usetheodev/usetheo-ui) — `@theokit/ui` builds on it.

---

## How it works

Below this line, full technical vocabulary is in play. Installation, themes, the component catalog, design system, quality gates.

## Quickstart

### Option A — install the package

```bash
pnpm add @theokit/ui
```

```css
/* app entrypoint */
@import "@theokit/ui/tokens.css";
@import "@theokit/ui/styles.css";
```

```tsx
import { ThemeProvider, builtinThemes, AgentEvent, ToolCall } from "@theokit/ui";

export default function App() {
  return (
    <ThemeProvider themes={builtinThemes} defaultTheme="violet-forge" defaultMode="dark">
      <AgentEvent kind="thinking" text="Reading repository structure..." />
      <ToolCall name="readFile" status="completed" />
    </ThemeProvider>
  );
}
```

### Option B — copy individual components (shadcn-style)

```bash
npx shadcn@latest add https://usetheokit.github.io/theokit-ui/r/agent-event.json
npx shadcn@latest add https://usetheokit.github.io/theokit-ui/r/tool-call.json
```

> Branded `https://ui.usetheo.dev/r/*` URL will follow once the DNS CNAME is configured (single record at the registrar). Both URLs serve identical content.

Every item under [`registry/r/`](./registry/r) is a standalone copy-paste unit with its dependencies declared.

**Precondition.** Copy-paste install requires `@/` configured as a path alias in your `tsconfig.json` (`{ "paths": { "@/*": ["./src/*"] } }`) — the shadcn-ui 2.0 convention. Inlined source uses `@/lib/cn` and similar `@/components/ui/...` imports. If your project uses a different alias (Vite default `~/`, etc.), either add the `@/` mapping or rewrite the imports after copy-paste. The shipped `registry/index.json` declares this requirement under `metadata.requires.tsconfigPathAlias`.

### SSR / Server Components

Inject `<ThemeScript>` in `<head>` to prevent FOUC and hydration mismatch. Give it the same
props as the provider — the two resolve the mode separately, and a disagreement repaints the
page at hydration, which is the flash you were preventing:

```tsx
import { ThemeProvider, ThemeScript, builtinThemes } from "@theokit/ui";

<html lang="en" suppressHydrationWarning>
  <head>
    <ThemeScript defaultTheme="violet-forge" defaultMode="dark" />
  </head>
  <body>
    <ThemeProvider themes={builtinThemes} defaultTheme="violet-forge" defaultMode="dark">
      {children}
    </ThemeProvider>
  </body>
</html>
```

### Option C — point your AI assistant at `llms.txt`

For AI coding assistants (Claude Code, Cursor, Codex), [`llms.txt`](./llms.txt) is the factual ground truth of the library — package name, import paths, component inventory, the taxonomy rule, locked conventions and anti-patterns. It ships inside the npm tarball, so an assistant working in a consumer project can read it from `node_modules/@theokit/ui/llms.txt`. Deeper normative knowledge (design system, ADRs, RFCs, quality gates) lives in [`wiki/`](./wiki/index.md).

---

## Component catalog

<!-- BEGIN:component-catalog-intro -->
**103 components**, organized by mechanical rule: a *primitive* imports no other `@theokit/ui` component; a *composite* does.
<!-- END:component-catalog-intro -->

<details>
<summary>
<!-- BEGIN:primitives-count -->
**Primitives** (63) — building blocks
<!-- END:primitives-count -->
</summary>

<!-- BEGIN:primitives -->
`AgentErrorCard` · `AgentEvent` · `AgentHandoff` · `AgentProfile` · `AgentStartingState` · `AgentStreaming`
`ApprovalModeSelector` · `ArtifactPreview` · `AttachmentChip` · `AuditLogEntry` · `AutoCompactNotice` · `BranchIndicator`
`BrowserControls` · `BuildLogStream` · `CapabilityIndicator` · `ChannelCard` · `ChatThread` · `CodeReviewPanel`
`ContextCard` · `ContextWindowBar` · `CostMeter` · `CreatedFilesCard` · `CronJobCard` · `DiffViewer`
`ExportChatDialog` · `FolderContextCard` · `FolderSelector` · `GatewayStatusIndicator` · `HookConfig` · `HookEventLog`
`IntentSelector` · `LaneBoard` · `MCPServerCard` · `MemoryEditor` · `MentionMenu` · `ModelCard`
`ModelEffortPicker` · `ModelSelector` · `PermissionMatrix` · `ProgressChecklist` · `ProjectSwitcher` · `QuickActionChips`
`RecentFoldersList` · `RuleCard` · `RunStats` · `RunStatusPill` · `RunningTasksPanel` · `SessionListItem`
`SessionTimeline` · `SkillCard` · `StepsRail` · `SubAgentDispatch` · `SystemPromptEditor` · `TaskNode`
`TaskPlan` · `TerminalPanel` · `ThinkingLevelSelector` · `TokenUsageChart` · `ToolCall` · `ToolCallCard`
`ToolResult` · `ToolsList` · `WorkLog`
<!-- END:primitives -->

</details>

<details>
<summary>
<!-- BEGIN:composites-count -->
**Composites** (40) — assembled flows
<!-- END:composites-count -->
</summary>

<!-- BEGIN:composites -->
`AgentComposer` · `AgentEditor` · `AgentStream` · `AgentTimeline` · `AgentToolRenderer` · `ApprovalCard` · `ChatComposer` · `ChatMessage` · `ChatMessageAction` · `ChatMessageActions` · `ChatMessageBranch` · `ChatMessageBranchContent` · `ChatMessageBranchNext` · `ChatMessageBranchPage` · `ChatMessageBranchPrevious` · `ChatMessageBranchSelector` · `ChatMessageContent` · `ChatMessageResponse` · `ChatMessageRoot` · `ChatMessageToolbar` · `ChoicePrompt` · `ConfirmPrompt` · `CronJobsList` · `DataPart` · `FilePart` · `MCPServerList` · `MultiSelectPrompt` · `PermissionModal` · `PreviewPanel` · `ReasoningPart` · `RuleEditor` · `SkillEditor` · `SkillsList` · `SourceDocumentPart` · `SourceUrlPart` · `StabilityBundleViewer` · `TextPart` · `TextPrompt` · `ToolCallPart` · `UsageMeter`
<!-- END:composites -->

</details>

Browse them all in **Ladle**:

```bash
pnpm dev   # http://localhost:61000
```

There's also a playground app for full-page demos:

```bash
pnpm playground   # http://localhost:5180
```

---

## Themes

Eleven themes ship out of the box, all driven by the same token set. Swap at runtime with `<ThemeProvider />` + `<ThemeSwitcher />`; `builtinThemes` is the array of all of them.

| Theme | Vibe |
|---|---|
| `violet-forge` *(default)* | Editorial dark, AI workspace energy |
| `falcon-red` | Dark with a signal-red accent |
| `classic-paper` | Warm light, document-first reading |
| `aurora-terminal` | High-contrast dev terminal feel |
| `vercel-mono` | Monochrome, hairline borders |
| `github-dark` | Familiar code-host dark |
| `dracula` | The editor classic |
| `one-dark` | Atom's palette |
| `anthropic-style` | Warm neutrals, low chroma |
| `openai-style` | Clean greys, green accent |
| `linear-glass` | Translucent surfaces, cool blues |

```tsx
import { ThemeProvider, ThemeSwitcher, builtinThemes } from "@theokit/ui";

<ThemeProvider defaultTheme="violet-forge" themes={builtinThemes}>
  <ThemeSwitcher />
  {/* your app */}
</ThemeProvider>
```

### Your own theme

```ts
import { defineTheme } from "@theokit/ui";

export const mine = defineTheme({
  name: "mine",
  // `light` and `dark` are Partial<ColorScale> — omit what you don't change.
  dark: { background: "#131314", card: "#1e1f20", success: "#81c995" },
  fonts: { body: "Roboto, sans-serif", mono: "Roboto Mono, monospace" },
});
```

Pass it in `themes={[mine]}`. Components read the tokens, so changing `success` moves every status
pill, capability indicator and session dot with it — including the semantic and `status-*` families,
not just surfaces.

**Overriding a single token in your own CSS** also works: the palette ships inside `@layer theme`,
so both unlayered CSS and `@layer base` in your app win over it. (Before the fix for
[#72](https://github.com/usetheokit/theokit-ui/issues/72) the tokens were unlayered and silently
outranked anything a consumer wrote — a full `defineTheme` was the only way through.) Use
`defineTheme` for a palette, a CSS override for one value in one place.

Full spec: [`wiki/design-system/index.md`](./wiki/design-system/index.md).

---

## Design system: Violet Forge

| Token | Light | Dark |
|---|---|---|
| Primary (Theo violet) | `#A855F7` | `#A855F7` |
| Accent (burnt sienna) | `#C96442` | `#C96442` |
| Background | `#FFFFFF` pure white (Vercel-style) | `#0A0A0A` charcoal |
| Display font | **Geist Sans** | **Geist Sans** |
| Body font | **Geist Sans** | **Geist Sans** |
| Mono | **Geist Mono** | **Geist Mono** |

**Type scale (Vercel-inspired):** `64 / 48 / 40 / 32 / 28 / 24 / 20 / 18 / 15 / 14 / 12` px.

Full spec: [`wiki/design-system/index.md`](./wiki/design-system/index.md). Visual audit of competitors (Vercel, Railway, Render, Fly.io, Netlify, Coolify): [`wiki/history/competitor-design-audit-2026-05.md`](./wiki/history/competitor-design-audit-2026-05.md).

### Self-hosting fonts

By default `@theokit/ui/styles.css` `@import`s Geist + Geist Mono from `fonts.googleapis.com`. For GDPR-sensitive deployments or strict CSP environments, self-host instead:

1. Download Geist from [Vercel](https://vercel.com/font) (or the `geist` npm package).
2. Drop the assets into your `public/fonts/` folder.
3. In your app's global CSS, comment the `@theokit/ui/styles.css` `@import` rule for Google Fonts (or import `@theokit/ui/tokens.css` only) and add your own `@font-face` blocks for `Geist` and `Geist Mono`.

The CSS variables (`--font-body`, `--font-display`, `--font-mono`) are already wired to consume whichever `@font-face` rules are present — no component changes needed.

---

## Quality Gates

Every change is validated through a strict chain — no PR ships otherwise.

```bash
pnpm quality:gates
```

Runs in order: `format:check` → `lint:ci` → `typecheck` → `test` → `build` → `registry:build` → `registry:validate` → `quality:structure` → `quality:bundle` → `quality:a11y` → `ladle:build`.

The structural validator ([`scripts/validate-quality-gates.ts`](./scripts/validate-quality-gates.ts)) enforces taxonomy (primitive vs composite by import graph), registry/test/story presence per item (test gate is **hard-fail**), public-export surface, design-system fidelity (Geist fonts + Vercel type scale), governance files (LICENSE + CHANGELOG), README ↔ exports drift, docs typography drift, composite-via-barrel imports, compound-pattern uniformity (`Object.assign /*#__PURE__*/`), README/architecture census consistency, vitest-axe coverage on ≥30 interactive primitives, and zero stray `*.bak` / `*.json.tmp` artifacts in the working tree. Full spec: [`wiki/quality-gates/index.md`](./wiki/quality-gates/index.md).

---

## Development

```bash
pnpm install
pnpm dev               # Ladle component preview (http://localhost:61000)
pnpm playground        # Full-page demo app (http://localhost:5180)
pnpm test              # Vitest (vitest run)
pnpm test:watch        # Vitest watch mode
pnpm test:coverage     # Vitest with coverage report
pnpm typecheck         # tsc --noEmit
pnpm lint              # Biome check
pnpm lint:fix          # Biome check --write
pnpm build             # tsup → dist/
pnpm registry:build    # registry/*.json → registry/r/*.json
pnpm sync:readme       # Regenerate README counts + catalog from source
pnpm test:registry     # Fixture install test (registry copy-paste check)
pnpm quality:gates     # full chain
```

---

## Architecture

```
src/
  components/
    primitives/    atomic building blocks (no internal @theokit/ui deps)
    composites/    assembled flows (compose primitives via barrel imports)
  foundations/     Ladle stories for colors, typography, spacing, elevation, motion
  themes/          ThemeProvider, ThemeScript, ThemeSwitcher, 3 themes
  styles/          tokens.css, fonts.css, global.css
  lib/             cn, types
  test/            Vitest setup (with happy-dom polyfills)
.ladle/            Ladle config
registry/          shadcn-compatible registry descriptors (input)
  r/               built registry items (output of registry:build)
scripts/           build-registry, validate-registry, sync-readme, validate-quality-gates
wiki/              OKF knowledge bundle: architecture, design-system, quality-gates,
                   decisions, rfcs, engines, migrations, registry, history
tests/             fixture-shadcn-app/ (registry install integration test)
```

---

## Bundle & module format

- **ESM-only** — `@theokit/ui` ships a single `dist/index.js` (ESM) plus
  per-component `dist/components/.../index.d.ts` type declarations. No CJS
  build. Consumers running on CommonJS Node need to transpile or use a
  bundler. This is intentional: modern ESM-first React toolchains are the
  target.
- **Tree-shaking via the barrel** — modern bundlers (Vite, esbuild, Rollup,
  webpack 5, Bun) read the `sideEffects: ["**/*.css"]` hint and tree-shake
  unused components from the barrel import (`import { AgentEvent } from
  "@theokit/ui"` drops every other component from the final bundle). No
  per-component subpath exports are needed for this to work.
- **Subpath imports are aliases (not separate bundles).** `package.json#exports`
  publishes 99 component subpaths (`@theokit/ui/agent-event`, `@theokit/ui/tool-call`,
  …). Every subpath resolves to the same `dist/index.js`. tsup is configured with
  `splitting: false` deliberately — a 99-entry split would duplicate shared code
  (cn, types, Radix runtime) into every chunk and inflate the tarball. Subpath
  imports exist for IDE intellisense and import organization. Modern bundlers
  tree-shake the same way whether you write `import { AgentEvent } from "@theokit/ui"`
  or `import { AgentEvent } from "@theokit/ui/agent-event"`. Runtimes that don't tree-shake
  (Jest classic, Node REPL, raw browser ESM) will load the full barrel either way
  — accept that cost or pre-bundle with the consumer's tooling.
- **CSS distribution** — `dist/styles.css` is the recommended single import
  (combines tokens, fonts self-hosted, Tailwind base/components/utilities).
  `@theokit/ui/tokens.css`, `@theokit/ui/fonts.css`, and
  `@theokit/ui/fonts-cdn.css` (opt-in) are available for finer control.
- **Self-hosted fonts** — Geist Sans + Geist Mono ship as woff2 under
  `dist/fonts/` (~290 KB total). Opt into Google Fonts CDN with
  `@import "@theokit/ui/fonts-cdn.css"` instead of the default if you
  prefer not to host static assets.

---

## Status

Honest claims only.

<!-- BEGIN:production-stats -->
- **Production.** 103 components, 1744 tests passing, zero a11y violations across the axe sweep over every story, bundle size enforced. Quality gates run on every PR.
<!-- END:production-stats -->
- **Registry distribution.** Served at [`https://usetheokit.github.io/theokit-ui/r/`](https://usetheokit.github.io/theokit-ui/r/) (GitHub Pages, auto-deploy on every push to `main`). The branded `https://ui.usetheo.dev/r/` URL is a single DNS CNAME away — point `ui.usetheo.dev` at `usetheodev.github.io` and add it as a custom domain in Pages settings.
- **ESM-only.** Modern bundlers only. Consumers on CommonJS Node need to transpile or use a bundler.
- **Component count is the floor, not the ceiling.** New AI-agent surfaces ship through PRs; every addition runs the same quality gates.

## Engines (isolated subpaths)

Engines ship as bundle-isolated subpaths — they are NOT in the main barrel (`@theokit/ui`). Each one has its own dist file, its own optional peer-deps, and its own RFC.

```bash
# Whiteboard — view-only renderer for JSON in Excalidraw style.
pnpm add @theokit/ui roughjs perfect-freehand
```

```tsx
import { Whiteboard, type WhiteboardData } from "@theokit/ui/whiteboard";

const scene: WhiteboardData = {
  version: 1,
  width: 600,
  height: 400,
  elements: [
    { type: "rect", x: 50, y: 50, w: 120, h: 60, label: "User" },
    { type: "ellipse", x: 350, y: 50, w: 120, h: 60, label: "DB" },
    { type: "arrow", x: 170, y: 80, to: [350, 80], label: "query" },
  ],
};

<Whiteboard data={scene} fitOnLoad />
```

```bash
# Slide — view-only renderer for markdown + YAML frontmatter, Marp-inspired.
pnpm add @theokit/ui mdast-util-from-markdown mdast-util-gfm \
  micromark-extension-gfm mdast-util-to-hast hast-util-sanitize \
  hast-util-to-jsx-runtime yaml
```

```tsx
import { Slide } from "@theokit/ui/slide";
import "@theokit/ui/slide/themes/default.css";

const md = `---
theme: default
lang: en-US
---

# Pull Request #142

Adds rate limiting to the public API.

- Refill rate: 100 req/sec
- Burst capacity: 200 tokens`;

<Slide markdown={md} aspectRatio="16:9" />
```

Note: IDs generated from markdown headings are prefixed with `user-content-` by the default sanitize schema (`hast-util-sanitize` clobber protection). Consumers wanting raw anchors override via the `components` prop.

```bash
# SlideDeck — multi-slide deck w/ navigation, presenter, fullscreen, PDF.
pnpm add @theokit/ui mdast-util-from-markdown mdast-util-gfm \
  micromark-extension-gfm mdast-util-to-hast hast-util-sanitize \
  hast-util-to-jsx-runtime yaml
```

```tsx
import { SlideDeck } from "@theokit/ui/slide-deck";
import "@theokit/ui/slide/themes/default.css";

const deck = `# Welcome

A multi-slide deck.

<!-- notes: lembre da agenda -->

---

# Navigation

Use ← / → / Space, swipe on mobile, or click thumbnails.

---

# Done`;

<SlideDeck slides={deck} transition="fade" />
```

| Engine | Subpath | Status | RFC |
|---|---|---|---|
| Whiteboard (view-only, JSON → SVG, Excalidraw aesthetic) | `@theokit/ui/whiteboard` | Available | [RFC 0001](./wiki/rfcs/0001-whiteboard.md) |
| Slide (view-only, markdown → themed surface, Marp-inspired) | `@theokit/ui/slide` | Available | [RFC 0002](./wiki/rfcs/0002-slide.md) |
| SlideDeck (multi-slide deck w/ navigation + presenter + fullscreen + PDF) | `@theokit/ui/slide-deck` | Available | [RFC 0003](./wiki/rfcs/0003-slide-deck.md) |
| Diagram | TBD | Roadmap | TBD |

Each engine ships behind the same gate chain (test + story + a11y + registry + bundle isolation). No version commitment for the Roadmap items — these are not on the 0.1 / 1.0 line.

## Roadmap

The component count is the floor, not the ceiling. The next surfaces on the roadmap are creative and authoring tools — built in-house under the same quality gates, not third-party wrappers.

| Item | Type | Inspiration | Status |
|---|---|---|---|
| Slide engine | Primitive | Marp | Explorer (RFC) |
| Slide deck composite | Composite | Marp / Reveal.js | Explorer (RFC) |
| Diagram engine | Primitive | Mermaid | Explorer (RFC) |

Each engine is a multi-quarter effort and lands through an individual RFC. No version commitment yet — these are not on the 0.1 / 1.0 line. Each engine ships behind the same gate chain (test + story + a11y + registry + bundle). Names will be locked at RFC time, not before.

## License

[Apache-2.0](./LICENSE) © [usetheo.dev](https://usetheo.dev)

## Community

- Discord: https://discord.usetheo.dev/
- X: https://x.com/usetheodev
- LinkedIn: https://linkedin.com/company/usetheodev
