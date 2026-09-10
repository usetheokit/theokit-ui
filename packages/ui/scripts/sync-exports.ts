#!/usr/bin/env tsx
/**
 * Generate / validate `package.json#exports`.
 *
 * Strategy (T3.2 / HIGH-005):
 *
 * The package ships a single ESM barrel (`dist/index.js`). For consumer-
 * friendly subpath imports (`import { Button } from "@theokit/ui/button"`),
 * we emit one `./<name>` entry per exported component — each pointing at
 * the same barrel + canonical type declarations. Modern bundlers (Vite,
 * esbuild, Rollup, webpack 5, Bun) tree-shake `Button` from the barrel
 * regardless of which form the consumer used.
 *
 * Why this instead of per-component bundles: tsup `splitting: false`
 * produces one `dist/index.js`. To literally split into 99 dist files we
 * would need a 99-entry build, duplicating shared code (cn, types, Radix
 * runtime) into every chunk and inflating the tarball. The subpath
 * convenience and the per-file isolation are decoupled: subpath gives
 * consumers a clean import API, tree-shaking gives them a small bundle.
 * Both are now satisfied.
 *
 * Drift detection: `validateExportsMap` compares the rendered map against
 * the live `package.json#exports`. Run `pnpm sync:exports` whenever
 * `src/index.ts` adds or removes a component export.
 */
import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

