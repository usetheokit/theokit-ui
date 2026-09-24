import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { parseSlide } from "../../parse.js";
import { MermaidDiagram, mermaidPlugin } from "./index.js";

describe("mermaidPlugin (T8.1)", () => {
  it("returns plugin object with name 'mermaid'", () => {
    const plugin = mermaidPlugin();
    expect(plugin.name).toBe("mermaid");
    expect(plugin.sanitizeSchemaExtension).toBeDefined();
    expect(plugin.components).toBeDefined();
  });

  it("sanitizeSchemaExtension covers ≥30 SVG tags (EC-4)", () => {
    const plugin = mermaidPlugin();
    const ext = plugin.sanitizeSchemaExtension;
    expect(ext?.tagNames?.length ?? 0).toBeGreaterThanOrEqual(30);
    for (const tag of [
      "svg",
      "g",
      "path",
      "rect",
      "circle",
      "ellipse",
      "line",
      "polygon",
      "text",
      "tspan",
      "marker",
      "defs",
      "foreignObject",
      "linearGradient",
      "stop",
    ]) {
      expect(ext?.tagNames).toContain(tag);
    }
  });

  it("sanitizeSchemaExtension declares svg viewBox + path d attributes (EC-4)", () => {
    const plugin = mermaidPlugin();
    const ext = plugin.sanitizeSchemaExtension;
    expect(ext?.attributes?.svg).toContain("viewBox");
    expect(ext?.attributes?.path).toContain("d");
    expect(ext?.attributes?.rect).toContain("width");
  });

  it("hastTransform converts <pre><code class='language-mermaid'> into <theo-mermaid> (T8.1)", async () => {
    const md = "```mermaid\ngraph TD\nA-->B\n```";
    const result = await parseSlide(md, { plugins: [mermaidPlugin()] });
    const json = JSON.stringify(result.tree);
    // The hastTransform replaced <pre> with <theo-mermaid source="...">.
    expect(json).toContain("theo-mermaid");
    // The Mermaid source should be preserved in the props (via React's custom-element-aware rendering).
    // Note: hast-util-to-jsx-runtime may stringify the source onto the element.
  });

  it("non-mermaid code blocks unchanged", async () => {
    const md = "```ts\nconst x = 1;\n```";
    const result = await parseSlide(md, { plugins: [mermaidPlugin()] });
    const json = JSON.stringify(result.tree);
    expect(json).not.toContain("theo-mermaid");
    expect(json).toContain("language-ts");
  });

  it("MermaidDiagram SSR renders placeholder with role=img + aria-label (EC-10)", () => {
    const { container } = render(<MermaidDiagram source="graph TD\nA-->B" />);
    const host = container.querySelector("[data-theo-slide-mermaid]");
    expect(host).toBeTruthy();
    expect(host?.getAttribute("role")).toBe("img");
    expect(host?.getAttribute("aria-label")).toBeTruthy();
    // Source code shown as fallback during loading.
    expect(container.querySelector("pre")?.textContent).toContain("graph TD");
  });

  it("MermaidDiagram error fallback (EC-10) — invalid Mermaid surfaces 'render failed'", async () => {
    // With mermaid INSTALLED (auto-install-peers), invalid Mermaid syntax hits
    // the parse error path; the host enters data-state="error" + aria-label
    // reflects the error message. Source code stays visible as fallback.
    //
    // The cold dynamic import is paid HERE, before the assertion window opens.
    //
    // The component's effect does `await import("mermaid")` — mermaid 11.x plus its
    // transitive graph, through vite's transform pipeline — and that cost used to land
    // inside the `waitFor` below, whose budget is the 5000ms `asyncUtilTimeout` set in
    // src/test/setup.ts. Measured over eight full-suite runs on a loaded machine, this case
    // took 3354 / 3741 / 4143 / 4254 / 4557 / 4909 / 4957 / 8812 ms against that 5000ms:
    // two runs cleared it by 43ms and 91ms, and the 8812ms run passed only because a starved
    // event loop ran the DOM check before the deadline timer. The outcome was decided by
    // callback ordering rather than by the assertion, which is the definition of flaky —
    // and when it lost, `waitFor` reported a timeout with the host still at
    // data-state="loading": the clock ran out, and nothing said what had not happened.
    //
    // No timeout is raised. vitest.config.ts already sets testTimeout: 20000 for exactly
    // this cost ("a cold dynamic import of a heavy barrel can momentarily exceed vitest's
    // 5s default"), and that ceiling applies to the test body — so warming the module here
    // puts the cost under the budget that was written for it, and leaves the 5000ms below
    // covering only `mermaid.render()` rejecting against an already-loaded module.
    //
    // `mermaid` is an OPTIONAL peer, so the warm-up must not decide the outcome: when it is
    // absent the component takes its "not installed" branch, which this test also accepts.
    // See usetheokit/theokit-ui#51.
    //
    // Do not drop this line as redundant. Instrumented over two full-suite runs whose import
    // cost differed by 2.3x (839ms and 1943ms), the `waitFor` window below was 189ms and
    // 179ms — invariant, because the load-sensitive work is no longer inside it. Twelve
    // further full-suite runs are green, two of them (5292ms and 5168ms in total) past the
    // 5000ms that used to be this assertion's whole budget.
    await import("mermaid").catch(() => undefined);

    const { container } = render(<MermaidDiagram source="this is not valid mermaid" />);

    // The state is asserted BY VALUE, not by the presence of a node. Waiting for
    // `querySelector("[data-state='error']")` to be truthy fails with "expected null to be
    // truthy", which names neither the state that was observed nor the one that was wanted.
    const readState = () =>
      container.querySelector("[data-theo-slide-mermaid]")?.getAttribute("data-state") ?? "absent";
    await waitFor(() => {
      expect(readState(), "MermaidDiagram never left its loading state").toBe("error");
    });

    const host = container.querySelector("[data-state='error']");
    expect(host?.getAttribute("role")).toBe("img");
    expect(host?.getAttribute("aria-label")).toMatch(/render failed|not installed/i);
    // Source still visible for debugging / print fallback.
    expect(container.querySelector("pre")?.textContent).toContain("not valid mermaid");
  });
});
