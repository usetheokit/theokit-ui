"use client";

/**
 * `<ChatMessageResponse>` — markdown text renderer for a chat message body.
 *
 * Wraps `parseMarkdownToReact` with React-friendly memoization. Re-renders
 * ONLY when `text` or `isStreaming` change, so streaming a long response
 * doesn't re-parse the entire conversation history per token.
 *
 * Internally swaps the default `<code>` element for `<CodeBlock>` (fenced)
 * or `<InlineCode>` (inline), per shadcn.io's AI code-block pattern, on top of
 * this package's own `a`/`img` defaults — see `MARKDOWN_COMPONENTS` below for
 * why they are spread here rather than merged inside the parser.
 *
 * Component override pattern is forked from `vercel/ai-elements`
 * `<MessageResponse>` (Apache-2.0, see NOTICE).
 */
import { memo, useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../../../lib/cn.js";
import { CodeBlock } from "../../../lib/markdown/code-block.js";
import { InlineCode } from "../../../lib/markdown/inline-code.js";
import { parseMarkdownToReactSafe } from "../../../lib/markdown/parser.js";
import { slideMarkdownComponents } from "../../primitives/slide/markdown-components.js";

export interface ChatMessageResponseProps {
  /** Raw markdown text from the model. */
  text: string;
  /**
   * True while tokens are still arriving. Enables the streaming-safe
   * preprocess pass (auto-closes incomplete `**bold`, fences, links, math).
   */
  isStreaming?: boolean;
  /** Extra className on the prose wrapper. */
  className?: string;
}

/**
 * Decide whether a hast `code` element is inline (single-backtick) or a
 * fenced block. Heuristic: presence of `language-X` className on `<code>`,
 * or being wrapped in `<pre>` (the runtime sees that as parent). We can't
 * see the parent here, so we use the className signal — fenced code from
 * mdast-util-from-markdown always carries `language-*`.
 */
function isFenced(props: Record<string, unknown>): boolean {
  const cls = props.className as unknown as string | string[] | undefined;
  if (typeof cls === "string") return cls.startsWith("language-");
  if (Array.isArray(cls))
    return cls.some((c) => typeof c === "string" && c.startsWith("language-"));
  return false;
}

function extractLanguage(props: Record<string, unknown>): string | undefined {
  const cls = props.className as unknown as string | string[] | undefined;
  const list = typeof cls === "string" ? [cls] : Array.isArray(cls) ? cls : [];
  for (const c of list) {
    if (typeof c === "string" && c.startsWith("language-")) {
      return c.slice("language-".length);
    }
  }
  return undefined;
}

function extractText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (
    children &&
    typeof children === "object" &&
    "props" in children &&
    (children as { props?: { children?: ReactNode } }).props
  ) {
    return extractText((children as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

const MARKDOWN_COMPONENTS: Record<string, unknown> = {
  // The package's element defaults FIRST, this surface's overrides after, so a key spelled here
  // wins. `slideMarkdownComponents` supplies `a` and `img`; `code`/`pre` below are the chat's own.
  //
  // ## Why the defaults are spread here and not merged inside `parser.ts`
  //
  // Both were measured before choosing. Merging in the parser resolves the class for every caller,
  // and the class has exactly ONE member: `parseMarkdownToReactSafe` is reachable from no published
  // subpath (106 explicit entries, no wildcard, none targeting `lib/markdown`) and this file is its
  // only caller in the tree — the slide runs its own `primitives/slide/parse.ts`. So the generality
  // buys nothing today, and it costs: a probe of that shape turned `parser.test.ts > renders links`
  // red, because that case asserts the parser's output for a caller passing NO map at all. Changing
  // what the parser does with an absent map is a wider change than this item measured, and it would
  // give the package a third answer to merge-vs-replace next to `slide.tsx`'s deliberate replace.
  //
  // Spreading here changes only the surface the item is about and leaves the parser's contract as
  // it is. If a second caller of the parser ever appears, that is when merging earns its ADR.
  //
  // The map is named for the slide because that is where it was written, not because its content is
  // slide-specific: it sets `loading`/`decoding` on an image and `rel` on an external anchor, which
  // every markdown surface in this package wants. Reused rather than copied — a second definition
  // would be two places to fix the next time a default changes.
  ...slideMarkdownComponents,
  code: (props: Record<string, unknown> & { children?: ReactNode }) => {
    if (isFenced(props)) {
      const language = extractLanguage(props);
      const code = extractText(props.children);
      return <CodeBlock code={code} language={language} />;
    }
    return <InlineCode {...props}>{props.children}</InlineCode>;
  },
  // Strip the default `<pre>` since `<CodeBlock>` ships its own wrapper.
  // Inline `<pre>` still works for raw whitespace-preserving text.
  pre: ({ children }: { children?: ReactNode }) => {
    return <>{children}</>;
  },
};

function ChatMessageResponseImpl({
  text,
  isStreaming = false,
  className,
}: ChatMessageResponseProps): ReactElement {
  const [tree, setTree] = useState<ReactElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    parseMarkdownToReactSafe(text, {
      isStreaming,
      components: MARKDOWN_COMPONENTS,
    }).then((next) => {
      if (!cancelled) setTree(next);
    });
    return () => {
      cancelled = true;
    };
  }, [text, isStreaming]);

  return (
    <div
      data-slot="chat-message-response-impl"
      className={cn(
        "prose-theo max-w-none text-body-md text-foreground leading-relaxed",
        // First/last child margin reset — fork from vercel/ai-elements
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        // Heading sizes inside chat use our typescale, not browser defaults
        "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:font-semibold [&_h1]:text-title-lg",
        "[&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-title-md",
        "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:font-semibold [&_h3]:text-body-lg",
        "[&_p]:my-2",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_blockquote]:my-2 [&_blockquote]:border-primary/40 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_a:hover]:text-primary-deep [&_a]:text-primary [&_a]:underline",
        "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left",
        "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5",
        "[&_hr]:my-4 [&_hr]:border-border",
        className,
      )}
      data-theo-chat-response=""
    >
      {tree}
    </div>
  );
}

export const ChatMessageResponse = memo(ChatMessageResponseImpl, (prev, next) => {
  return prev.text === next.text && prev.isStreaming === next.isStreaming;
});
ChatMessageResponse.displayName = "ChatMessageResponse";
