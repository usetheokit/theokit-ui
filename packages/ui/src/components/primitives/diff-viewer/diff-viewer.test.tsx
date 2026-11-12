import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type DiffHunk, DiffViewer, parseUnifiedDiffToHunks } from "./diff-viewer.js";

const hunks: DiffHunk[] = [
  {
    id: "h1",
    header: "@@ -1,3 +1,3 @@",
    lines: [
      { kind: "unchanged", oldNumber: 1, newNumber: 1, content: "hello" },
      { kind: "removed", oldNumber: 2, content: "old line" },
      { kind: "added", newNumber: 2, content: "new line" },
    ],
  },
  {
    id: "h2",
    lines: [
      { kind: "unchanged", oldNumber: 50, newNumber: 50, content: "" },
      { kind: "unchanged", oldNumber: 51, newNumber: 51, content: "" },
    ],
    collapsed: true,
  },
];

describe("DiffViewer", () => {
  it("renders path and stats", () => {
    render(<DiffViewer path="src/app.ts" stats={{ added: 5, removed: 2 }} hunks={hunks} />);
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.getByText("-2")).toBeInTheDocument();
  });

  it("renders hunk header and added/removed lines", () => {
    render(<DiffViewer path="x" hunks={hunks} />);
    expect(screen.getByText("@@ -1,3 +1,3 @@")).toBeInTheDocument();
    expect(screen.getByText("old line")).toBeInTheDocument();
    expect(screen.getByText("new line")).toBeInTheDocument();
  });

  it("collapses placeholder hunks", () => {
    render(<DiffViewer path="x" hunks={hunks} />);
    expect(screen.getByText(/2 unmodified lines/)).toBeInTheDocument();
  });

  // M3: accept a unified diff string in addition to structured hunks.
  it("renders added/removed lines from a unified diff string", () => {
    render(
      <DiffViewer
        path="x.ts"
        diff={"--- a/x.ts\n+++ b/x.ts\n const a = 1;\n-const b = 2;\n+const b = 3;"}
      />,
    );
    expect(screen.getByText("const b = 3;")).toBeInTheDocument();
    expect(screen.getByText("const b = 2;")).toBeInTheDocument();
  });
});

describe("parseUnifiedDiffToHunks", () => {
  it("maps +/- /context lines to added/removed/unchanged", () => {
    const kinds = parseUnifiedDiffToHunks(" ctx\n+added\n-removed").flatMap((h) =>
      h.lines.map((l) => l.kind),
    );
    expect(kinds).toContain("added");
    expect(kinds).toContain("removed");
    expect(kinds).toContain("unchanged");
  });

  it("starts a new hunk on an @@ header", () => {
    const out = parseUnifiedDiffToHunks("@@ -1,2 +1,2 @@\n ctx\n@@ -5,1 +5,1 @@\n+x");
    expect(out.length).toBe(2);
    expect(out[0]?.header).toContain("@@");
  });

  const GIT_DIFF = `diff --git a/src/x.ts b/src/x.ts
index 1111..2222 100644
--- a/src/x.ts
+++ b/src/x.ts
@@ -40,3 +40,3 @@ fn
 a
-b
+c
`;

  it("reads the @@ offsets and drops the trailing empty line", () => {
    const out = parseUnifiedDiffToHunks(GIT_DIFF);
    expect(out[1]?.lines).toEqual([
      { kind: "unchanged", oldNumber: 40, newNumber: 40, content: "a" },
      { kind: "removed", oldNumber: 41, content: "b" },
      { kind: "added", newNumber: 41, content: "c" },
    ]);
  });

  it("does not render git header lines as unchanged code", () => {
    const lines = parseUnifiedDiffToHunks(GIT_DIFF).flatMap((h) => h.lines);
    expect(
      lines.filter(
        (l) =>
          l.kind === "unchanged" &&
          (l.content.startsWith("diff --git") || l.content.startsWith("index ")),
      ),
    ).toEqual([]);
  });

  it("restarts numbering at each hunk header", () => {
    const out = parseUnifiedDiffToHunks("@@ -1,1 +1,1 @@\n a\n@@ -10,1 +12,1 @@\n b");
    expect(out[0]?.lines[0]).toMatchObject({ oldNumber: 1, newNumber: 1 });
    expect(out[1]?.lines[0]).toMatchObject({ oldNumber: 10, newNumber: 12 });
  });
});
