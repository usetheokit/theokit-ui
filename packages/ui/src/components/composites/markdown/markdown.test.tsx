import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "./markdown.js";

describe("<Markdown>", () => {
  it("drops javascript: links", async () => {
    const { container } = render(<Markdown source="[x](javascript:alert(1))" />);
    await waitFor(() => expect(container.textContent).toContain("x"));
    for (const el of container.querySelectorAll("[href]")) {
      expect(el.getAttribute("href")?.toLowerCase().startsWith("javascript:")).toBe(false);
    }
  });

  it("applies allowedProtocols to href", async () => {
    const { container } = render(
      <Markdown
        source="[a](http://e.com) [b](https://e.com) [c](/docs)"
        allowedProtocols={["https"]}
      />,
    );
    await waitFor(() => expect(container.querySelector('a[href="https://e.com"]')).not.toBeNull());
    expect(container.querySelector('a[href="http://e.com"]')).toBeNull();
    expect(container.querySelector('a[href="/docs"]')).not.toBeNull();
  });

  it("applies allowedProtocols to src", async () => {
    const { container } = render(
      <Markdown
        source="![i](http://e.com/a.png) ![j](https://e.com/b.png)"
        allowedProtocols={["https"]}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector('img[src="https://e.com/b.png"]')).not.toBeNull(),
    );
    expect(container.querySelector('img[src="http://e.com/a.png"]')).toBeNull();
  });

  it("never renders raw HTML", async () => {
    const { container } = render(<Markdown source="<img src=x onerror=alert(1)>" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("re-parses when allowedProtocols changes", async () => {
    const src = "[a](http://e.com)";
    const { container, rerender } = render(<Markdown source={src} allowedProtocols={["https"]} />);
    await waitFor(() => expect(container.textContent).toContain("a"));
    expect(container.querySelector('a[href="http://e.com"]')).toBeNull();
    rerender(<Markdown source={src} allowedProtocols={["http", "https"]} />);
    await waitFor(() => expect(container.querySelector('a[href="http://e.com"]')).not.toBeNull());
  });

  it("falls back to plain text when the parser rejects", async () => {
    const parser = await import("../../../lib/markdown/parser.js");
    const spy = vi.spyOn(parser, "parseMarkdownToReactSafe").mockRejectedValueOnce(new Error("boom"));
    const { container } = render(<Markdown source="**raw**" />);
    await waitFor(() => expect(container.textContent).toContain("**raw**"));
    spy.mockRestore();
  });
});
