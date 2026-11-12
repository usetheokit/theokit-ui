import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import type { SdkStreamMessage } from "./types.js";
import { useAgentStream } from "./use-agent-stream.js";

/** A controllable async iterable that yields queued messages, then hangs until
 * `return()` is called — lets a test assert prompt cancellation on unmount. */
function controllableStream(msgs: SdkStreamMessage[]) {
  let returned = false;
  const iterable: AsyncIterable<SdkStreamMessage> = {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < msgs.length) return { value: msgs[i++] as SdkStreamMessage, done: false };
          // Hang until cancelled (unmount calls return()).
          await new Promise<void>((resolve) => {
            const t = setInterval(() => {
              if (returned) {
                clearInterval(t);
                resolve();
              }
            }, 5);
          });
          return { value: undefined as unknown as SdkStreamMessage, done: true };
        },
        async return() {
          returned = true;
          return { value: undefined as unknown as SdkStreamMessage, done: true };
        },
      };
    },
  };
  return { iterable, wasReturned: () => returned };
}

/** A finite async generator (completes → hook dispatches `done`). */
async function* finiteStream(msgs: SdkStreamMessage[]): AsyncGenerator<SdkStreamMessage> {
  for (const m of msgs) yield m;
}

function assistantMsg(text: string): SdkStreamMessage {
  return { type: "assistant", message: { content: [{ type: "text", text }] } };
}

describe("useAgentStream (M5 — React hook)", () => {
  it("starts from an empty state when the source changes", async () => {
    const a = finiteStream([assistantMsg("a")]);
    const b = finiteStream([assistantMsg("b")]);
    const { result, rerender } = renderHook(({ s }) => useAgentStream(s), {
      initialProps: { s: a },
    });
    await waitFor(() => expect(result.current.status).toBe("done"));
    rerender({ s: b });
    await waitFor(() => {
      expect(result.current.status).toBe("done");
      expect(JSON.stringify(result.current.items)).toContain("b");
    });
    expect(result.current.items).toHaveLength(1);
    expect(JSON.stringify(result.current.items)).not.toContain('"a"');
  });

  it("survives StrictMode with a factory source", async () => {
    const factory = () => finiteStream([assistantMsg("x")]);
    const { result } = renderHook(() => useAgentStream(factory), {
      wrapper: StrictMode,
    });
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.items).toHaveLength(1);
    expect(JSON.stringify(result.current.items)).toContain("x");
  });

  it("renders streamed text from a mock stream", async () => {
    const stream = finiteStream([
      { type: "text_delta", text: "Hel" },
      { type: "text_delta", text: "lo" },
    ]);
    const { result } = renderHook(() => useAgentStream(stream));
    await waitFor(() => {
      const msg = result.current.items.find((i) => i.kind === "message");
      expect(msg).toBeDefined();
    });
    expect(result.current.status).toBe("done");
    const msg = result.current.items.find((i) => i.kind === "message") as
      | { message: { parts: Array<{ text?: string }> } }
      | undefined;
    expect(msg?.message.parts[0]?.text).toBe("Hello");
  });

  it("surfaces tool events live", async () => {
    const stream = finiteStream([
      { type: "tool_call", call_id: "c1", name: "get_time", status: "running" },
      { type: "tool_call", call_id: "c1", name: "get_time", status: "completed", result: "12:00" },
    ]);
    const { result } = renderHook(() => useAgentStream(stream));
    await waitFor(() => {
      expect(result.current.items.some((i) => i.kind === "tool-call")).toBe(true);
    });
    const tool = result.current.items.find((i) => i.kind === "tool-call") as
      | { status?: string }
      | undefined;
    expect(tool?.status).toBe("success");
  });

  it("sets error status when the stream throws", async () => {
    async function* boom(): AsyncGenerator<SdkStreamMessage> {
      yield { type: "text_delta", text: "x" };
      throw new Error("stream failed");
    }
    const { result } = renderHook(() => useAgentStream(boom()));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toBe("stream failed");
  });

  it("cancels the source iterator on unmount", async () => {
    const { iterable, wasReturned } = controllableStream([{ type: "text_delta", text: "hi" }]);
    const { result, unmount } = renderHook(() => useAgentStream(iterable));
    await waitFor(() => expect(result.current.streamingText).toBe("hi"));
    act(() => unmount());
    await waitFor(() => expect(wasReturned()).toBe(true));
  });
});
