/**
 * Pure mapping core for {@link useAgentStream}: folds an SDK stream message into
 * the render state consumed by `<AgentStream items={…} />`. No React, no I/O, no
 * `@theokit/sdk` import — exhaustively unit-testable (M5 T1.1).
 *
 * Handles both stream granularities:
 * - `text-delta` (the SDK's name) / `text_delta` (legacy alias) — append to the live buffer,
 * - `thinking-delta` — no-op: this reducer has no reasoning item,
 * - `assistant` — finalize the complete turn into a message item,
 * - `tool_call` — upsert a tool-call item keyed by `call_id`,
 * - `error` — surface an error item,
 * - `done` — finalize any trailing streamed text and mark the stream complete.
 *
 * `done` and `error` are terminal: tools still `running` become `failed` and later events are
 * ignored (a new stream resets state).
 *
 * Any other `type` (system/user/thinking/status/task/request/object_delta) is
 * ignored without throwing — forward-compatible with new SDK message types.
 */
import type {
  AgentStreamItem,
  MessageStreamItem,
  ToolCallStreamItem,
} from "../../components/composites/agent-stream/agent-stream.js";
import type { ToolCallStatus } from "../../components/primitives/tool-call-card/index.js";
import type { UIMessage } from "../../types/chat.js";
import type { AgentStreamStatus, SdkStreamMessage } from "./types.js";

export interface AgentStreamState {
  readonly items: AgentStreamItem[];
  readonly streamingText: string;
  readonly status: AgentStreamStatus;
  readonly error?: Error;
  /** Monotonic finalized-message counter — kept in state so the reducer stays pure. */
  readonly seq: number;
}

export const initialAgentStreamState: AgentStreamState = {
  items: [],
  streamingText: "",
  status: "idle",
  seq: 0,
};

const STREAMING_ID = "__streaming__";

function mapToolStatus(status: string | undefined): ToolCallStatus {
  if (status === "completed") return "success";
  if (status === "error") return "failed";
  return "running";
}

function errorToMessage(error: SdkStreamMessage["error"]): string {
  if (typeof error === "string") return error;
  return error?.message ?? "Agent stream error";
}

/** Drop the transient streaming item (rebuilt from `streamingText` each step). */
function withoutStreaming(items: AgentStreamItem[]): AgentStreamItem[] {
  return items.filter((i) => !(i.kind === "streaming" && i.id === STREAMING_ID));
}

/**
 * Finalize buffered text into a message item (dropping the streaming item).
 * Returns the new items + the next `seq`; pure — the id derives from `seq`.
 */
function finalizeText(
  items: AgentStreamItem[],
  text: string,
  seq: number,
): { items: AgentStreamItem[]; seq: number } {
  const base = withoutStreaming(items);
  if (text.length === 0) return { items: base, seq };
  const id = `msg-${seq + 1}`;
  const message: UIMessage = {
    id,
    role: "assistant",
    parts: [{ type: "text", text, state: "done" }],
  };
  const item: MessageStreamItem = { kind: "message", id, message };
  return { items: [...base, item], seq: seq + 1 };
}

/**
 * Render a tool `result` for display. The Harness wraps a tool handler's return
 * in a shell-style `{ stdout, stderr, exitCode }` envelope, so a naive
 * `String(result)` yields "[object Object]". Extract the human-readable output:
 * a string as-is; `{ stdout }` (with `stderr` appended when present); an
 * `{ output }` / `{ text }` field; else a compact JSON fallback.
 */
function renderToolResult(result: unknown): string {
  if (typeof result === "string") return result;
  if (result !== null && typeof result === "object") {
    const r = result as { stdout?: unknown; stderr?: unknown; output?: unknown; text?: unknown };
    if (typeof r.stdout === "string" && r.stdout.length > 0) {
      return typeof r.stderr === "string" && r.stderr.length > 0
        ? `${r.stdout}\n${r.stderr}`
        : r.stdout;
    }
    if (typeof r.output === "string") return r.output;
    if (typeof r.text === "string") return r.text;
    try {
      return JSON.stringify(result);
    } catch {
      return String(result);
    }
  }
  return String(result);
}

/** Upsert a tool-call item by `call_id` (running → success/failed same slot). */
function upsertToolCall(items: AgentStreamItem[], msg: SdkStreamMessage): AgentStreamItem[] {
  const id = msg.call_id ?? "tool";
  const item: ToolCallStreamItem = {
    kind: "tool-call",
    id,
    tool: msg.name ?? "tool",
    status: mapToolStatus(msg.status),
    ...(msg.result !== undefined ? { output: renderToolResult(msg.result) } : {}),
  };
  const idx = items.findIndex((i) => i.kind === "tool-call" && i.id === id);
  if (idx === -1) return [...items, item];
  const next = items.slice();
  next[idx] = item;
  return next;
}

/** Extract the concatenated text of an assistant turn's `content` blocks. */
function assistantText(msg: SdkStreamMessage): string {
  const content = msg.message?.content ?? [];
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text ?? "")
    .join("");
}

/** A run that ended can no longer finish its tools: close the ones still running. */
function failRunningTools(items: AgentStreamItem[]): AgentStreamItem[] {
  return items.map((i) =>
    i.kind === "tool-call" && i.status === "running" ? { ...i, status: "failed" } : i,
  );
}

/** Internal action: an SDK message, or a reset to the empty state (new source). */
export type AgentStreamAction = SdkStreamMessage | { readonly type: "reset" };

export function agentStreamReducer(
  state: AgentStreamState,
  msg: AgentStreamAction,
): AgentStreamState {
  if (msg.type === "reset") return initialAgentStreamState;
  if (state.status === "done" || state.status === "error") return state;
  switch (msg.type) {
    case "thinking-delta":
      // No reasoning item in this reducer yet; ignore.
      return state;
    case "text-delta":
    case "text_delta": {
      const streamingText = state.streamingText + (msg.text ?? "");
      const item: AgentStreamItem = { kind: "streaming", id: STREAMING_ID, partial: streamingText };
      return {
        ...state,
        streamingText,
        status: "streaming",
        items: [...withoutStreaming(state.items), item],
      };
    }
    case "assistant": {
      const text = assistantText(msg) || state.streamingText;
      const next = finalizeText(state.items, text, state.seq);
      return { ...state, streamingText: "", status: "streaming", items: next.items, seq: next.seq };
    }
    case "tool_call": {
      return {
        ...state,
        status: "streaming",
        items: upsertToolCall(withoutStreaming(state.items), msg),
      };
    }
    case "error": {
      const message = errorToMessage(msg.error);
      const item: AgentStreamItem = {
        kind: "error",
        id: `err-${state.items.length}`,
        title: message,
      };
      return {
        ...state,
        status: "error",
        error: new Error(message),
        items: [...failRunningTools(withoutStreaming(state.items)), item],
      };
    }
    case "done": {
      const next = finalizeText(state.items, state.streamingText, state.seq);
      return {
        ...state,
        streamingText: "",
        status: "done",
        items: failRunningTools(next.items),
        seq: next.seq,
      };
    }
    default:
      return state;
  }
}
