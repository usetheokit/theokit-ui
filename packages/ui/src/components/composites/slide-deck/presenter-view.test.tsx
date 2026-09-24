import { render, waitFor } from "@testing-library/react";
import { type Dispatch, useReducer } from "react";
import { describe, expect, it } from "vitest";
import type { SlidePlugin } from "../../primitives/slide/index.js";
import { DeckContext, type DeckContextValue } from "./context.js";
import { PresenterView } from "./presenter-view.js";
import type { SlideDeckSlide } from "./schema.js";
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
    presenterMode: true, // default ON for these tests
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
      <PresenterView />
    </DeckContext.Provider>
  );
}

describe("<PresenterView>", () => {
  it("renders null when presenterMode is false", () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# A" }];
    const { container } = render(<Harness slides={slides} initial={{ presenterMode: false }} />);
    expect(container.querySelector("[data-theo-slide-deck-presenter]")).toBeNull();
  });

  it("renders panel when presenterMode is true", () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# A" }, { markdown: "# B" }];
    const { container } = render(<Harness slides={slides} />);
    expect(container.querySelector("[data-theo-slide-deck-presenter]")).toBeTruthy();
  });

  it("shows 'End of deck' when no next slide", () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# Only slide" }];
    const { getByText } = render(<Harness slides={slides} initial={{ currentIndex: 0 }} />);
    expect(getByText(/End of deck/i)).toBeTruthy();
  });

  it("renders speaker notes when current slide has them", () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# A", notes: "Remember timing" }];
    const { getByText } = render(<Harness slides={slides} />);
    expect(getByText(/Remember timing/)).toBeTruthy();
  });

  it("no notes section when current slide has none", () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# A" }];
    const { container } = render(<Harness slides={slides} />);
    expect(container.querySelector('[aria-label="Speaker notes"]')).toBeNull();
  });

  it("timer shows initial 00:00", () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# A" }];
    const { getByLabelText } = render(<Harness slides={slides} />);
    expect(getByLabelText("Elapsed time").textContent).toBe("00:00");
  });

  it("renders Current and Next sections (a11y)", () => {
    const slides: SlideDeckSlide[] = [{ markdown: "# A" }, { markdown: "# B" }];
    const { getByLabelText } = render(<Harness slides={slides} />);
    expect(getByLabelText("Current slide preview")).toBeTruthy();
    expect(getByLabelText("Next slide preview")).toBeTruthy();
  });

  it("relays context plugins to BOTH inner <Slide> previews (B-288)", async () => {
    // A presenter view exists so the presenter sees what the audience sees.
    // Without the relay the presenter reads raw `$$...$$` / a stripped diagram
    // while the audience sees the rendered form. Probe: a plugin renaming h1 -> h2.
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
    const slides: SlideDeckSlide[] = [{ markdown: "# current" }, { markdown: "# next" }];
    const { getByLabelText } = render(<Harness slides={slides} plugins={[plugin]} />);
    const current = getByLabelText("Current slide preview");
    const next = getByLabelText("Next slide preview");
    await waitFor(() => {
      expect(current.querySelector("h2")?.textContent).toContain("current");
      expect(next.querySelector("h2")?.textContent).toContain("next");
    });
    expect(current.querySelector("h1")).toBeFalsy();
    expect(next.querySelector("h1")).toBeFalsy();
  });
});