interface PackageJson {
  exports?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ExportEntry {
  types?: string;
  import?: string;
}

const BASE_EXPORTS: Record<string, ExportEntry | string> = {
  ".": {
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
  },
  "./styles.css": "./dist/styles.css",
  "./styles-v3-legacy.css": "./dist/styles-v3-legacy.css",
  "./components.css": "./dist/components.css",
  "./tokens.css": "./dist/tokens.css",
  "./tokens-v4.css": "./dist/tokens-v4.css",
  "./preset.css": "./dist/preset.css",
  "./preset": "./dist/preset.css",
  "./fonts.css": "./dist/fonts.css",
  "./fonts-cdn.css": "./dist/fonts-cdn.css",
  // Slide theme stylesheets — shipped alongside the slide engine subpath.
  // See `wiki/rfcs/0002-slide.md` T3.2.
  "./slide/themes/default.css": "./dist/slide/themes/default.css",
  "./slide/themes/violet-forge.css": "./dist/slide/themes/violet-forge.css",
  // Metadata, not an entry point — a plain string, and the only entry here whose target
  // is not under `dist/`. Without it Node answers ERR_PACKAGE_PATH_NOT_EXPORTED to
  // `require('@theokit/ui/package.json')`, which bundlers, test-runner resolvers and
  // version telemetry all read. Reproduced against a packed tarball before it was added.
  "./package.json": "./package.json",
};

/**
 * Subpath entries that point to their OWN bundle, not the shared barrel.
 *
 * Reserved for "engines" (Whiteboard, future Slide / SlideDeck / Diagram) —
 * heavy components with optional peer-deps that must not inflate the main
 * bundle. See `wiki/rfcs/0001-whiteboard.md`
 * ADR D3 and the roadmap section of `CLAUDE.md`.
 *
 * Invariant: keys here MUST NOT collide with any auto-scanned component
 * subpath (which come from `src/index.ts`). `buildExports` enforces this.
 */
const ISOLATED_SUBPATHS: Record<string, ExportEntry> = {
  "./whiteboard": {
    types: "./dist/components/primitives/whiteboard/index.d.ts",
    import: "./dist/whiteboard/index.js",
  },
  "./slide": {
    types: "./dist/components/primitives/slide/index.d.ts",
    import: "./dist/slide/index.js",
  },
  // Slide rich-content plugins (Tier 2 of the rich-content plan). Each plugin
  // is its own sub-subpath; the main `./slide` bundle never vendors shiki /
  // katex / mermaid. Consumers opt-in by installing the peer-dep + importing
  // the plugin explicitly (ADRs D1 / D14 of slide-rich-content-plan).
  "./slide/plugins/shiki": {
    types: "./dist/components/primitives/slide/plugins/shiki/index.d.ts",
    import: "./dist/slide/plugins/shiki/index.js",
  },
  "./slide/plugins/math": {
    types: "./dist/components/primitives/slide/plugins/math/index.d.ts",
    import: "./dist/slide/plugins/math/index.js",
  },
  "./slide/plugins/mermaid": {
    types: "./dist/components/primitives/slide/plugins/mermaid/index.d.ts",
    import: "./dist/slide/plugins/mermaid/index.js",
  },
  "./slide/plugins/emoji": {
    types: "./dist/components/primitives/slide/plugins/emoji/index.d.ts",
    import: "./dist/slide/plugins/emoji/index.js",
  },
  "./slide-deck": {
    types: "./dist/components/composites/slide-deck/index.d.ts",
    import: "./dist/slide-deck/index.js",
  },
  // RFC 0008 — TheoKit zero-config integration subpaths. `./vite-plugin`
  // ships its own isolated bundle (vite / tailwindcss kept external).
  "./vite-plugin": {
    types: "./dist/vite-plugin.d.ts",
    import: "./dist/vite-plugin.js",
  },
  // RFC 0008 follow-up — Tailwind v4 dropped JS presets, so the v3-shaped
  // JS preset stays available under `./preset-v3-legacy`. New v4 consumers
  // should use `@theokit/ui/preset.css` declared in BASE_EXPORTS above.
  "./preset-v3-legacy": {
    types: "./dist/preset-v3-legacy.d.ts",
    import: "./dist/preset-v3-legacy.js",
  },
  // M5-4 — pure sdk-tools result→props adapters. Lives in src/lib/ (utility,
  // not a component), so it is an isolated subpath, not auto-scanned. Imports
  // nothing from @theokit/sdk-tools at runtime.
  "./sdk-tools-adapters": {
    types: "./dist/lib/sdk-tools-adapters/index.d.ts",
    import: "./dist/lib/sdk-tools-adapters/index.js",
  },
};

/**
 * Extract `./<name>` subpaths from `src/index.ts`. We expect lines like
 * `export { X } from "./components/<layer>/<name>/index.js";` — the
 * `<name>` segment becomes the subpath identifier.
 */
function extractComponentSubpaths(indexContent: string): string[] {
  const names = new Set<string>();
  const pattern = /from\s+["']\.\/components\/(?:primitives|composites)\/([^/]+)\/index\.js["']/g;
  let match: RegExpExecArray | null;
  match = pattern.exec(indexContent);
  while (match !== null) {
    if (match[1]) names.add(match[1]);
    match = pattern.exec(indexContent);
  }
  return Array.from(names).sort();
}

/**
 * Resolve a component slug to its layer (primitives vs composites) by
 * checking the source tree. Brief #4 (subpath tree-shaking plan) made
 * `package.json#exports` point at per-component dist files instead of
 * the barrel — to emit the correct path we need to know the layer.
 */
function resolveLayer(slug: string): "primitives" | "composites" | null {
  for (const layer of ["primitives", "composites"] as const) {
    try {
      const stat = statSync(join(ROOT, "src/components", layer, slug, "index.ts"));
      if (stat.isFile()) return layer;
    } catch {
      // try next layer
    }
  }
  return null;
}

function buildExports(componentSubpaths: string[]): Record<string, ExportEntry | string> {
  const map: Record<string, ExportEntry | string> = { ...BASE_EXPORTS };
  for (const name of componentSubpaths) {
    const key = `./${name}`;
    // Guard against silent overrides: if a component named the same as an
    // isolated engine slipped into `src/index.ts`, fail loud here so we
    // discover the regression instead of shipping a broken bundle.
    if (key in ISOLATED_SUBPATHS) {
      throw new Error(
        `sync-exports collision: auto-scanned subpath "${key}" conflicts with an ISOLATED_SUBPATHS entry. Engines (Whiteboard, etc.) must stay out of the barrel — remove the export from src/index.ts.`,
      );
    }
    const layer = resolveLayer(name);
    if (layer === null) {
      // Symbol exported from the barrel that has no `src/components/<layer>/<name>/`
      // folder — falls back to the barrel (themes, helpers, types-only
      // exports like `Attachment`, `Message`, etc.). These stay barrel-mapped.
      map[key] = {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      };
      continue;
    }
    // Per-component subpath. JS is the isolated tsup bundle; `.d.ts` is the
    // per-subpath declaration emitted by `tsc -p tsconfig.dts.json`, which
    // mirrors `src/` under `dist/components/` (community-standard-
    // componentization T3.1). tsup's rollup-plugin-dts OOMs at 130+ entries,
    // so declaration emit is delegated to tsc (which scales). The path is
    // deterministic from layer+name so this builder produces identical output
    // with or without a build present — the structural validator relies on that.
    map[key] = {
      types: `./dist/components/${layer}/${name}/index.d.ts`,
      import: `./dist/${layer}/${name}/index.js`,
    };
  }
  for (const [key, entry] of Object.entries(ISOLATED_SUBPATHS)) {
    map[key] = entry;
  }
  return map;
}

async function main(): Promise<void> {
  const pkgPath = join(ROOT, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as PackageJson;
  const indexContent = await readFile(join(ROOT, "src/index.ts"), "utf-8");
  const subpaths = extractComponentSubpaths(indexContent);
  const exports = buildExports(subpaths);
  pkg.exports = exports;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  // Re-format via biome so the json layout matches the format:check gate
  // (biome inlines short arrays like `sideEffects` and `onlyBuiltDependencies`,
  // while raw `JSON.stringify(_, _, 2)` always expands them).
  try {
    execSync("pnpm exec biome format --write package.json", {
      cwd: ROOT,
      stdio: "ignore",
    });
  } catch {
    // best-effort: if biome isn't on PATH the structural validator still passes
  }
  process.stdout.write(
    `Synced package.json#exports: ${Object.keys(exports).length} entries (${subpaths.length} component subpaths + ${Object.keys(BASE_EXPORTS).length} base entries + ${Object.keys(ISOLATED_SUBPATHS).length} isolated engines)\n`,
  );
}

export { BASE_EXPORTS, ISOLATED_SUBPATHS, buildExports, extractComponentSubpaths };

// Only run main when invoked as the entrypoint (CLI). Importers
// (validateExportsMap) get the pure functions without side effects.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
