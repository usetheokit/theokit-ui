"use client";

import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
/**
 * `<SlideDeck>` — composite engine orchestrating N `<Slide>` primitives.
 *
 * Subpath-isolated at `@theokit/ui/slide-deck` (ADR D1). Imports `<Slide>` via
 * the public package path so consumer's installed peer-deps are reused.
 *
 * See RFC 0003 and the plan in
 * `wiki/rfcs/0003-slide-deck.md`.
 *
 * Two render modes:
 *   - DEFAULT layout: no children → renders canonical chrome (Slides + Controls
 *     + ProgressBar + SlideNumber + PresenterView + buttons).
 *   - HEADLESS: children provided → consumer composes own layout from
 *     `<SlideDeck.X>` sub-components and a shared DeckContext.
 *
 * SSR-safe: parses markdown only inside `useEffect`. Hash routing uses lazy
 * `initFromHash` (D17) to avoid hydration mismatch. Reducer clamps
 * `currentIndex` whenever `slides.length` changes (EC-4 reconciliation).
 */
import { Slide, type SlidePlugin, type SlideProps } from "../../primitives/slide/index.js";
import { DeckContext, type DeckContextValue, useDeckContext } from "./context.js";
import { Controls } from "./controls.js";
import { DeckSlide } from "./deck-slide.js";
import { countFragmentsInMarkdown } from "./fragments.js";
import { PresenterView } from "./presenter-view.js";
import { printDeck } from "./print-styles.js";
import { ProgressBar } from "./progress-bar.js";
import type { SlideDeckInput, SlideDeckSlide, SlideDeckTransition } from "./schema.js";
import { SlideNumber } from "./slide-number.js";
import { splitDeck } from "./split-deck.js";
import { Thumbnails } from "./thumbnails.js";
import { readInitialHash, useDeckHashRouting } from "./use-deck-hash-routing.js";
import { useDeckKeyboard } from "./use-deck-keyboard.js";
import { useDeckState } from "./use-deck-state.js";
import { useDeckSwipe } from "./use-deck-swipe.js";
import { useFullscreen } from "./use-fullscreen.js";

import "./transitions.css";

export interface SlideDeckProps {
  /** Markdown string (auto-split) or pre-parsed slide array. */
  slides: SlideDeckInput;
  /** Initial slide index (0-based). Default 0. */
  initialIndex?: number;
  /** Transition preset. Default "fade". */
  transition?: SlideDeckTransition;
  /** Enable keyboard navigation. Default true. */
  enableKeyboard?: boolean;
  /** Enable touch/pointer swipe navigation. Default true. */
  enableTouch?: boolean;
  /** Enable hash routing (#/N). Default true. */
  enableHashRouting?: boolean;
  /** Optional unique deck id (auto-generated UUID if absent). */
  deckId?: string;
  /** Called after each navigation. */
  onIndexChange?: (index: number, slide: SlideDeckSlide | undefined) => void;
  /** Headless mode: render custom chrome using `<SlideDeck.X>` sub-components. */
  children?: ReactNode;
  /** Outer className for the deck root. */
  className?: string;
  /** Accessible label for the deck region. Defaults to "Slide deck". */
  "aria-label"?: string;
  /**
   * Rich-content plugins relayed to every inner `<Slide>` (D15 / RFC 0004).
   * Pass MEMOIZED arrays to avoid re-parses on every render.
   */
  plugins?: SlidePlugin[];
  /**
   * Markdown component overrides relayed to every inner `<Slide>` (B-286).
   *
   * The primitive treats this map as a REPLACEMENT and never as a merge, so a consumer supplying
   * `{ a: MyLink }` also gives up this package's own `img` renderer and the `loading="lazy"`,
   * `decoding="async"` and `alt` normalisation it applies. Supplying nothing keeps all of them.
   *
   * Pass MEMOIZED maps to avoid re-parses on every render.
   */
  components?: SlideProps["components"];
}

function generateDeckId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `deck-${Math.random().toString(36).slice(2, 10)}`;
}

