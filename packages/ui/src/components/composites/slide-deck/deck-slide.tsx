"use client";

/**
 * `<DeckSlide>` — a `<Slide>` that reads the deck's relay from context.
 *
 * B-286 gave `SlideDeck` a `components` seam and relayed it to every render site, and B-288 had
 * done the same for `plugins`. Both relays were then written out at each site, which produced the
 * same four props in three places — and duplication is the mild half of the problem. The real half
 * is that a FOURTH render site added later inherits nothing: it renders a `<Slide>` that silently
 * drops the deck's overrides, which is exactly the defect those two items were filed to fix.
 *
 * Reading the context here makes the relay structural rather than remembered. A caller says which
 * markdown and which label; it cannot say "without the deck's overrides", because that is not a
 * thing a site inside a deck is allowed to decide.
 */
import type { FC } from "react";

import { Slide } from "../../primitives/slide/index.js";
import { useDeckContext } from "./context.js";

export interface DeckSlideProps {
  /** The slide's markdown source. */
  markdown: string;
  /** Accessible label — every site names its own, so it is required rather than defaulted. */
  "aria-label": string;
}

export const DeckSlide: FC<DeckSlideProps> = ({ markdown, "aria-label": ariaLabel }) => {
  const { plugins, components } = useDeckContext();
  return (
    <Slide markdown={markdown} plugins={plugins} components={components} aria-label={ariaLabel} />
  );
};
