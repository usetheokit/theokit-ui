import { fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SlidePlugin } from "../../primitives/slide/index.js";
import type { SlideDeckSlide } from "./schema.js";
import { SlideDeck } from "./slide-deck.js";

const sampleMd = "# Slide A\n\n---\n\n# Slide B\n\n---\n\n# Slide C";

/**
 * Fixture for the `components` relay cases, sized once for every render site.
 *
 * TWO slides, not one and not four: `presenter-view.tsx` mounts the next preview only when a next
 * slide exists, so a 1-slide deck leaves that render site unmounted; `thumbnails.tsx` passes
 * `eager={eagerAll || index < 3}`, so a deck of at most 3 keeps every thumbnail eager and removes
 * the `IntersectionObserver` dependency. Two satisfies both bounds at once.
 */
const relayMd = "# one\n\n---\n\n# two";

/** Overrides `h1`, which `relayMd` emits, so an assertion can observe what it claims to. */
const MarkH1 = ({ children }: { children?: ReactNode }) => <h1 data-mark="x">{children}</h1>;

/**
 * A markdown image is the probe for the DEFAULTS: `slideMarkdownComponents` is what adds
 * `loading="lazy"` to one. A consumer supplying nothing keeps it; a consumer supplying `{}`
 * replaces the whole map and therefore loses it.
 */
const imageMd = "![](x.png)";

