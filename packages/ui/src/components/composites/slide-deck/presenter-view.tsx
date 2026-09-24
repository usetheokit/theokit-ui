"use client";

/**
 * `<SlideDeck.PresenterView>` — inline split-screen panel.
 *
 * Pragmatic v0.4 scope: renders an in-page panel (current slide + next slide +
 * speaker notes + timer) when `state.presenterMode === true`. The separate
 * window via `window.open` + `BroadcastChannel` is deferred to v0.5 (consumer
 * demand will trigger the upgrade — D6 of the plan is reduced to inline panel).
 *
 * Toggling presenter mode is dispatched via hotkey (n/N/p/P, see useDeckKeyboard).
 */
import { type FC, useEffect, useRef, useState } from "react";
import { Slide } from "../../primitives/slide/index.js";
import { useDeckContext } from "./context.js";

export interface PresenterViewProps {
  className?: string;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export const PresenterView: FC<PresenterViewProps> = ({ className }) => {
  const { state, slides, plugins } = useDeckContext();
  const startedAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Initialize the timer when presenter mode first opens; reset when closed.
  useEffect(() => {
    if (state.presenterMode) {
      if (startedAt.current === null) {
        startedAt.current = Date.now();
      }
      const interval = window.setInterval(() => {
        if (startedAt.current !== null) {
          setElapsed(Date.now() - startedAt.current);
        }
      }, 1000);
      return () => window.clearInterval(interval);
    }
    startedAt.current = null;
    setElapsed(0);
    return undefined;
  }, [state.presenterMode]);

  if (!state.presenterMode) return null;

  const current = slides[state.currentIndex];
  const next = slides[state.currentIndex + 1];
  const notes = current?.notes;

  return (
    <aside
      className={["theo-slide-deck-presenter", className].filter(Boolean).join(" ")}
      data-theo-slide-deck-presenter
      aria-label="Presenter view"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "auto 1fr",
        gap: 16,
        padding: 16,
        background: "color-mix(in srgb, currentColor 6%, transparent)",
        borderRadius: 8,
      }}
    >
      <header
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Presenter view</h3>
        <span
          aria-label="Elapsed time"
          style={{ fontVariantNumeric: "tabular-nums", fontSize: 14 }}
        >
          {formatElapsed(elapsed)}
        </span>
      </header>
      <section aria-label="Current slide preview">
        <h4 style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.7 }}>Current</h4>
        <div
          style={{
            aspectRatio: "16 / 9",
            overflow: "hidden",
            border: "1px solid rgba(127,127,127,0.3)",
            borderRadius: 6,
          }}
        >
          {current ? (
            <Slide markdown={current.markdown} plugins={plugins} aria-label="Current slide" />
          ) : null}
        </div>
      </section>
      <section aria-label="Next slide preview">
        <h4 style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.7 }}>Next</h4>
        <div
          style={{
            aspectRatio: "16 / 9",
            overflow: "hidden",
            border: "1px solid rgba(127,127,127,0.3)",
            borderRadius: 6,
            opacity: next ? 1 : 0.4,
          }}
        >
          {next ? (
            <Slide markdown={next.markdown} plugins={plugins} aria-label="Next slide" />
          ) : (
            <div style={{ padding: 16, fontSize: 14, opacity: 0.6 }}>End of deck</div>
          )}
        </div>
      </section>
      {notes ? (
        <section
          aria-label="Speaker notes"
          style={{
            gridColumn: "1 / -1",
            background: "color-mix(in srgb, currentColor 8%, transparent)",
            padding: 12,
            borderRadius: 6,
            fontSize: 14,
            whiteSpace: "pre-wrap",
          }}
        >
          <strong>Notes: </strong>
          {notes}
        </section>
      ) : null}
    </aside>
  );
};
