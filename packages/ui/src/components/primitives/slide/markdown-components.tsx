import type { ComponentProps, JSX } from "react";

import { safeHref } from "../../../lib/safe-href.js";

/**
 * The defaults a slide's markdown gets when the consumer passes no `components` map.
 *
 * usetheokit/theokit-ui#154: `<Slide components={...}>` has been public API since the primitive
 * shipped and `parse.ts` passes whatever it gets straight to `toJsxRuntime` — but nothing supplied a
 * default, so `![]()` and `[]()` rendered as bare `<img>` and `<a>` with none of the defaults this
 * package applies wherever it renders one itself.
 *
 * ## What this is NOT
 *
 * Not a security fix. The issue framed the link half that way — a `target="_blank"` link without
 * `rel="noopener"` hands the opened page a live `window.opener` — and the premise does not hold:
 * the sanitize schema strips `target`, measured on `hast-util-sanitize`'s own output. A markdown
 * link cannot open a new browsing context at all, so the opener is never handed to anything.
 *
 * `rel` is here as DEFENCE IN DEPTH, and the distinction matters for whoever reads this next:
 * `getSlideSanitizeSchema` unions plugin-declared attributes onto the baseline, so a plugin
 * declaring `a: ["target"]` reopens the door. With this default the protection travels with the
 * anchor instead of depending on nobody ever widening the schema.
 *
 * ## Why a plain element and not the package's own components
 *
 * There is no `Image` component in this package — measured, not assumed. Mapping markdown onto a
 * component that does not exist is the kind of plan that reads well and cannot ship. What markdown
 * was missing is the ATTRIBUTES, and those are what this supplies.
 */

/** A link's destination is another origin, so an opener reference would cross a boundary. */
function isExternal(href: string | undefined): boolean {
  if (href === undefined || href === "") return false;
  // Fragment and relative links stay in this document. A default that fired on `#section` would be
  // noise, and a noisy default is one consumers replace wholesale rather than extend.
  if (href.startsWith("#") || href.startsWith("/") || href.startsWith("./")) return false;
  return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

/**
 * `Record<string, unknown>` on the surface, for the reason `parse.ts` records: the JSX-runtime types
 * come from an OPTIONAL peer, and naming them here would make that peer a hard requirement for every
 * consumer — including the ones who never render markdown.
 */
export const slideMarkdownComponents: Record<
  string,
  ((props: Record<string, unknown>) => JSX.Element) | undefined
> = {
  a(props) {
    const { href, children, ...rest } = props as ComponentProps<"a"> & {
      children?: React.ReactNode;
    };
    // `safeHref` rather than a second protocol check: it already refuses `javascript:` and `data:`
    // and is what `loadThemeFonts` trusts for the same question. One answer, one place.
    const safe = typeof href === "string" ? safeHref(href) : undefined;
    const external = isExternal(safe);
    return (
      <a {...rest} href={safe} rel={external ? "noopener noreferrer" : undefined}>
        {children}
      </a>
    );
  },

  img(props) {
    const { src, alt, ...rest } = props as ComponentProps<"img">;
    const safe = typeof src === "string" ? safeHref(src) : undefined;
    return (
      <img
        {...rest}
        src={safe}
        // `alt=""` and no alt are different claims to a screen reader: the first says "skip me", the
        // second makes it read the URL aloud. `![](x.png)` is an author saying there is nothing to
        // announce, so the empty string is the honest translation of it.
        alt={typeof alt === "string" ? alt : ""}
        loading="lazy"
        decoding="async"
      />
    );
  },
};
