/**
 * Markdown → React pipeline for chat messages.
 *
 *   parseMarkdownToReact(md, opts)
 *     ├─ preprocessStreaming(md, isStreaming)  → auto-close incomplete tokens
 *     ├─ parseBody(md)                         → mdast Root (micromark + GFM)
 *     ├─ mdastToHast(mdastTree)                → hast Root (allowDangerousHtml=false)
 *     ├─ sanitizeHast(hastTree)                → hast Root via hast-util-sanitize
 *     └─ hastToReact(hastTree)                 → React tree (jsx-runtime)
 *
 * Every transform lazily imports its peer-dep so the barrel never vendors the
 * markdown stack. Consumers that install the optional peer-deps (already
 * declared by the Slide engine) get rich rendering; consumers that don't get
 * a plain-text fallback via `parseMarkdownToReactSafe`.
 */
import type { Root as HastRoot } from "hast";
import type { Root as MdastRoot } from "mdast";
import { type ReactElement, createElement } from "react";
import { preprocessStreaming } from "./streaming-preprocess.js";

export interface ParseMarkdownOptions {
  /**
   * Override individual element renderers. The `components` map is passed
   * through to `hast-util-to-jsx-runtime` (e.g. `{ code: MyCodeBlock }`).
   */
  components?: Record<string, unknown>;
  /**
   * True while tokens are still arriving from the model. Enables the
   * streaming-safe preprocess pass. Default: `false`.
   */
  isStreaming?: boolean;
  /**
   * URL schemes kept on `href` and `src`. Relative URLs and `#` anchors are always kept.
   * Default: the sanitizer's own default lists.
   */
  allowedProtocols?: readonly string[];
}

export async function parseBody(body: string): Promise<MdastRoot> {
  const [{ fromMarkdown }, { gfmFromMarkdown }, { gfm }] = await Promise.all([
    import("mdast-util-from-markdown"),
    import("mdast-util-gfm"),
    import("micromark-extension-gfm"),
  ]);
  return fromMarkdown(body, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
}

export async function mdastToHast(tree: MdastRoot): Promise<HastRoot> {
  const { toHast } = await import("mdast-util-to-hast");
  const hast = toHast(tree, { allowDangerousHtml: false });
  if (!hast || hast.type !== "root") {
    return { type: "root", children: hast ? [hast] : [] } as HastRoot;
  }
  return hast as HastRoot;
}

export async function sanitizeHast(
  tree: HastRoot,
  allowedProtocols?: readonly string[],
): Promise<HastRoot> {
  const { sanitize, defaultSchema } = await import("hast-util-sanitize");
  // Allow class names on `pre`/`code` so syntax-highlight passes survive.
  // `defaultSchema.attributes` uses a wider union than hast-util-sanitize's
  // PropertyDefinition; cast to satisfy the parameter type while preserving
  // the same runtime shape `defaultSchema` already uses.
  const schema = {
    ...defaultSchema,
    attributes: {
      ...(defaultSchema.attributes ?? {}),
      code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-./]],
      pre: [...(defaultSchema.attributes?.pre ?? []), ["className", /./]],
      span: [...(defaultSchema.attributes?.span ?? []), ["className", /./], ["style"]],
    },
    ...(allowedProtocols
      ? {
          protocols: {
            ...(defaultSchema.protocols ?? {}),
            href: [...allowedProtocols],
            src: [...allowedProtocols],
          },
        }
      : {}),
  } as Parameters<typeof sanitize>[1];
  const safe = sanitize(tree, schema);
  return safe.type === "root"
    ? (safe as HastRoot)
    : ({ type: "root", children: [safe] } as HastRoot);
}

export async function hastToReact(
  tree: HastRoot,
  components?: Record<string, unknown>,
): Promise<ReactElement> {
  const { Fragment, jsx, jsxs } = await import("react/jsx-runtime");
  const { toJsxRuntime } = await import("hast-util-to-jsx-runtime");
  return toJsxRuntime(tree, {
    Fragment,
    jsx,
    jsxs,
    // `components` is `Record<string, unknown>` on our public surface and
    // `Partial<Components>` here. It cannot be typed as the latter: `hast-util-to-jsx-runtime`
    // is an OPTIONAL peer, so naming its types in our published API would make them a hard
    // requirement for every consumer, including the ones who never render markdown. Under
    // React 18's types the two were structurally compatible and this went unnoticed; React
    // 19 tightened the value union and they no longer are. The cast is the adapter at that
    // boundary — the runtime contract is unchanged, and toJsxRuntime validates what it gets.
    components: components as Parameters<typeof toJsxRuntime>[1]["components"],
  }) as ReactElement;
}

/**
 * Public entry point. Returns a Promise<ReactElement> ready to render inline.
 * If any peer-dep is missing at runtime, the function rejects — callers
 * should use `parseMarkdownToReactSafe` for a graceful fallback.
 */
export async function parseMarkdownToReact(
  markdown: string,
  opts: ParseMarkdownOptions = {},
): Promise<ReactElement> {
  const preprocessed = preprocessStreaming(markdown, opts.isStreaming ?? false);
  const mdast = await parseBody(preprocessed);
  const hast = await mdastToHast(mdast);
  const safe = await sanitizeHast(hast, opts.allowedProtocols);
  return hastToReact(safe, opts.components);
}

/**
 * Same as `parseMarkdownToReact` but returns a plain-text `<span>` fallback
 * if any peer-dep is missing (instead of rejecting). Used by `<ChatMessage>`
 * to keep the surface rendering when consumers opted out of the markdown
 * stack.
 */
export async function parseMarkdownToReactSafe(
  markdown: string,
  opts: ParseMarkdownOptions = {},
): Promise<ReactElement> {
  try {
    return await parseMarkdownToReact(markdown, opts);
  } catch {
    return createElement("span", { className: "whitespace-pre-wrap" }, markdown);
  }
}
