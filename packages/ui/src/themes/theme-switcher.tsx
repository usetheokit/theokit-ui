import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import type { JSX } from "react";
import { cn } from "../lib/cn.js";
import { useTheme } from "./theme-provider.js";

interface ThemeSwitcherProps {
  className?: string;
  /** If true, renders mode toggle inline next to the theme menu. */
  showModeToggle?: boolean;
}

/**
 * ThemeSwitcher — drop-in theme + mode picker.
 *
 * Two affordances:
 *   - Palette dropdown lists all registered themes with the active marked.
 *   - Optional sun/moon button toggles light/dark.
 *
 * Stateless wrt itself — pulls state from `useTheme()`.
 */
function ThemeSwitcher({ className, showModeToggle = true }: ThemeSwitcherProps): JSX.Element {
  const { theme, themes, setTheme, mode, toggleMode } = useTheme();

  // `false` on the server AND on the client's first render — which is what makes the two agree.
  // Flipping it in an effect is the documented way to render something only the client can know
  // without the first client render disagreeing with the server's.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {/* LOW-006: announce theme + mode changes to assistive tech. The
       * Provider applies tokens via `data-theme`/`data-mode` (visual cue),
       * but screen-reader users get no feedback without this aria-live
       * region. Polite so it doesn't interrupt the user's flow.
       *
       * #155 — the announcement is rendered only AFTER mount, and that is not a workaround for a
       * hydration warning: it is the only honest thing a server can emit here. `mode` is resolved
       * by `ThemeProvider` from `localStorage` and `prefers-color-scheme` in a `useEffect`
       * (`theme-provider.tsx:500`), so the server does not have it — it renders `defaultMode` and
       * the client may render something else. Text content that differs is React #418, which
       * DISCARDS the server markup and rebuilds the tree on the client. Every SSR page mounting
       * this paid that.
       *
       * Nothing is lost by the delay: a live region is announced when its content CHANGES, so an
       * empty one on the server and a filled one after mount is exactly the sequence it exists for.
       * Announcing at mount would also be wrong — a screen reader would read the theme aloud on
       * every page load, which `aria-live="polite"` is meant to avoid. */}
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {mounted ? `Theme: ${theme.label}, mode: ${mode}` : ""}
      </span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Theme: ${theme.label}`}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-card px-3",
              "font-medium font-sans text-body-sm text-foreground",
              "transition-colors hover:bg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <Palette className="size-4 text-primary" aria-hidden="true" />
            <span>{theme.label}</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className={cn(
              "z-50 min-w-[16rem] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md",
              "data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in",
              "data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out",
            )}
          >
            {themes.map((t) => (
              <DropdownMenu.Item
                key={t.name}
                onSelect={() => setTheme(t.name)}
                className={cn(
                  "flex cursor-pointer items-start justify-between gap-3 rounded-md px-2 py-2",
                  "focus:bg-muted focus:outline-none data-[highlighted]:bg-muted",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-body-sm">{t.label}</span>
                  {t.description ? (
                    <span className="text-body-sm text-muted-foreground">{t.description}</span>
                  ) : null}
                </span>
                {t.name === theme.name ? (
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : null}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {showModeToggle ? (
        <button
          type="button"
          onClick={toggleMode}
          /*
           * #155, second half. `mode` is read in three places here and only the live region above was
           * guarded; this label and the icon below were not, and both diverge for the same reason —
           * the server has no `mode`, so it renders `defaultMode` while the client may render
           * something else.
           *
           * Measured against the published 1.12.0 in a real browser (theokit's
           * `scripts/probe-hydration.mjs`, Chrome over CDP, built scaffold): React #418 with
           * `args[]=HTML`, and the printed tree named this `aria-label` and the `<Moon>`/`<Sun>`
           * swap. The icon is the worse half: those are different components with different SVG
           * children, so the mismatch is structural and React discards the server markup and rebuilds
           * the whole tree — the value of SSR thrown away on every page load.
           *
           * Guarded the same way the live region already is, deliberately rather than inventing a
           * second pattern: `mounted` is false on the server AND on the client's first render, so the
           * two agree by construction and it does not matter WHAT makes `mode` differ afterwards.
           * A CSS approach (render both icons, let `data-mode` on `<html>` pick) would avoid the
           * one-frame delay, and it needs `<ThemeScript>` to be rendered to beat the first paint —
           * which the default scaffold does not do. That is a larger decision than this fix.
           *
           * The button keeps its box and stays operable while unmounted: `size-9` is on the button and
           * the placeholder is `size-4`, so nothing shifts when the icon arrives.
           */
          aria-label={
            mounted ? `Switch to ${mode === "light" ? "dark" : "light"} mode` : "Switch colour mode"
          }
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-lg border border-border/60 bg-card",
            "text-foreground transition-colors hover:bg-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          {mounted ? (
            mode === "light" ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )
          ) : (
            <span className="size-4" aria-hidden="true" />
          )}
        </button>
      ) : null}
    </div>
  );
}

export { ThemeSwitcher };