const SlideDeckBase: FC<SlideDeckProps> = ({
  slides: slidesInput,
  initialIndex = 0,
  transition = "fade",
  enableKeyboard = true,
  enableTouch = true,
  enableHashRouting = true,
  deckId: deckIdProp,
  onIndexChange,
  children,
  className,
  "aria-label": ariaLabel = "Slide deck",
  plugins,
  components,
}) => {
  const generatedId = useId();
  const deckId = deckIdProp ?? generatedId ?? generateDeckId();
  const rootRef = useRef<HTMLDivElement>(null);

  const [parsedSlides, setParsedSlides] = useState<SlideDeckSlide[]>(() => {
    return Array.isArray(slidesInput) ? slidesInput : [];
  });

  // Async parse when string markdown is passed. Re-run when prop changes.
  useEffect(() => {
    if (Array.isArray(slidesInput)) {
      setParsedSlides(slidesInput);
      return;
    }
    let cancelled = false;
    splitDeck(slidesInput).then(
      (result) => {
        if (!cancelled) setParsedSlides(result);
      },
      () => {
        if (!cancelled) setParsedSlides([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [slidesInput]);

  const [state, dispatch] = useDeckState({
    initialIndex,
    totalSlides: parsedSlides.length,
    initFromHash: enableHashRouting ? readInitialHash : undefined,
  });

  // EC-4: reconcile when slides.length changes.
  const previousLengthRef = useRef(0);
  useEffect(() => {
    const length = parsedSlides.length;
    dispatch({ type: "UPDATE_TOTAL_SLIDES", total: length });
    // First non-empty parse → honour `initialIndex` (or hash) which was clamped
    // to 0 during initial mount when totalSlides was still 0.
    if (previousLengthRef.current === 0 && length > 0) {
      let target = initialIndex;
      if (enableHashRouting) {
        const hashIdx = readInitialHash();
        if (typeof hashIdx === "number") target = hashIdx;
      }
      if (target > 0) {
        dispatch({ type: "JUMP_TO", index: target });
      }
    }
    previousLengthRef.current = length;
  }, [parsedSlides.length, dispatch, initialIndex, enableHashRouting]);

  // Update totalFragmentsInCurrent when slide content changes.
  useEffect(() => {
    const current = parsedSlides[state.currentIndex];
    const count = current ? countFragmentsInMarkdown(current.markdown) : 0;
    dispatch({ type: "UPDATE_TOTAL_FRAGMENTS", total: count });
  }, [parsedSlides, state.currentIndex, dispatch]);

  const fullscreen = useFullscreen(rootRef);

  // Sync state.fullscreen with browser API. When user presses Esc on native UI.
  useEffect(() => {
    dispatch({ type: "SET_FULLSCREEN", value: fullscreen.isFullscreen });
  }, [fullscreen.isFullscreen, dispatch]);

  // EC-3 / D16: transition timeout fallback so rapid nav doesn't leave state stuck.
  useEffect(() => {
    if (state.transitionDirection === "none") return;
    const t = setTimeout(() => dispatch({ type: "TRANSITION_END" }), 300);
    return () => clearTimeout(t);
  }, [state.transitionDirection, dispatch]);

  const onPrint = useCallback(() => {
    printDeck();
  }, []);

  useDeckKeyboard(dispatch, {
    enabled: enableKeyboard,
    totalSlides: parsedSlides.length,
    onToggleFullscreen: fullscreen.toggle,
    onPrint,
  });

  useDeckSwipe(rootRef, dispatch, { enabled: enableTouch });

  useDeckHashRouting(dispatch, {
    enabled: enableHashRouting,
    totalSlides: parsedSlides.length,
    currentIndex: state.currentIndex,
  });

  // Fire onIndexChange callback when currentIndex changes.
  const lastIndexRef = useRef(state.currentIndex);
  useEffect(() => {
    if (lastIndexRef.current !== state.currentIndex) {
      lastIndexRef.current = state.currentIndex;
      onIndexChange?.(state.currentIndex, parsedSlides[state.currentIndex]);
    }
  }, [state.currentIndex, parsedSlides, onIndexChange]);

  const contextValue: DeckContextValue = useMemo(
    () => ({
      state,
      dispatch,
      slides: parsedSlides,
      transition,
      deckId,
      plugins,
      components,
      toggleFullscreen: fullscreen.toggle,
      print: onPrint,
    }),
    [
      state,
      dispatch,
      parsedSlides,
      transition,
      deckId,
      plugins,
      components,
      fullscreen.toggle,
      onPrint,
    ],
  );

  return (
    <DeckContext.Provider data-slot="slide-deck-base" value={contextValue}>
      <div
        ref={rootRef}
        aria-roledescription="slide deck"
        aria-label={ariaLabel}
        data-theo-slide-deck
        data-theo-slide-deck-fullscreen={state.fullscreen ? "true" : undefined}
        className={["theo-slide-deck", className].filter(Boolean).join(" ")}
        style={{ position: "relative", width: "100%", height: "100%" }}
      >
        {/* Live region for screen readers announcing slide changes. */}
        {/* biome-ignore lint/a11y/useSemanticElements: ARIA live region needs explicit role for screen reader announcement; no native HTML equivalent for status updates from non-form, non-output content. */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {parsedSlides.length > 0
            ? `Slide ${state.currentIndex + 1} of ${parsedSlides.length}`
            : "Empty deck"}
        </div>
        {children ?? <DefaultDeckLayout />}
        {/* Hidden print container — visible only during @media print. */}
        <PrintContainer slides={parsedSlides} plugins={plugins} components={components} />
      </div>
    </DeckContext.Provider>
  );
};

const SlidesView: FC<{ className?: string }> = ({ className }) => {
  const { state, slides, transition } = useDeckContext();
  const current = slides[state.currentIndex];
  return (
    <div
      data-slot="slides-view"
      className={["theo-slide-deck-slide-frame", className].filter(Boolean).join(" ")}
      data-theo-slide-deck-transition={transition}
      data-theo-slide-deck-direction={state.transitionDirection}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {current ? (
        <div
          key={state.currentIndex}
          data-theo-slide-deck-slide-state="incoming"
          style={{ position: "absolute", inset: 0 }}
        >
          <DeckSlide markdown={current.markdown} aria-label={`Slide ${state.currentIndex + 1}`} />
        </div>
      ) : (
        <div
          data-theo-slide-deck-empty
          style={{
            display: "grid",
            placeItems: "center",
            height: "100%",
            opacity: 0.6,
            fontSize: 14,
          }}
        >
          Empty deck
        </div>
      )}
    </div>
  );
};

const PresenterButton: FC<{ className?: string }> = ({ className }) => {
  const { state, dispatch } = useDeckContext();
  return (
    <button
      data-slot="presenter-button"
      type="button"
      onClick={() => dispatch({ type: "TOGGLE_PRESENTER" })}
      aria-pressed={state.presenterMode}
      aria-label={state.presenterMode ? "Close presenter view" : "Open presenter view"}
      className={["theo-slide-deck-presenter-button", className].filter(Boolean).join(" ")}
    >
      {state.presenterMode ? "Close presenter" : "Presenter"}
    </button>
  );
};

const FullscreenButton: FC<{ className?: string }> = ({ className }) => {
  const { state, toggleFullscreen } = useDeckContext();
  return (
    <button
      data-slot="fullscreen-button"
      type="button"
      onClick={() => void toggleFullscreen()}
      aria-pressed={state.fullscreen}
      aria-label={state.fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      className={["theo-slide-deck-fullscreen-button", className].filter(Boolean).join(" ")}
    >
      {state.fullscreen ? "Exit fullscreen" : "Fullscreen"}
    </button>
  );
};

const PrintButton: FC<{ className?: string }> = ({ className }) => {
  const { print } = useDeckContext();
  return (
    <button
      data-slot="print-button"
      type="button"
      onClick={() => print()}
      aria-label="Print or save deck as PDF"
      className={["theo-slide-deck-print-button", className].filter(Boolean).join(" ")}
    >
      Print
    </button>
  );
};

const PrintContainer: FC<{
  slides: SlideDeckSlide[];
  plugins?: SlidePlugin[];
  /** Drilled rather than read from the context: this component never calls `useDeckContext()`. */
  components?: SlideProps["components"];
}> = ({ slides, plugins, components }) => {
  return (
    <div
      data-slot="print-container"
      className="theo-slide-deck-print-container"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        visibility: "hidden",
      }}
    >
      {slides.map((slide, index) => (
        <div
          key={`print-${slide.id ?? index}`}
          className="theo-slide-deck-print-slide"
          style={{ width: 1280, height: 720 }}
        >
          <Slide
            markdown={slide.markdown}
            plugins={plugins}
            components={components}
            aria-label={`Print slide ${index + 1}`}
          />
        </div>
      ))}
    </div>
  );
};

const DefaultDeckLayout: FC = () => {
  return (
    <div
      data-slot="default-deck-layout"
      className="theo-slide-deck-default-layout"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gridTemplateRows: "1fr auto",
        gap: 8,
        height: "100%",
      }}
    >
      <SlidesView />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "4px 8px",
          flexWrap: "wrap",
        }}
      >
        <Controls />
        <ProgressBar />
        <div style={{ display: "flex", gap: 4 }}>
          <PresenterButton />
          <FullscreenButton />
          <PrintButton />
        </div>
      </div>
      <SlideNumber />
      <PresenterView />
    </div>
  );
};

type SlideDeckComponent = FC<SlideDeckProps> & {
  Slides: FC<{ className?: string }>;
  Controls: typeof Controls;
  ProgressBar: typeof ProgressBar;
  SlideNumber: typeof SlideNumber;
  Thumbnails: typeof Thumbnails;
  PresenterView: typeof PresenterView;
  PresenterButton: FC<{ className?: string }>;
  FullscreenButton: FC<{ className?: string }>;
  PrintButton: FC<{ className?: string }>;
};

const SlideDeck = SlideDeckBase as SlideDeckComponent;
SlideDeck.Slides = SlidesView;
SlideDeck.Controls = Controls;
SlideDeck.ProgressBar = ProgressBar;
SlideDeck.SlideNumber = SlideNumber;
SlideDeck.Thumbnails = Thumbnails;
SlideDeck.PresenterView = PresenterView;
SlideDeck.PresenterButton = PresenterButton;
SlideDeck.FullscreenButton = FullscreenButton;
SlideDeck.PrintButton = PrintButton;

export { SlideDeck };
