/**
 * Structural mirror of the `@theokit/sdk` `SDKMessage` stream surface — the
 * fields `useAgentStream` reads. Declared locally so theo-ui keeps ZERO runtime
 * coupling to `@theokit/sdk` (M5 ADR-1): the SDK's real `Run.stream()` /
 * `subscribe()` output is structurally assignable to this permissive shape, and
 * so is a plain mock or any non-SDK source. `@theokit/sdk` is not a dependency
 * of this package at all — neither runtime nor dev.
 *
 * Covers both granularities the Harness emits:
 * - coarse `assistant` turns from `Run.stream()` (complete `content`),
 * - fine `text-delta` frames (the SDK's name) from `onDelta` / `Run.events()`; `text_delta` is a
 *   legacy alias still accepted. `thinking-delta` (reasoning) is accepted and ignored.
 */
export interface SdkStreamMessage {
  /** Discriminator: "text-delta" | "text_delta" (legacy) | "thinking-delta" | "assistant" | "tool_call" | "thinking" | "error" | "done" | … (others ignored). */
  readonly type: string;
  /** Fine-grained token text (`text-delta` / legacy `text_delta`) or reasoning text (`thinking-delta` / `thinking`). */
  readonly text?: string;
  /** Complete assistant turn (`assistant`): the model's content blocks. */
  readonly message?: {
    readonly content?: ReadonlyArray<{ readonly type?: string; readonly text?: string }>;
  };
  /** Tool lifecycle (`tool_call`). */
  readonly call_id?: string;
  readonly name?: string;
  /** Tool status as emitted by the SDK: "running" | "completed" | "error". */
  readonly status?: string;
  readonly result?: unknown;
  /** Error surface (`error`). */
  readonly error?: string | { readonly message?: string };
}

/** Live consumption status of an agent stream. */
export type AgentStreamStatus = "idle" | "streaming" | "done" | "error";
