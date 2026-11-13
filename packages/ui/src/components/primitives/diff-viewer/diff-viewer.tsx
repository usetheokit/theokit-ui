import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "../../../lib/cn.js";

export type DiffLineKind = "added" | "removed" | "unchanged" | "meta";

export interface DiffLine {
  kind: DiffLineKind;
  /** Original line number (left side); undefined for added lines. */
  oldNumber?: number;
  /** New line number (right side); undefined for removed lines. */
  newNumber?: number;
  content: string;
}

export interface DiffHunk {
  id: string;
  /**
   * Optional header (e.g. "@@ -42,7 +42,12 @@"). Caller usually formats this.
   */
  header?: string;
  lines: DiffLine[];
  /**
   * If true, the hunk is rendered as a collapsed "N unmodified lines" placeholder.
   */
  collapsed?: boolean;
}

interface DiffViewerProps extends HTMLAttributes<HTMLDivElement> {
  /** Path of the file being diffed. */
  path: string;
  /** Diff stats summary. */
  stats?: { added: number; removed: number };
  /** Structured hunks. Provide this OR `diff` (a unified diff string). */
  hunks?: DiffHunk[];
  /**
   * A raw unified diff string (`+`/`-`/context lines, `@@` hunk headers, optional
   * `+++`/`---` file headers). Parsed into hunks via {@link parseUnifiedDiffToHunks} when `hunks`
   * is not provided. Convenience for callers that already hold a unified diff (e.g. a
   * coding agent's file artifact).
   */
  diff?: string;
}

/**
 * parseUnifiedDiffToHunks — turn a unified diff string into `DiffHunk[]`.
 *
 * `@@` starts a new hunk (kept as its `header`) and its `@@ -a,b +c,d @@` offsets seed the
 * old/new line numbers (`a` and `c`); `+`/`-` become added/removed lines with running numbers.
 * Before the first hunk header, git header lines (`diff --git`, `index`, mode/rename/similarity
 * lines, `---`, `+++`) become `meta` lines; `+++`/`---` stay `meta` inside a hunk. Everything
 * else is an unchanged context line. A trailing newline and `\ No newline at end of file` are
 * ignored. Input with no `@@` header numbers lines from 1.
 */
const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const GIT_HEADER_PREFIXES = [
  "diff --git",
  "index ",
  "new file mode",
  "deleted file mode",
  "similarity",
  "rename ",
  "---",
  "+++",
];

export function parseUnifiedDiffToHunks(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let seenHunk = false;
  let oldNumber = 1;
  let newNumber = 1;
  const ensureHunk = (): DiffHunk => {
    if (!current) {
      current = { id: String(hunks.length), lines: [] };
      hunks.push(current);
    }
    return current;
  };
  const rows = diff.split("\n");
  if (rows[rows.length - 1] === "") rows.pop();
  for (const line of rows) {
    if (line.startsWith("@@")) {
      seenHunk = true;
      current = { id: String(hunks.length), header: line, lines: [] };
      hunks.push(current);
      const m = HUNK_HEADER.exec(line);
      if (m) {
        oldNumber = Number(m[1]);
        newNumber = Number(m[2]);
      }
      continue;
    }
    if (line.startsWith("\\")) continue;
    if (
      line.startsWith("+++") ||
      line.startsWith("---") ||
      (!seenHunk && GIT_HEADER_PREFIXES.some((p) => line.startsWith(p)))
    ) {
      ensureHunk().lines.push({ kind: "meta", content: line });
      continue;
    }
    if (line.startsWith("+")) {
      ensureHunk().lines.push({ kind: "added", newNumber: newNumber++, content: line.slice(1) });
      continue;
    }
    if (line.startsWith("-")) {
      ensureHunk().lines.push({ kind: "removed", oldNumber: oldNumber++, content: line.slice(1) });
      continue;
    }
    ensureHunk().lines.push({
      kind: "unchanged",
      oldNumber: oldNumber++,
      newNumber: newNumber++,
      content: line.startsWith(" ") ? line.slice(1) : line,
    });
  }
  return hunks;
}

const lineBg: Record<DiffLineKind, string> = {
  added: "bg-success/10",
  removed: "bg-destructive/10",
  unchanged: "",
  meta: "bg-muted/60 text-primary",
};

const sign: Record<DiffLineKind, string> = {
  added: "+",
  removed: "-",
  unchanged: " ",
  meta: "@",
};

/**
 * DiffViewer — unified diff rendering, no external dep.
 *
 * Visual: two gutter columns (old/new line numbers) + sign + monospaced content.
 * Added/removed rows tinted in success/destructive. Collapsed hunks render as
 * a single muted row "N unmodified lines".
 *
 * For syntax highlighting, the consumer can render `content` via their own
 * highlighter and pass `unchanged` lines with already-highlighted strings (not
 * common; usually plain text is enough for the brutalist console aesthetic).
 */
const DiffViewer = forwardRef<HTMLDivElement, DiffViewerProps>(
  ({ className, path, stats, hunks, diff, ...props }, ref) => {
    const resolvedHunks = hunks ?? (diff != null ? parseUnifiedDiffToHunks(diff) : []);
    return (
      <div
        data-slot="diff-viewer"
        ref={ref}
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-card font-mono",
          className,
        )}
        {...props}
      >
        <header className="flex items-center justify-between gap-3 border-border/40 border-b bg-muted/30 px-3 py-2">
          <span className="truncate text-code-sm text-foreground">{path}</span>
          {stats ? (
            <span className="font-mono text-code-sm">
              <span className="text-success">+{stats.added}</span>{" "}
              <span className="text-destructive">-{stats.removed}</span>
            </span>
          ) : null}
        </header>
        <ol className="text-code-sm">
          {resolvedHunks.map((hunk) => (
            <li key={hunk.id}>
              {hunk.collapsed ? (
                <div className="px-3 py-1 text-muted-foreground italic">
                  {hunk.lines.length} unmodified lines
                </div>
              ) : (
                <>
                  {hunk.header ? (
                    <div className="bg-muted/60 px-3 py-1 text-primary">{hunk.header}</div>
                  ) : null}
                  <table className="w-full border-collapse" aria-label={`Diff hunk for ${path}`}>
                    <tbody>
                      {hunk.lines.map((line, idx) => (
                        <tr key={`${hunk.id}-${idx}`} className={lineBg[line.kind]}>
                          <td className="select-none px-2 text-right text-muted-foreground/60 tabular-nums">
                            {line.oldNumber ?? ""}
                          </td>
                          <td className="select-none px-2 text-right text-muted-foreground/60 tabular-nums">
                            {line.newNumber ?? ""}
                          </td>
                          <td
                            className={cn(
                              "select-none pr-1 pl-2",
                              line.kind === "added" && "text-success",
                              line.kind === "removed" && "text-destructive",
                              line.kind === "meta" && "text-primary",
                            )}
                          >
                            {sign[line.kind]}
                          </td>
                          <td
                            className={cn(
                              "w-full whitespace-pre",
                              line.kind === "added" && "text-success",
                              line.kind === "removed" && "text-destructive",
                            )}
                          >
                            {line.content}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  },
);
DiffViewer.displayName = "DiffViewer";

export { DiffViewer };
