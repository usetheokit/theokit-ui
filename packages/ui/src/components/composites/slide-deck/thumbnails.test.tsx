import { fireEvent, render, waitFor } from "@testing-library/react";
import { type Dispatch, useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SlidePlugin } from "../../primitives/slide/index.js";
import { DeckContext, type DeckContextValue } from "./context.js";
import type { SlideDeckSlide } from "./schema.js";
import { Thumbnails } from "./thumbnails.js";
import { type DeckAction, type DeckState, deckReducer } from "./use-deck-state.js";

interface HarnessProps {
  slides: SlideDeckSlide[];
  initial?: Partial<DeckState>;
  plugins?: SlidePlugin[];
}

function Harness({ slides, initial = {}, plugins }: HarnessProps) {
  const [state, dispatch] = useReducer(deckReducer, {
    currentIndex: 0,
    currentFragment: 0,
    presenterMode: false,
    fullscreen: false,
    transitionDirection: "none",
    totalSlides: slides.length,
    totalFragmentsInCurrent: 0,
    ...initial,
  });
  const value: DeckContextValue = {
    state,
    dispatch: dispatch as Dispatch<DeckAction>,
    slides,
    transition: "fade",
    deckId: "test",
    plugins,
    toggleFullscreen: () => undefined,
    print: () => undefined,
  };
  return (
    <DeckContext.Provider value={value}>
      <Thumbnails />
    </DeckContext.Provider>
  );
}

// Default IO mock for jsdom — happy-dom may not ship IO either.
class MockIO {
  callback: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}

beforeEach(() => {
  (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver =
    MockIO as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<Thumbnails>", () => {
  it("renders N thumbnails for N slides", () => {
    const slides: SlideDeckSlide[] = [
      { markdown: "# A" },
      { markdown: "# B" },
      { markdown: "# C" },
    ];
    const { container } = render(<Harness slides={slides} />);
    expect(container.querySelectorAll("[data-theo-slide-deck-thumbnail]").length).toBe(3);
  });

  it("click thumbnail dispatches JUMP_TO with correct index", () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# A" }, { markdown: "# B" }];
    const { getAllByRole, container } = render(<Harness slides={slides} />);
    const buttons = getAllByRole("button");
    const secondButton = buttons[1];
    if (!secondButton) throw new Error("expected second button");
    fireEvent.click(secondButton);
    const thumb2 = container.querySelectorAll("[data-theo-slide-deck-thumbnail]")[1] as HTMLElement;
    expect(thumb2.getAttribute("data-current")).toBe("true");
  });

  it("current thumbnail has data-current=true", () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# A" }, { markdown: "# B" }];
    const { container } = render(<Harness slides={slides} initial={{ currentIndex: 1 }} />);
    const thumbs = container.querySelectorAll("[data-theo-slide-deck-thumbnail]");
    expect((thumbs[0] as HTMLElement).getAttribute("data-current")).toBeNull();
    expect((thumbs[1] as HTMLElement).getAttribute("data-current")).toBe("true");
  });

  it("aria-current='page' on current thumbnail", () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# A" }, { markdown: "# B" }];
    const { container } = render(<Harness slides={slides} initial={{ currentIndex: 1 }} />);
    const thumbs = container.querySelectorAll("[data-theo-slide-deck-thumbnail]");
    expect((thumbs[1] as HTMLElement).getAttribute("aria-current")).toBe("page");
  });

  it("renders semantic ul + li for a11y", () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# A" }];
    const { container } = render(<Harness slides={slides} />);
    expect(container.querySelector("ul.theo-slide-deck-thumbnails")).toBeTruthy();
    expect(container.querySelector("ul.theo-slide-deck-thumbnails > li")).toBeTruthy();
  });

  it("EC-13: when IntersectionObserver absent, renders eagerly without crash", () => {
    (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver =
      undefined as unknown as typeof IntersectionObserver;
    const slides: SlideDeckSlide[] = [
      { markdown: "# A" },
      { markdown: "# B" },
      { markdown: "# C" },
      { markdown: "# D" },
      { markdown: "# E" },
    ];
    const { container } = render(<Harness slides={slides} />);
    expect(container.querySelectorAll("[data-theo-slide-deck-thumbnail]").length).toBe(5);
  });

  it("empty slides renders empty list (no crash)", () => {
    const { container } = render(<Harness slides={[]} initial={{ totalSlides: 0 }} />);
    expect(container.querySelectorAll("[data-theo-slide-deck-thumbnail]").length).toBe(0);
  });

  it("relays context plugins to the inner <Slide> (B-288)", async () => {
    // Without the relay a thumbnail of a plugin-rendered slide shows raw source
    // instead of the rendered form, so the silhouette a thumbnail exists to be
    // recognised by is the wrong one. Probe: a plugin that renames h1 -> h2.
    const plugin: SlidePlugin = {
      name: "rename-h1-to-h2",
      mdastTransform: (tree) => {
        for (const node of tree.children) {
          if (node.type === "heading" && node.depth === 1) {
            node.depth = 2 as 1 | 2 | 3 | 4 | 5 | 6;
          }
        }
        return tree;
      },
    };
    const slides: SlideDeckSlide[] = [{ markdown: "# thumb" }];
    const { container } = render(<Harness slides={slides} plugins={[plugin]} />);
    await waitFor(() => {
      expect(container.querySelector("[data-theo-slide-deck-thumbnail] h2")).toBeTruthy();
    });
    expect(container.querySelector("[data-theo-slide-deck-thumbnail] h1")).toBeFalsy();
  });
});
