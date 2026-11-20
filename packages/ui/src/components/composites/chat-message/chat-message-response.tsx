"use client";

/**
 * `<ChatMessageResponse>` — markdown text renderer for a chat message body.
 *
 * Renders `<Markdown>` with React-friendly memoization. Re-renders
 * ONLY when `text` or `isStreaming` change, so streaming a long response
 * doesn't re-parse the entire conversation history per token.
 *
 * The renderer itself (code blocks, package `a`/`img` defaults) lives in
 * `../markdown/markdown.tsx`; this wrapper only adds the chat's slot attributes.
 */
import { memo } from "react";
import type { ReactElement } from "react";
import { Markdown } from "../markdown/markdown.js";

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

function ChatMessageResponseImpl({
  text,
  isStreaming = false,
  className,
}: ChatMessageResponseProps): ReactElement {
  return (
    <Markdown
      source={text}
      isStreaming={isStreaming}
      className={className}
      data-slot="chat-message-response-impl"
      data-theo-chat-response=""
    />
  );
}

export const ChatMessageResponse = memo(ChatMessageResponseImpl, (prev, next) => {
  return prev.text === next.text && prev.isStreaming === next.isStreaming;
});
ChatMessageResponse.displayName = "ChatMessageResponse";
