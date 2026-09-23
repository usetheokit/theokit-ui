import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { slideMarkdownComponents } from "./markdown-components.js";

/**
 * usetheokit/theokit-ui#154 — a slide's markdown renders `![]()` and `[]()` as bare tags.
 *
 * ## What was measured, and how the issue's framing changed
 *
 * The issue calls the link half "the one with a security shape", because a `target="_blank"` link
 * without `rel="noopener"` hands the opened page a live `window.opener`. **That premise does not
 * hold**: the sanitize schema strips `target`, measured against `hast-util-sanitize`'s own output —
 * `a { href, target, rel }` comes back as `a {"href":"…"}`. A markdown link cannot open a new
 * browsing context, so `window.opener` is never handed to anything. `markdown-links-cannot-open-a-
 * new-context.test.ts` holds that, and it is why this file is about CONSISTENCY instead.
 *
 * What is real: `<Slide components={...}>` has existed as public API since the primitive shipped
 * (`slide.tsx:71`), `parse.ts:114` passes whatever it gets to `toJsxRuntime`, and **nothing supplies
 * a default**. So the mechanism was there and the map was empty — markdown rendered `<img>` and `<a>`
 * with none of the defaults this package applies everywhere it renders one itself.
 *
 * ## Why this asserts the MAP and not rendered output
 *
 * Rendering a slide needs the full async pipeline and a DOM; asserting on its output would test the
 * pipeline and report a failure here. The map is the decision — what a consumer gets when they pass
 * nothing — and it is what `Slide` must default to.
 */

describe("markdown gets this package's defaults (#154)", () => {
  it("test_an_external_link_carries_rel_noopener_noreferrer", () => {
    // The attribute this package already applies wherever it renders a link itself
    // (`source-part.tsx:32`, pinned by its own test). Markdown had none.
    const A = slideMarkdownComponents.a;
    expect(A, "no anchor component in the default map").toBeDefined();

    const el = A?.({ href: "https://elsewhere.test", children: "go" });
    expect(
      (el?.props as Record<string, unknown>)?.rel,
      "an anchor rendered from markdown carries no rel. The sanitize schema strips `target`, so " +
        "this is defence in depth rather than the whole defence — but a consumer who widens the " +
        "schema through a plugin gets the protection by default instead of by remembering.",
    ).toBe("noopener noreferrer");
  });

  it("test_a_same_document_link_is_left_alone", () => {
    // `rel=noopener` on `#section` is noise: there is no other origin to protect from, and a default
    // that fires everywhere is a default people override wholesale.
    const el = slideMarkdownComponents.a?.({ href: "#section", children: "jump" });
    expect(
      (el?.props as Record<string, unknown>)?.rel,
      "a fragment link was given a rel it cannot need",
    ).toBeUndefined();
  });

  it("test_an_image_is_lazy_and_keeps_its_alt", () => {
    // The image half of the issue. `alt` survives sanitization (measured), so the gap is the
    // defaults — a slide deck loads every image at once without them.
    const el = slideMarkdownComponents.img?.({ src: "https://x.test/a.png", alt: "a red square" });
    const props = (el?.props ?? {}) as Record<string, unknown>;
    expect(props.loading, "markdown images load eagerly").toBe("lazy");
    expect(props.decoding, "markdown images decode synchronously").toBe("async");
    expect(props.alt, "alt was dropped — it survives sanitization and must survive this").toBe(
      "a red square",
    );
  });

  it("test_an_image_with_no_alt_is_marked_decorative", () => {
    // `![](src)` is a deliberate authoring choice: an image with nothing to announce. Leaving `alt`
    // undefined makes a screen reader read the URL; `alt=""` tells it to skip.
    const el = slideMarkdownComponents.img?.({ src: "https://x.test/line.png" });
    expect(
      (el?.props as Record<string, unknown>)?.alt,
      "an image with no alt text will have its URL read aloud",
    ).toBe("");
  });
});

describe("the default map reaches Slide (#154)", () => {
  it("test_slide_defaults_to_the_map_rather_than_undefined", () => {
    // The map is worth nothing if `Slide` never passes it. Asserted on the SOURCE rather than by
    // rendering: a slide needs the full async pipeline and a DOM, so a render test here would fail
    // for pipeline reasons and report them as this. What must hold is that `components` reaching
    // `parseSlide` is never `undefined` when the consumer passed nothing.
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "slide.tsx"), "utf8");

    expect(
      /components\s*=\s*slideMarkdownComponents/.test(source),
      "Slide does not default `components`, so the map is unreachable from the public API and " +
        "markdown still renders bare tags. A default nobody applies is the orphan-export defect " +
        "under another name.",
    ).toBe(true);
  });

  it("test_a_consumer_map_still_wins", () => {
    // The default must not become a ceiling. A consumer passing `components` is making a decision,
    // and a default that overrode it would be worse than none.
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "slide.tsx"), "utf8");

    expect(
      /components\s*=\s*slideMarkdownComponents/.test(source) &&
        !/\.\.\.slideMarkdownComponents\s*,\s*\.\.\.components/.test(source),
      "the default is merged over the consumer's map instead of being a fallback for it",
    ).toBe(true);
  });
});