describe("<SlideDeck>", () => {
  it("renders the deck region with aria-roledescription", () => {
    const { container } = render(<SlideDeck slides={sampleMd} />);
    const deck = container.querySelector("[data-theo-slide-deck]");
    expect(deck).toBeTruthy();
    expect(deck?.getAttribute("aria-roledescription")).toBe("slide deck");
  });

  it("renders multi-slide deck splitting on top-level ---", async () => {
    const { container } = render(<SlideDeck slides={sampleMd} />);
    await waitFor(() => {
      const indicator = container.querySelector(".theo-slide-deck-controls-indicator");
      expect(indicator?.textContent).toBe("1 / 3");
    });
  });

  it("accepts SlideDeckSlide[] prop", async () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# A" }, { markdown: "# B" }];
    const { container } = render(<SlideDeck slides={slides} />);
    await waitFor(() => {
      const indicator = container.querySelector(".theo-slide-deck-controls-indicator");
      expect(indicator?.textContent).toBe("1 / 2");
    });
  });

  it("keyboard ArrowRight advances slide", async () => {
    const { container } = render(<SlideDeck slides={sampleMd} />);
    await waitFor(() => {
      expect(container.querySelector(".theo-slide-deck-controls-indicator")?.textContent).toBe(
        "1 / 3",
      );
    });
    fireEvent.keyDown(document, { key: "ArrowRight" });
    await waitFor(() => {
      expect(container.querySelector(".theo-slide-deck-controls-indicator")?.textContent).toBe(
        "2 / 3",
      );
    });
  });

  it("aria-live region announces 'Slide N of M'", async () => {
    const { container } = render(<SlideDeck slides={sampleMd} />);
    await waitFor(() => {
      const status = container.querySelector('[role="status"]');
      expect(status?.textContent).toBe("Slide 1 of 3");
    });
  });

  it("empty deck renders without crashing + shows 'Empty deck'", () => {
    const { container } = render(<SlideDeck slides={[]} />);
    expect(container.querySelector("[data-theo-slide-deck-empty]")).toBeTruthy();
    expect(container.textContent).toContain("Empty deck");
  });

  it("initialIndex respected", async () => {
    const { container } = render(
      <SlideDeck slides={sampleMd} initialIndex={2} enableHashRouting={false} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".theo-slide-deck-controls-indicator")?.textContent).toBe(
        "3 / 3",
      );
    });
  });

  it("onIndexChange callback fires on navigation", async () => {
    const onIndexChange = vi.fn();
    const { container } = render(
      <SlideDeck slides={sampleMd} onIndexChange={onIndexChange} enableHashRouting={false} />,
    );
    // Wait for parse to finish (indicator shows correct total).
    await waitFor(() => {
      expect(container.querySelector(".theo-slide-deck-controls-indicator")?.textContent).toBe(
        "1 / 3",
      );
    });
    fireEvent.keyDown(document, { key: "ArrowRight" });
    await waitFor(() => {
      expect(onIndexChange).toHaveBeenCalled();
    });
    const lastCall = onIndexChange.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(1);
    expect(lastCall?.[1]?.markdown).toContain("Slide B");
  });

  it("renders default layout when no children", async () => {
    const { container } = render(<SlideDeck slides={sampleMd} />);
    await waitFor(() => {
      expect(container.querySelector(".theo-slide-deck-default-layout")).toBeTruthy();
      expect(container.querySelector("[data-theo-slide-deck-controls]")).toBeTruthy();
    });
  });

  it("renders custom (headless) layout when children provided", async () => {
    const { container } = render(
      <SlideDeck slides={sampleMd} enableHashRouting={false}>
        <div data-custom-chrome="true">
          <SlideDeck.Controls />
        </div>
      </SlideDeck>,
    );
    await waitFor(() => {
      expect(container.querySelector("[data-custom-chrome]")).toBeTruthy();
      expect(container.querySelector(".theo-slide-deck-default-layout")).toBeNull();
    });
  });

  it("EC-4: slides prop shrinks below currentIndex → clamps to last", async () => {
    const slides1: SlideDeckSlide[] = [
      { markdown: "# A" },
      { markdown: "# B" },
      { markdown: "# C" },
      { markdown: "# D" },
      { markdown: "# E" },
    ];
    const { container, rerender } = render(
      <SlideDeck slides={slides1} initialIndex={4} enableHashRouting={false} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".theo-slide-deck-controls-indicator")?.textContent).toBe(
        "5 / 5",
      );
    });
    const slides2: SlideDeckSlide[] = [{ markdown: "# A" }, { markdown: "# B" }];
    rerender(<SlideDeck slides={slides2} initialIndex={4} enableHashRouting={false} />);
    await waitFor(() => {
      expect(container.querySelector(".theo-slide-deck-controls-indicator")?.textContent).toBe(
        "2 / 2",
      );
    });
  });

  it("data-theo-slide-deck-fullscreen attribute reflects state", () => {
    const { container } = render(<SlideDeck slides={sampleMd} />);
    const deck = container.querySelector("[data-theo-slide-deck]") as HTMLElement;
    // Initially not fullscreen.
    expect(deck.getAttribute("data-theo-slide-deck-fullscreen")).toBeNull();
  });

  it("aria-label propagates", () => {
    const { getByLabelText } = render(
      <SlideDeck slides={sampleMd} aria-label="Quarterly review deck" />,
    );
    expect(getByLabelText("Quarterly review deck")).toBeTruthy();
  });

  it("plugins prop relayed to every internal <Slide> (T0.3 / D15)", async () => {
    const calls: string[] = [];
    const plugin: SlidePlugin = {
      name: "spy",
      mdastTransform: (tree) => {
        calls.push("called");
        // rename h1 → h2 so we can observe per slide
        for (const node of tree.children) {
          if (node.type === "heading" && node.depth === 1) {
            node.depth = 2 as 1 | 2 | 3 | 4 | 5 | 6;
          }
        }
        return tree;
      },
    };
    const slides: SlideDeckSlide[] = [{ markdown: "# one" }, { markdown: "# two" }];
    const { container } = render(<SlideDeck slides={slides} plugins={[plugin]} />);
    await waitFor(() => {
      expect(container.querySelector("h2")?.textContent).toContain("one");
    });
    expect(calls.length).toBeGreaterThan(0);
    expect(container.querySelector("h1")).toBeFalsy();
  });

  it("a supplied component reaches the deck renderer", async () => {
    const { container } = render(
      <SlideDeck slides={relayMd} components={{ h1: MarkH1 }} enableHashRouting={false} />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-slot="slides-view"] h1[data-mark]')).toBeTruthy();
    });
  });

  it("a supplied component reaches the presenter-current renderer", async () => {
    const { container } = render(
      <SlideDeck slides={relayMd} components={{ h1: MarkH1 }} enableHashRouting={false} />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-slot="slides-view"] h1')).toBeTruthy();
    });
    // `presenterMode` starts false and the panel returns null, so the public route that opens it
    // is the documented hotkey (use-deck-keyboard.ts: n/N/p/P -> TOGGLE_PRESENTER).
    fireEvent.keyDown(document, { key: "n" });
    await waitFor(() => {
      expect(
        container.querySelector('section[aria-label="Current slide preview"] h1[data-mark]'),
      ).toBeTruthy();
    });
  });

  it("a supplied component reaches the presenter-next renderer", async () => {
    const { container } = render(
      <SlideDeck slides={relayMd} components={{ h1: MarkH1 }} enableHashRouting={false} />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-slot="slides-view"] h1')).toBeTruthy();
    });
    fireEvent.keyDown(document, { key: "n" });
    await waitFor(() => {
      expect(
        container.querySelector('section[aria-label="Next slide preview"] h1[data-mark]'),
      ).toBeTruthy();
    });
  });

  it("deck with an empty components map replaces the defaults", async () => {
    // EC-3: `{}` is a supplied override to nothing, not an absent override. The primitive
    // defaults the parameter, and a default parameter fires on `undefined` only — so `{}` reaches
    // `toJsxRuntime` and the package's own renderers are gone, `loading="lazy"` with them.
    const { container } = render(
      <SlideDeck slides={imageMd} components={{}} enableHashRouting={false} />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-slot="slides-view"] img')).toBeTruthy();
    });
    expect(
      container.querySelector('[data-slot="slides-view"] img')?.getAttribute("loading"),
    ).toBeNull();
  });

  it("deck with no components keeps the package defaults", async () => {
    // FR-003 must-not-regress: green before this change and after it. `@theokit/plugin-canvas`
    // renders <SlideDeck> supplying no components, and depends on these defaults staying in force.
    const { container } = render(<SlideDeck slides={imageMd} enableHashRouting={false} />);
    await waitFor(() => {
      expect(container.querySelector('[data-slot="slides-view"] img')).toBeTruthy();
    });
    expect(container.querySelector('[data-slot="slides-view"] img')?.getAttribute("loading")).toBe(
      "lazy",
    );
  });
});
