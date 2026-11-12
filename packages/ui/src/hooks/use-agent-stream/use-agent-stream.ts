/**
 * `useAgentStream` (M5 UI ↔ Harness) — consume an SDK agent stream and expose
 * render state for `<AgentStream items={…} />`. Transport-agnostic: pass a
 * `Run.stream()` async iterable (local) or a `subscribe()` iterable (browser,
 * reconnect + `lastEventId` resume shipped SDK-side). theo-ui keeps ZERO runtime
 * coupling to `@theokit/sdk` — the input is the structural {@link SdkStreamMessage}
 * (the SDK's real output is structurally assignable). See M5 ADR-1/ADR-2.
 *
 * The heavy lifting is the pure {@link agentStreamReducer}; this hook only wires
 * the async iterator into a React lifecycle and cancels it on unmount (calls the
 * iterator's `return()` so the underlying generator / connection is torn down).
 */
import { useEffect, useReducer } from "react";
import {
  type AgentStreamState,
  agentStreamReducer,
  initialAgentStreamState,
} from "./agent-stream-reducer.js";
import type { SdkStreamMessage } from "./types.js";

/**
 * `source` is an `AsyncIterable` or a factory returning one. A new `source` identity resets the
 * state to empty. A bare `AsyncIterable` cannot survive React StrictMode's double mount (the first
 * cleanup calls `return()` on it, and a returned generator cannot restart), so prefer a factory;
 * it is called once per mount and must have a stable identity (module-level or `useCallback`).
 */
export function useAgentStream(
  source: AsyncIterable<SdkStreamMessage> | (() => AsyncIterable<SdkStreamMessage>) | undefined,
): AgentStreamState {
  const [state, dispatch] = useReducer(agentStreamReducer, initialAgentStreamState);

  useEffect(() => {
    if (source === undefined) {
      dispatch({ type: "reset" });
      return;
    }
    const iterable = typeof source === "function" ? source() : source;
    const iterator = iterable[Symbol.asyncIterator]();
    let cancelled = false;
    // Drop the previous source's state right before this source's first event, so a source that
    // is replaced mid-flight never mixes its items with the old ones.
    let fresh = true;
    const send = (action: Parameters<typeof dispatch>[0]) => {
      if (fresh) {
        fresh = false;
        dispatch({ type: "reset" });
      }
      dispatch(action);
    };

    void (async () => {
      try {
        while (true) {
          const { value, done } = await iterator.next();
          if (cancelled) return;
          if (done) {
            send({ type: "done" });
            return;
          }
          send(value);
        }
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : String(cause);
        send({ type: "error", error: message });
      }
    })();

    return () => {
      cancelled = true;
      // Tear down the source generator / connection promptly on unmount.
      void iterator.return?.(undefined);
    };
  }, [source]);

  return state;
}
