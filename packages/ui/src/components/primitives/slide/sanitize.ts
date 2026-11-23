/**
 * Sanitize schema for slide body hast trees.
 *
 * ADR D8: `defaultSchema` from `hast-util-sanitize` is used WITHOUT extensions
 * in v0.1. The default schema:
 *   - Strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`,
 *     `<style>`, `<link>` and other dangerous tags.
 *   - Keeps `clobberPrefix: "user-content-"` so user-supplied IDs cannot
 *     clobber DOM lookups.
 *   - Allows the standard CommonMark + GFM safe subset (h1-h6, p, ul, ol, li,
 *     blockquote, code, pre, a[href], img[src/alt], table family, em, strong,
 *     del, br, hr, etc.).
 *
 * The allow-list only decides what an `a` / `img` MAY carry. The defaults that markdown links and
 * images get (`rel="noopener noreferrer"` on external links, lazy/async images) are applied at
 * render time by `markdown-components.tsx`, because the sanitizer cannot add attributes and a plugin
 * may widen it (e.g. allow `a[target]`). Keep the two in step.
 *
 * A `looseSlideSanitizeSchema` (with `figure`/`figcaption`) is an explicit
 * opt-in for v0.2 — gated by security review.
 */
import type { Element, Root } from "hast";
import type { MergedSanitizeExtensions } from "./plugin.js";

let cachedBuiltSchema: import("hast-util-sanitize").Schema | undefined;

/**
 * Tier 1 built-in extensions to the default sanitize schema. These cover the
 * tags emitted by built-in Slide features (alerts in `aside`, layout / header
 * / footer / paginate metadata attributes on the outer section wrapper). They
 * are NOT plugin-declared because they ship with the Slide primitive.
 *
 * Note: layout / header / footer / paginate are applied at the React component
 * level (outside the hast tree), so their attributes don't need sanitize rules.
 * Only `aside` (alerts) ends up in the hast.
 */
const TIER_1_TAG_NAMES: string[] = ["aside"];
const TIER_1_ATTRIBUTES: Record<string, string[]> = {
  aside: ["className", "data-theo-slide-alert-type"],
  "*": ["className"],
};

/**
 * Lazy accessor for the sanitize schema.
 *
 * Always merges `defaultSchema` with the Tier 1 baseline (aside + className).
 * When `extensions` is provided, plugin-declared tag names + attributes are
 * unioned on top (D17 / EC-3). Plugins NEVER bypass sanitize — they declare
 * what they need via `sanitizeSchemaExtension`.
 *
 * Implementation notes:
 *   - The baseline schema (default + Tier 1) is cached.
 *   - Plugin-merged schemas are NOT cached (depends on combination).
 */
export async function getSlideSanitizeSchema(
  extensions?: MergedSanitizeExtensions,
): Promise<import("hast-util-sanitize").Schema> {
  const baseline = await getBaselineSchema();
  if (
    !extensions ||
    (extensions.tagNames.length === 0 && Object.keys(extensions.attributes).length === 0)
  ) {
    return baseline;
  }
  return mergeSchema(baseline, extensions);
}

async function getBaselineSchema(): Promise<import("hast-util-sanitize").Schema> {
  if (cachedBuiltSchema) return cachedBuiltSchema;
  const { defaultSchema } = await import("hast-util-sanitize");
  cachedBuiltSchema = mergeSchema(defaultSchema, {
    tagNames: TIER_1_TAG_NAMES,
    attributes: TIER_1_ATTRIBUTES,
  });
  return cachedBuiltSchema;
}

function mergeSchema(
  base: import("hast-util-sanitize").Schema,
  extensions: MergedSanitizeExtensions,
): import("hast-util-sanitize").Schema {
  // Merge tag names (deduplicated set).
  const baseTagNames = (base.tagNames ?? []) as string[];
  const tagSet = new Set<string>(baseTagNames);
  for (const t of extensions.tagNames) tagSet.add(t);
  // Merge attributes per tag.
  const baseAttrs = (base.attributes ?? {}) as Record<string, unknown[]>;
  const mergedAttrs: Record<string, unknown[]> = { ...baseAttrs };
  for (const [tag, attrs] of Object.entries(extensions.attributes)) {
    const baseline = (mergedAttrs[tag] ?? []) as unknown[];
    const seen = new Set<string>();
    const combined: unknown[] = [];
    for (const a of baseline) {
      const key = typeof a === "string" ? a : JSON.stringify(a);
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(a);
      }
    }
    for (const a of attrs) {
      if (!seen.has(a)) {
        seen.add(a);
        combined.push(a);
      }
    }
    mergedAttrs[tag] = combined;
  }
  return {
    ...base,
    tagNames: Array.from(tagSet),
    attributes: mergedAttrs,
  } as import("hast-util-sanitize").Schema;
}

/** Count elements by tagName in a hast tree. Used for BANNED_TAG detection (ADR D13). */
export function collectTagCounts(tree: Root | Element): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (node: Root | Element | { type: string; children?: unknown[] }): void => {
    if (node.type === "element") {
      const tag = (node as Element).tagName;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    const children = (node as { children?: unknown[] }).children;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === "object" && "type" in child) {
          walk(child as Root | Element);
        }
      }
    }
  };
  walk(tree);
  return counts;
}
