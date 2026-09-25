import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CodeBlock } from "./code-block.js";

describe("CodeBlock — shape + a11y", () => {
  it("renders the language label", () => {
    render(<CodeBlock code="const x = 1;" language="typescript" />);
    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("falls back to 'text' label when no language", () => {
    render(<CodeBlock code="hello" />);
    expect(screen.getByText("text")).toBeInTheDocument();
  });

  it("renders the source code in the <code> element", () => {
    render(<CodeBlock code="const x = 42;" language="ts" />);
    expect(screen.getByText("const x = 42;")).toBeInTheDocument();
  });

  it("has an accessible Copy button", () => {
    render(<CodeBlock code="hello" />);
    const button = screen.getByRole("button", { name: /copy/i });
    expect(button).toBeInTheDocument();
  });
});

describe("CodeBlock — copy interaction", () => {
  it("flips the button label to 'Copied' after click (when clipboard API resolves)", async () => {
    // happy-dom ships a working `navigator.clipboard.writeText` that resolves.
    //
    // B-305 — this assertion used to race two clocks it had no control over, and lost roughly one
    // full-suite run in eight.
    //
    // `code-block.tsx` shows both. The handler sets `copied` and then
    // `setTimeout(() => setCopied(false), 2000)`, so the label exists for TWO seconds. The render
    // effect calls `getHighlighter`, which does `await import("shiki")` — module-cached, so whichever
    // test mounts a CodeBlock first in a worker pays for the whole grammar load. When that cost lands
    // between the click and the query, the label has already reverted, and the failure reads `Unable
    // to find an element with the text: /copied/i` — a query that matched nothing, which says nothing
    // about WHY. It is not a timeout: waiting longer cannot help, because the thing being waited for
    // stopped existing.
    //
    // Two changes, neither of them a longer window. No `language`, so the effect returns at
    // `if (!language) return` and the shiki import never happens — highlighting is not what this test
    // is about. And the assertion reads `aria-label`, which IS the state
    // (`copied ? "Copied" : "Copy code"`), so a failure prints the value it found instead of
    // reporting an absence.
    const user = userEvent.setup();
    render(<CodeBlock code="hello world" />);
    const button = screen.getByRole("button", { name: /copy/i });
    expect(button).toHaveAttribute("aria-label", "Copy code");

    await user.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute("aria-label", "Copied");
    });
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("does not throw when clipboard.writeText rejects (graceful degradation)", async () => {
    // Stub writeText to reject; the handler must swallow the error.
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const user = userEvent.setup();
    render(<CodeBlock code="x" />);
    const button = screen.getByRole("button", { name: /copy/i });
    await expect(user.click(button)).resolves.not.toThrow();

    if (originalDescriptor) {
      Object.defineProperty(navigator, "clipboard", originalDescriptor);
    }
  });
});
