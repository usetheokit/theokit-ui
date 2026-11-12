import { CodeBlock } from "@usetheo/ui";
import { DataTable } from "@usetheo/ui";
/**
 * `<AgentToolRenderer>` + the tool-renderer **registry** (M5-3).
 *
 * Dispatches a `ToolUIPart` to a rich renderer by classification kind
 * (`diff` / `terminal` / `code` / `created-files` / `data-table`), falling back
 * to `<ToolCallPart>` for anything unmapped. Mirrors the existing
 * `partRenderers` / `dataRenderers` override registries on `<ChatMessage>` — the
 * registry is prop-threaded, no React context (ADR D2).
 *
 * The default renderers are **defensive best-effort** (ADR D3): `code` and
 * `terminal` are generic over any string output; `diff` / `created-files` /
 * `data-table` render their rich primitive only when the output already matches
 * the structured shape, else they degrade to `<ToolCallPart>` (never throw on
 * `unknown`). Faithful sdk-tools `ToolUIPart`→props adapters are the M5-4 slice
 * (`@theokit/ui/sdk-tools-adapters`).
 */
import type { JSX, ReactNode } from "react";
import {
  adaptApplyPatchResult,
  adaptGitDiffResult,
  adaptListDirResult,
  adaptReadFileResult,
  adaptShellResult,
} from "../../../lib/sdk-tools-adapters/sdk-tools-adapters.js";
import type { ToolUIPart } from "../../../types/chat.js";
import { CreatedFilesCard } from "../../primitives/created-files-card/index.js";
import { type DiffHunk, DiffViewer } from "../../primitives/diff-viewer/index.js";
import { type TerminalLine, TerminalPanel } from "../../primitives/terminal-panel/index.js";
import { ToolCallPart } from "./tool-call-part.js";

/** The rich surfaces a tool invocation can be dispatched to. */
export type ToolRendererKind = "diff" | "terminal" | "code" | "created-files" | "data-table";

/** A renderer for one tool invocation. Returns `ReactNode` (never throws). */
export type ToolRenderer = (part: ToolUIPart) => ReactNode;

/** Registry of renderers keyed by classification kind. */
export type ToolRendererRegistry = Record<ToolRendererKind, ToolRenderer>;

/** Maps a tool part to a kind, or `undefined` to fall back to `<ToolCallPart>`. */
export type ClassifyTool = (part: ToolUIPart) => ToolRendererKind | undefined;

/* ─── classify ───────────────────────────────────────────────────────── */

function deriveToolName(part: ToolUIPart): string {
  if (part.toolName) return part.toolName;
  if (part.type === "dynamic-tool") return "dynamic-tool";
  return part.type.slice("tool-".length);
}

// Exact tool names first: the SDK's own tools.
const EXACT_KINDS: Readonly<Record<string, ToolRendererKind>> = {
  shell_exec: "terminal",
  shell: "terminal",
  git_diff: "diff",
  apply_patch: "diff",
  read_file: "code",
  list_dir: "data-table",
};

// Substring heuristics over the tool name, matched on word boundaries only.
// Ordered: most specific first.
const KIND_HINTS: ReadonlyArray<[ToolRendererKind, readonly string[]]> = [
  ["diff", ["diff", "patch"]],
  ["created-files", ["edit_file", "write_file", "create_file", "created_file"]],
  ["terminal", ["shell", "bash", "exec", "run_", "command", "vitest", "pytest"]],
  ["data-table", ["list_dir", "glob", "list_", "search", "grep", "find"]],
  ["code", ["read_file", "cat_file", "code", "read"]],
];

function hasHint(name: string, hint: string): boolean {
  const re = new RegExp(`(^|[_.-])${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[_.-])`);
  // A hint ending in "_" already carries its own trailing boundary.
  return hint.endsWith("_") ? new RegExp(`(^|[_.-])${hint}`).test(name) : re.test(name);
}

/**
 * Default classifier — an exact-name table, then name hints matched on word
 * boundaries (`_`, `-`, `.`, start, end). Only affects the default; fully
 * overridable per call (ADR D1/D2). Never throws; unmapped → `undefined`.
 */
export function defaultClassifyTool(part: ToolUIPart): ToolRendererKind | undefined {
  const name = deriveToolName(part).toLowerCase();
  const exact = Object.hasOwn(EXACT_KINDS, name) ? EXACT_KINDS[name] : undefined;
  if (exact) return exact;
  for (const [kind, hints] of KIND_HINTS) {
    if (hints.some((h) => hasHint(name, h))) return kind;
  }
  return undefined;
}

/**
 * Resolve the renderer for a part: `classify` → registry lookup. Returns
 * `undefined` when the tool is unmapped (the `<ToolCallPart>` fallback signal).
 */
export function resolveToolRenderer(
  registry: ToolRendererRegistry,
  classify: ClassifyTool,
  part: ToolUIPart,
): ToolRenderer | undefined {
  const kind = classify(part);
  return kind ? registry[kind] : undefined;
}

