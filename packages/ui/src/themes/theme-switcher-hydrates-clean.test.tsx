import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { builtinThemes } from "./index.js";
import { ThemeProvider } from "./theme-provider.js";
import { ThemeSwitcher } from "./theme-switcher.js";

/**
 * usetheokit/theokit-ui#155 — `<ThemeSwitcher />` threw React #418 on every hydration of a
 * server-rendered page, so React discarded the SSR markup and rebuilt the whole tree on the
 * client. Every SSR app that rendered it behaved as if it were client-rendered.
 *
 * ## Why the existing suite could not see it
 *
 * Ten test files cover this directory and **not one renders the theme on a server**. They all
 * mount through `@testing-library/react`, which calls `createRoot` — the client path, where
 * there is no prior markup to disagree with. `theme-boot-agreement.test.tsx` comes closest and
 * asks a different question: whether the inline script and the provider SETTLE on the same value.
 * They do. The divergence is one render earlier, between the server's output and the client's
 * FIRST render, and nothing in the package had ever produced the first half of that pair.
 *
 * That is the substitution `honesty-gate-golden-rule.md` names: confirming a claim against the
 * report of a thing rather than against the thing. A mounted component is a report about
 * hydration; only hydration is hydration.
 *
 * ## What this test does
 *
 * Renders the real component with `renderToString`, puts that markup in a container, and hydrates
 * it with the real `hydrateRoot` — the actual sequence a browser performs. React reports a
 * recoverable hydration mismatch through `onRecoverableError`, so the assertion reads what React
 * itself said rather than inspecting the DOM and inferring.
 */

const CAPTURED: Error[] = [];

/** React 18 routes a recovered hydration mismatch here rather than throwing it to the caller. */
function hydrateInto(container: HTMLElement, element: React.ReactElement): void {
  act(() => {
    hydrateRoot(container, element, {
      onRecoverableError: (error) => {
        CAPTURED.push(error as Error);
      },
    });
  });
}

/** Both halves must run under the same conditions, so the OS preference is pinned for both. */
function pinSystemPreference(prefersDark: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark") ? prefersDark : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  CAPTURED.length = 0;
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("ThemeSwitcher hydrates without a mismatch (#155)", () => {
  it("test_the_server_markup_survives_hydration_when_the_os_prefers_light", () => {
    // The reported case. The provider's `defaultMode` is `dark`, so a light-preferring OS is where
    // the server's output and the client's first render have the most room to disagree.
    pinSystemPreference(false);

    const tree = (
      <ThemeProvider themes={builtinThemes}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const html = renderToString(tree);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    hydrateInto(container, tree);

    expect(
      CAPTURED.map((e) => e.message),
      "React recovered from an error while hydrating ThemeSwitcher. A recovered hydration error " +
        "means the server markup was DISCARDED and the tree rebuilt on the client, which is the " +
        "whole value of SSR thrown away on every page load.",
    ).toEqual([]);
  });

  it("test_the_server_markup_survives_hydration_when_the_os_prefers_dark", () => {
    // The mirror case. A mismatch that only appears under one OS preference is still a mismatch,
    // and testing one half would let the other regress silently.
    pinSystemPreference(true);

    const tree = (
      <ThemeProvider themes={builtinThemes}>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    const html = renderToString(tree);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    hydrateInto(container, tree);

    expect(
      CAPTURED.map((e) => e.message),
      "same as above, with a dark-preferring OS",
    ).toEqual([]);
  });

  it("test_the_probe_can_observe_a_mismatch_at_all", () => {
    // Guards the instrument. Both assertions above pass over an EMPTY list, so a harness that
    // never captures anything would report success while measuring nothing — the failure this
    // whole file exists to correct, reproduced one level up. This plants a deliberate divergence
    // and requires the probe to see it.
    const container = document.createElement("div");
    container.innerHTML = "<div><span>server text</span></div>";
    document.body.appendChild(container);

    hydrateInto(
      container,
      <div>
        <span>client text</span>
      </div>,
    );

    expect(
      CAPTURED.length,
      "the probe saw no error over a deliberate server/client divergence, so a green result " +
        "from the two assertions above would prove nothing",
    ).toBeGreaterThan(0);
  });
});

describe("the announcement does not depend on what only the client knows (#155)", () => {
  /**
   * The structural half, and the one the runtime tests above cannot reach.
   *
   * `ThemeSwitcher` renders `mode` as TEXT in an `aria-live` region. `mode` is resolved by
   * `ThemeProvider` from `localStorage` and `prefers-color-scheme` in a `useEffect`
   * (`theme-provider.tsx:500`) — i.e. AFTER hydration. The server cannot know either value; that is
   * not a bug in the provider, it is what a server is.
   *
   * So a text node whose content is `mode` is a hydration mismatch by construction whenever the
   * client resolves to something other than `defaultMode`. The runtime tests above pin
   * `matchMedia` before BOTH renders, which makes server and client agree — they prove the tree
   * hydrates, and they cannot prove this, because the divergence needs the two halves to disagree
   * and a fixed stub makes them agree.
   *
   * This asserts on the SOURCE instead. The property is "no client-only value is rendered as text",
   * and it stays true no matter which stub a future test installs.
   */
  it("test_mode_is_not_rendered_as_a_text_node", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "theme-switcher.tsx"), "utf8");

    // `{mode}` inside JSX children — not in an attribute, where a mismatch costs nothing visible
    // and React does not report #418.
    const asText = /(?<!=\{)\{\s*mode\s*\}(?![^<>]*=)/.test(
      source.replace(/`[^`]*`/g, ""), // template literals are attribute values here
    );

    expect(
      asText,
      "`mode` is rendered as a text node. It is resolved after hydration from localStorage and " +
        "prefers-color-scheme, so the server renders the default and the client may render " +
        "something else — React #418, on every SSR page that mounts this. An aria-live region is " +
        "announced when it CHANGES, so rendering it empty on the server and filling it on the " +
        "client is not a loss: it is what a live region is for.",
    ).toBe(false);
  });
});
