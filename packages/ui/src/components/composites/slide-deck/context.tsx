"use client";

/**
 * DeckContext — internal Context shared between `<SlideDeck>` and its
 * dot-namespace sub-components (`<SlideDeck.Controls>`, etc.). ADR D14.
 */
import { type Dispatch, createContext, useContext } from "react";
import type { SlidePlugin, SlideProps } from "../../primitives/slide/index.js";
import type { SlideDeckSlide, SlideDeckTransition } from "./schema.js";
import type { DeckAction, DeckState } from "./use-deck-state.js";

export interface DeckContextValue {
  state: DeckState;
  dispatch: Dispatch<DeckAction>;
  slides: SlideDeckSlide[];
  transition: SlideDeckTransition;
  deckId: string;
  /** Rich-content plugins relayed to every inner `<Slide>` (D15). */
  plugins?: SlidePlugin[];
  /**
   * Markdown component overrides relayed to every inner `<Slide>` (B-286).
   * REPLACES the package defaults wholesale rather than merging with them.
   */
  components?: SlideProps["components"];
  /** Toggle browser fullscreen on the deck root. Safe to call when unsupported. */
  toggleFullscreen: () => void | Promise<void>;
  /** Trigger native print dialog with deck-specific @page CSS. */
  print: () => void;
}

export const DeckContext = createContext<DeckContextValue | null>(null);

export function useDeckContext(): DeckContextValue {
  const ctx = useContext(DeckContext);
  if (!ctx) {
    throw new Error(
      "SlideDeck sub-components must be used inside <SlideDeck>. " +
        "Wrap them in <SlideDeck slides={...}>.",
    );
  }
  return ctx;
}
