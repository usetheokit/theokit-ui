import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseMarkdownToReact, parseMarkdownToReactSafe } from "./parser.js";

async function renderMarkdown(md: string, opts = {}): Promise<string> {
  const tree = await parseMarkdownToReact(md, opts);
  return renderToStaticMarkup(tree);
}

describe("parseMarkdownToReact — basic", () => {
  it("renders headings", async () => {
    const html = await renderMarkdown("# Hello");
    expect(html).toContain("<h1>Hello</h1>");
  });

  it("renders bold + italic", async () => {
    const html = await renderMarkdown("This is **bold** and _italic_.");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders inline code", async () => {
    const html = await renderMarkdown("Run `npm install`.");
    expect(html).toContain("<code>npm install</code>");
  });

  it("renders fenced code blocks with language class (className 'language-X')", async () => {
    const html = await renderMarkdown("```typescript\nconst x = 1;\n```");
    expect(html).toMatch(/<code class="language-typescript">/);
    expect(html).toContain("const x = 1;");
  });

  it("renders GFM tables", async () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |";
    const html = await renderMarkdown(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>1</td>");
  });

  it("renders GFM task lists", async () => {
    const html = await renderMarkdown("- [x] done\n- [ ] todo");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  it("renders GFM strikethrough", async () => {
    const html = await renderMarkdown("~~gone~~");
    expect(html).toContain("<del>gone</del>");
  });

  it("renders links", async () => {
    const html = await renderMarkdown("[docs](https://example.com)");
    expect(html).toContain('<a href="https://example.com">docs</a>');
  });
});

describe("parseMarkdownToReact — security", () => {
  it("strips raw <script> tags", async () => {
    const html = await renderMarkdown("hello\n\n<script>alert(1)</script>\n\nworld");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert");
  });

  it("does NOT allow inline event handlers via raw HTML", async () => {
    const html = await renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });
});

describe("parseMarkdownToReact — streaming", () => {
  it("with isStreaming, auto-closes an unterminated **bold** mid-stream", async () => {
    const html = await renderMarkdown("hello **wor", { isStreaming: true });
    expect(html).toContain("<strong>");
  });

  it("with isStreaming=false, leaves '**wor' as literal text", async () => {
    const html = await renderMarkdown("hello **wor", { isStreaming: false });
    expect(html).not.toContain("<strong>");
    expect(html).toContain("**wor");
  });

  it("with isStreaming, auto-closes an unterminated fence", async () => {
    const html = await renderMarkdown("```js\nconst x = 1;\n", { isStreaming: true });
    expect(html).toContain("<code");
  });
});

describe("parseMarkdownToReact — component override", () => {
  it("uses a consumer-provided `code` component for fenced code", async () => {
    const tree = await parseMarkdownToReact("```ts\nx\n```", {
      components: {
        // biome-ignore lint/suspicious/noExplicitAny: hast-util-to-jsx-runtime component shape is generic
        code: (props: any) => createElement("kbd", { ...props, "data-overridden": "true" }),
      },
    });
    const html = renderToStaticMarkup(tree);
    // The code element was swapped for kbd; the data attribute proves the
    // consumer's component took effect.
    expect(html).toContain("<kbd");
    expect(html).toContain('data-overridden="true"');
  });
});

describe("parseMarkdownToReactSafe — fallback path", () => {
  it("renders successfully when peer-deps present", async () => {
    const tree = await parseMarkdownToReactSafe("hello **world**");
    const html = renderToStaticMarkup(tree);
    expect(html).toContain("<strong>world</strong>");
  });
});

describe("parseMarkdownToReact — allowedProtocols", () => {
  it("keeps the sanitizer defaults when omitted", async () => {
    const html = await renderMarkdown("[a](http://e.com) [m](mailto:a@b.c)");
    expect(html).toContain('href="http://e.com"');
    expect(html).toContain('href="mailto:a@b.c"');
  });

  it("restricts href and src to the list, keeping relative URLs and anchors", async () => {
    const html = await renderMarkdown(
      "[a](http://e.com) [b](https://e.com) [c](/docs) [d](#top) ![i](http://e.com/i.png)",
      { allowedProtocols: ["https"] },
    );
    expect(html).not.toContain('href="http://e.com"');
    expect(html).not.toContain('src="http://e.com/i.png"');
    expect(html).toContain('href="https://e.com"');
    expect(html).toContain('href="/docs"');
    expect(html).toContain('href="#top"');
  });
});
