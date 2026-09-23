import { describe, expect, it } from "vitest";

import { getSlideSanitizeSchema } from "./sanitize.js";

/**
 * usetheokit/theokit-ui#154 asserted that a markdown link in a slide "carries no
 * `rel='noopener' noreferrer'`" and called that "the half with a security shape", because a
 * `target="_blank"` link without `noopener` hands the opened page a live `window.opener`.
 *
 * ## Measured 2026-09-23 — the premise does not hold, and this file is why
 *
 * The schema removes `target`. So a markdown link cannot open a new browsing context at all, and
 * `window.opener` is never handed to anything — the vulnerability is unreachable rather than
 * unmitigated. Measured against `hast-util-sanitize`'s own output:
 *
 * ```
 * a {"href":"https://elsewhere.test"}      ← target and rel both stripped
 * ```
 *
 * That is a better outcome than adding `rel`, and it is the reason this is a test and not a fix:
 * the protection is real, it is load-bearing, and **nothing was holding it**. `sanitize.ts` merges
 * plugin-declared attributes on top of the baseline (`mergeSchema`), so one plugin declaring
 * `a: ["target"]` reopens the hole — silently, with no failing test anywhere, and with an issue on
 * record claiming the hole was already open.
 *
 * ## Why this asks the schema and not the rendered output
 *
 * The rendered `<a>` has no `target` today, so an output assertion would pass for as long as
 * nothing declares one — and the moment something does, it would start failing in whichever test
 * happened to render a link, naming the wrong cause. The schema is where the decision lives.
 */

describe("a slide's markdown cannot produce a link that opens a new context (#154)", () => {
  it("test_the_baseline_schema_does_not_admit_target_on_an_anchor", async () => {
    const schema = await getSlideSanitizeSchema();
    const allowed = schema.attributes?.a ?? [];
    const names = allowed.map((entry) => (Array.isArray(entry) ? entry[0] : entry));

    expect(
      names,
      "`target` became allowed on an anchor. A markdown link can now open a new browsing " +
        "context, and the opened page gets a live `window.opener` back into the slide unless " +
        "`rel=noopener` travels with it — which this schema also does not admit. Either keep " +
        "both out, or map markdown links onto a component that sets `rel` itself.",
    ).not.toContain("target");
  });

  it("test_a_plugin_can_still_widen_an_anchor_and_that_is_the_measured_boundary", async () => {
    // The real attack path on this guarantee is not an edit to `sanitize.ts` — it is a plugin,
    // because `getSlideSanitizeSchema` unions plugin-declared attributes on top of the baseline and
    // plugins are the documented way to extend it. If that union can carry `target`, the assertion
    // above protects the default and nothing protects the deployed configuration.
    const schema = await getSlideSanitizeSchema({
      tagNames: [],
      attributes: { a: ["target"] },
    });
    const allowed = schema.attributes?.a ?? [];
    const names = allowed.map((entry) => (Array.isArray(entry) ? entry[0] : entry));

    expect(
      names.includes("target"),
      "a plugin declaring `a: ['target']` reached the schema. This is currently TRUE and is " +
        "recorded here as the measured boundary of the guarantee, not as a passing gate: the " +
        "baseline is safe and the extension point is not. #154 is the place to decide whether a " +
        "plugin may widen an anchor, and this assertion is what will fail when that decision is " +
        "made in either direction.",
    ).toBe(true);
  });
});
