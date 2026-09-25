import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UIMessage } from "../../../types/chat.js";
import { ChatMessage } from "./chat-message.js";

/**
 * The chat path gets the same markdown element defaults the slide path gets.
 *
 * ## What was measured, and why this file exists
 *
 * `slideMarkdownComponents` is wired in exactly ONE place — `slide.tsx`, as the default of the
 * `Slide` prop — and appeared ZERO times anywhere on the chat path. `<ChatMessageResponse>` passed
 * a map of `{ code, pre }` only, and `parser.ts` hands `opts.components` straight to
 * `hastToReact` without merging anything under it. So every default this package wrote was applied
 * to the surface a scaffolded app does not render, and none to the surface it does: the scaffold's
 * markdown surface IS the chat.
 *
 * ## Severity, stated honestly — this is NOT a security test
 *
 * `parser.ts` runs `sanitizeHast` with `allowDangerousHtml=false`, so a dangerous protocol is
 * filtered and `target` is stripped before any renderer sees the node. A markdown link on this path
 * cannot open a new browsing context, so there is no `window.opener` to leak and nothing here was
 * exploitable. What was missing is `loading`/`decoding` on an image — a performance and layout
 * concern — and `rel` on an external anchor, which is defence in depth for the same reason
 * `markdown-components.tsx` records: the sanitize baseline is safe and its extension point is not.
 *
 * Read a failure here as "the chat path stopped receiving the package's defaults", never as
 * "a vulnerability appeared".
 */

function assistantSaying(markdown: string): UIMessage {
  return { id: "1", role: "assistant", parts: [{ type: "text", text: markdown }] };
}

describe("a chat message's markdown carries this package's element defaults", () => {
  it("test_a_markdown_image_in_a_chat_message_is_lazy_and_decodes_async", async () => {
    const { container } = render(
      <ChatMessage message={assistantSaying("![a red square](https://x.test/a.png)")} />,
    );

    // `getByRole("img")` cannot be used as the probe: the accessible role of an `<img>` depends on
    // its `alt`, so the query would couple this assertion to the alt normalisation next door.
    const img = await waitFor(() => {
      const found = container.querySelector("img");
      expect(found, "no <img> reached the DOM from `![](…)` in a chat message").not.toBeNull();
      return found as HTMLImageElement;
    });

    expect(
      img.getAttribute("loading"),
      "a markdown image in a chat message has no `loading` — it is fetched eagerly even far below " +
        "the fold, which is what the package default exists to prevent. The chat path is no longer " +
        "receiving `slideMarkdownComponents`.",
    ).toBe("lazy");

    expect(
      img.getAttribute("decoding"),
      "a markdown image in a chat message has no `decoding` — decode blocks the main thread while " +
        "tokens are still streaming in. The chat path is no longer receiving the defaults.",
    ).toBe("async");
  });

  it("test_an_external_markdown_link_in_a_chat_message_carries_rel", async () => {
    const { container } = render(
      <ChatMessage message={assistantSaying("[docs](https://example.test/x)")} />,
    );

    const anchor = await waitFor(() => {
      const found = container.querySelector('a[href="https://example.test/x"]');
      expect(found, "no <a> reached the DOM from `[](…)` in a chat message").not.toBeNull();
      return found as HTMLAnchorElement;
    });

    // Defence in depth, not a fix for a live hole — see the file docblock. This assertion is what
    // keeps the anchor half of the default map wired: an edit that spreads only `img` would leave
    // this red instead of passing silently.
    expect(
      anchor.getAttribute("rel"),
      "an external markdown link in a chat message carries no `rel`. Nothing is exploitable today " +
        "(sanitize strips `target`), but the anchor half of the default map is no longer reaching " +
        "this path, so the protection now depends on nobody ever widening the sanitize schema.",
    ).toBe("noopener noreferrer");
  });
});
