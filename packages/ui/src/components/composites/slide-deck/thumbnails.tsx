"use client";

/**
 * `<SlideDeck.Thumbnails>` — sidebar with mini Slide instances.
 *
 * Performance strategy:
 *   - Each thumbnail renders the actual `<Slide>` inside a scaled wrapper (~0.18×).
 *   - IntersectionObserver lazy-loads thumbnails — off-screen ones show a
 *     placeholder skeleton instead of parsing the markdown.
 *   - EC-13: when IntersectionObserver is undefined (legacy env / SSR), falls
 *     back to eager render. Acceptable for decks ≤ 50 slides.
 *
 * Click handler dispatches JUMP_TO. Auto-scroll keeps current thumbnail visible.
 */
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeckContext } from "./context.js";
import { DeckSlide } from "./deck-slide.js";

export interface ThumbnailsProps {
  className?: string;
  /** Scale of each thumbnail. Default 0.18. */
  scale?: number;
}

const CANVAS_W = 1280;
const CANVAS_H = 720;

interface ThumbnailItemProps {
  markdown: string;
  index: number;
  isCurrent: boolean;
  scale: number;
  eager: boolean;
  onSelect: (index: number) => void;
  registerRef: (index: number, el: HTMLElement | null) => void;
}

const ThumbnailItem: FC<ThumbnailItemProps> = ({
  markdown,
  index,
  isCurrent,
  scale,
  eager,
  onSelect,
  registerRef,
}) => {
  const [revealed, setRevealed] = useState(eager);

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      registerRef(index, el);
      if (eager) return;
      if (!el) return;
      if (typeof IntersectionObserver === "undefined") {
        // EC-13 fallback: no IO, render eagerly.
        setRevealed(true);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setRevealed(true);
              io.disconnect();
              break;
            }
          }
        },
        { rootMargin: "200px" },
      );
      io.observe(el);
    },
    [index, eager, registerRef],
  );

  const w = Math.round(CANVAS_W * scale);
  const h = Math.round(CANVAS_H * scale);
  return (
    <button
      data-slot="thumbnail-item"
      ref={setRef}
      type="button"
      onClick={() => onSelect(index)}
      data-theo-slide-deck-thumbnail
      data-current={isCurrent || undefined}
      aria-label={`Slide ${index + 1}`}
      aria-current={isCurrent ? "page" : undefined}
      className="theo-slide-deck-thumbnail"
      style={{
        width: w,
        height: h,
        padding: 0,
        border: isCurrent ? "2px solid currentColor" : "1px solid rgba(127,127,127,0.3)",
        borderRadius: 6,
        overflow: "hidden",
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        background: "transparent",
      }}
    >
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        {revealed ? (
          <DeckSlide markdown={markdown} aria-label={`Thumbnail ${index + 1}`} />
        ) : (
          <div
            data-theo-slide-deck-thumbnail-placeholder
            style={{
              width: "100%",
              height: "100%",
              background: "rgba(127,127,127,0.08)",
            }}
          />
        )}
      </div>
    </button>
  );
};

export const Thumbnails: FC<ThumbnailsProps> = ({ className, scale = 0.18 }) => {
  const { state, dispatch, slides } = useDeckContext();
  const refs = useRef<Map<number, HTMLElement>>(new Map());

  const registerRef = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      refs.current.set(index, el);
    } else {
      refs.current.delete(index);
    }
  }, []);

  const onSelect = useCallback(
    (index: number) => {
      dispatch({ type: "JUMP_TO", index });
    },
    [dispatch],
  );

  // Auto-scroll current into view.
  useEffect(() => {
    const el = refs.current.get(state.currentIndex);
    if (el && "scrollIntoView" in el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [state.currentIndex]);

  // EC-13: eager mode when IO is absent.
  const eagerAll = useMemo(() => typeof IntersectionObserver === "undefined", []);

  return (
    <ul
      data-slot="thumbnails"
      className={["theo-slide-deck-thumbnails", className].filter(Boolean).join(" ")}
      data-theo-slide-deck-thumbnails
      aria-label="Slide thumbnails"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflowY: "auto",
        padding: 8,
        listStyle: "none",
        margin: 0,
      }}
    >
      {slides.map((slide, index) => (
        <li key={`${slide.id ?? index}-${index}`}>
          <ThumbnailItem
            markdown={slide.markdown}
            index={index}
            isCurrent={index === state.currentIndex}
            scale={scale}
            eager={eagerAll || index < 3 /* first 3 always eager for snappy first paint */}
            onSelect={onSelect}
            registerRef={registerRef}
          />
        </li>
      ))}
    </ul>
  );
};
