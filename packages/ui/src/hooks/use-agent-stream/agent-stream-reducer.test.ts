import { describe, expect, it } from "vitest";
import type {
  MessageStreamItem,
  ToolCallStreamItem,
} from "../../components/composites/agent-stream/agent-stream.js";
import { agentStreamReducer, initialAgentStreamState } from "./agent-stream-reducer.js";
import type { SdkStreamMessage } from "./types.js";

/** Fold a sequence of SDK stream messages through the reducer. */
function fold(...msgs: SdkStreamMessage[]) {
  return msgs.reduce(agentStreamReducer, initialAgentStreamState);
}

describe("agentStreamReducer (M5 — SDK stream → AgentStreamItem[])", () => {
  it("accumulates text_delta into a live streaming item", () => {
    const s = fold({ type: "text_delta", text: "Hel" }, { type: "text_delta", text: "lo" });
    expect(s.status).toBe("streaming");
    expect(s.streamingText).toBe("Hello");
    const streaming = s.items.find((i) => i.kind === "streaming");
    expect(streaming).toBeDefined();
    expect((streaming as { partial?: unknown }).partial).toBe("Hello");
  });

  it("finalizes a complete assistant turn into a message item", () => {
    const s = fold(
      { type: "text_delta", text: "Hi" },
      { type: "assistant", message: { content: [{ type: "text", text: "Hi there" }] } },
    );
    const msg = s.items.find((i) => i.kind === "message") as MessageStreamItem | undefined;
    expect(msg).toBeDefined();
    expect(msg?.message.role).toBe("assistant");
    expect(msg?.message.parts[0]).toMatchObject({ type: "text", text: "Hi there" });
    // Streaming buffer cleared after finalization.
    expect(s.streamingText).toBe("");
    expect(s.items.some((i) => i.kind === "streaming")).toBe(false);
  });

  it("upserts a tool_call by call_id (running → success) as ONE item", () => {
    const s = fold(
      { type: "tool_call", call_id: "c1", name: "get_time", status: "running" },
      { type: "tool_call", call_id: "c1", name: "get_time", status: "completed", result: "12:00" },
    );
    const tools = s.items.filter((i) => i.kind === "tool-call") as ToolCallStreamItem[];
    expect(tools).toHaveLength(1);
    expect(tools[0]?.status).toBe("success");
  });

  it("renders a shell-style { stdout } tool result as readable output (not [object Object])", () => {
    const s = fold({
      type: "tool_call",
      call_id: "c9",
      name: "get_current_time",
      status: "completed",
      result: { stdout: "2026-07-03T16:45:31.905Z", stderr: "", exitCode: 0 },
    });
    const tool = s.items.find((i) => i.kind === "tool-call") as ToolCallStreamItem | undefined;
    expect(tool?.output).toBe("2026-07-03T16:45:31.905Z");
  });

  it("maps a tool_call error status to failed", () => {
    const s = fold({ type: "tool_call", call_id: "c2", name: "deploy", status: "error" });
    const tool = s.items.find((i) => i.kind === "tool-call") as ToolCallStreamItem | undefined;
    expect(tool?.status).toBe("failed");
  });

  it("surfaces an error message as an error item + error status", () => {
    const s = fold({ type: "error", error: "boom" });
    expect(s.status).toBe("error");
    expect(s.error?.message).toBe("boom");
    expect(s.items.some((i) => i.kind === "error")).toBe(true);
  });

  it("ignores unknown/structural message types without throwing", () => {
    const s = fold({ type: "system" }, { type: "user" }, { type: "object_delta" });
    expect(s.items).toHaveLength(0);
    expect(s.status).toBe("idle");
  });

  it("marks done and finalizes trailing streamed text on the done sentinel", () => {
    const s = fold({ type: "text_delta", text: "bye" }, { type: "done" });
    expect(s.status).toBe("done");
    const msg = s.items.find((i) => i.kind === "message") as MessageStreamItem | undefined;
    expect(msg?.message.parts[0]).toMatchObject({ type: "text", text: "bye" });
    expect(s.items.some((i) => i.kind === "streaming")).toBe(false);
  });

  it("accumulates the SDK's text-delta into one streaming item", () => {
    const s = fold({ type: "text-delta", text: "He" }, { type: "text-delta", text: "llo" });
    expect(s.items).toEqual([{ kind: "streaming", id: "__streaming__", partial: "Hello" }]);
  });

  it("ignores thinking-delta", () => {
    const s = fold({ type: "thinking-delta", text: "hmm" });
    expect(s).toEqual(initialAgentStreamState);
  });

  it.each(["done", "error"])("fails a running tool when the stream ends with %s", (end) => {
    const s = fold(
      { type: "tool_call", call_id: "c1", name: "ls", status: "running" },
      { type: end, error: "boom" },
    );
    const tool = s.items.find((i) => i.kind === "tool-call") as ToolCallStreamItem;
    expect(tool.status).toBe("failed");
  });

  it("ignores events after done", () => {
    const done = fold({ type: "text-delta", text: "a" }, { type: "done" });
    const after = agentStreamReducer(done, { type: "text-delta", text: "b" });
    expect(after.items).toBe(done.items);
  });
});