/* ─── shape helpers (defensive) ──────────────────────────────────────── */

function stringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStructuredDiff(
  o: unknown,
): o is { path: string; stats?: { added: number; removed: number }; hunks: DiffHunk[] } {
  return isRecord(o) && typeof o.path === "string" && Array.isArray(o.hunks);
}

function isStructuredFiles(
  o: unknown,
): o is { title?: ReactNode; files: Array<{ id: string; name: string }> } {
  return (
    isRecord(o) &&
    Array.isArray(o.files) &&
    o.files.every((f) => isRecord(f) && typeof f.id === "string" && typeof f.name === "string")
  );
}

function isObjectRows(o: unknown): o is Array<Record<string, unknown>> {
  return Array.isArray(o) && o.length > 0 && o.every(isRecord);
}

function toTerminalLines(output: unknown): TerminalLine[] {
  return stringify(output)
    .split(/\r?\n/)
    .map((content, i) => ({ id: `line-${i}`, kind: "stdout" as const, content }));
}

function inputPath(part: ToolUIPart): string | undefined {
  const input: unknown = part.input;
  if (isRecord(input) && typeof input.path === "string") return input.path;
  return undefined;
}

function renderDataTable(rows: Array<Record<string, unknown>>): JSX.Element {
  const columns = Object.keys(rows[0] ?? {}).map((key) => ({
    key,
    label: key,
    render: (row: Record<string, unknown>) => stringify(row[key]),
  }));
  return <DataTable data={rows} columns={columns} rowKey={(row) => stringify(row)} />;
}

/* ─── default registry ───────────────────────────────────────────────── */

export const defaultToolRegistry: ToolRendererRegistry = {
  code: (part) => {
    const adapted = adaptReadFileResult(part.output, inputPath(part));
    return adapted ? (
      <CodeBlock code={adapted.code} language={adapted.language} copyable />
    ) : (
      <CodeBlock code={stringify(part.output)} copyable />
    );
  },
  terminal: (part) => (
    <TerminalPanel lines={adaptShellResult(part.output) ?? toTerminalLines(part.output)} />
  ),
  diff: (part) => {
    const adapted = adaptGitDiffResult(part.output, inputPath(part));
    if (adapted)
      return <DiffViewer path={adapted.path} stats={adapted.stats} hunks={adapted.hunks} />;
    return isStructuredDiff(part.output) ? (
      <DiffViewer path={part.output.path} stats={part.output.stats} hunks={part.output.hunks} />
    ) : (
      <ToolCallPart part={part} />
    );
  },
  "created-files": (part) => {
    const adapted = adaptApplyPatchResult(part.output);
    if (adapted) return <CreatedFilesCard files={adapted.files} />;
    return isStructuredFiles(part.output) ? (
      <CreatedFilesCard files={part.output.files} title={part.output.title} />
    ) : (
      <ToolCallPart part={part} />
    );
  },
  "data-table": (part) => {
    const adapted = adaptListDirResult(part.output);
    if (adapted && adapted.rows.length > 0) return renderDataTable(adapted.rows);
    return isObjectRows(part.output) ? renderDataTable(part.output) : <ToolCallPart part={part} />;
  },
};

/* ─── component ──────────────────────────────────────────────────────── */

export interface AgentToolRendererProps {
  part: ToolUIPart;
  /** Override the default registry (shallow-merge over `defaultToolRegistry`). */
  toolRenderers?: ToolRendererRegistry;
  /** Override the default classifier. */
  classifyTool?: ClassifyTool;
}

/**
 * Render one `ToolUIPart` through the registry, falling back to `<ToolCallPart>`
 * when the tool is unmapped. Reusable outside `<ChatMessage>`.
 *
 * Rich renderers apply ONLY to the `output-available` state — they render
 * `part.output`. Every other state (`input-streaming` / `input-available` /
 * `approval-*` / `output-error` / `output-denied`) carries no output (and, for
 * errors, only `errorText`), so it routes to `<ToolCallPart>`, which renders the
 * state badge, the input, and the error. This prevents a classified-but-errored
 * tool (e.g. a `shell` that failed) from rendering an empty rich surface and
 * dropping the error message.
 */
export function AgentToolRenderer({
  part,
  toolRenderers = defaultToolRegistry,
  classifyTool = defaultClassifyTool,
}: AgentToolRendererProps): JSX.Element {
  const renderer =
    part.state === "output-available"
      ? resolveToolRenderer(toolRenderers, classifyTool, part)
      : undefined;
  // `display: contents` wrapper — carries the data-slot (shadcn v4 convention)
  // without introducing a layout box around the resolved renderer.
  return (
    <div data-slot="agent-tool-renderer" className="contents">
      {renderer ? renderer(part) : <ToolCallPart part={part} />}
    </div>
  );
}

AgentToolRenderer.displayName = "AgentToolRenderer";
