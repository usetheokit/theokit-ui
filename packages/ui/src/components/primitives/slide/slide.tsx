"use client";

import {
  type FC,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { slideMarkdownComponents } from "./markdown-components.js";
/**
 * `<Slide>` — view-only primitive that renders markdown + YAML frontmatter
 * into a themed, fixed-aspect surface. Lives in the isolated subpath
 * `@theokit/ui/slide`.
 *
 * See RFC 0002 (`wiki/rfcs/0002-slide.md`).
 *
 * SSR note: initial render returns the section wrapper; the parsed React tree
 * fills in client-side via the useEffect → `parseSlide` chain. Consumers
 * wrapping in Suspense / skeleton can mitigate visible jump.
 *
 * Performance tip: pass a memoized `onValidationError` (via `useCallback`)
 * and a memoized `components` map. Inline arrows recreate on each render
 * and cause re-parses.
 */
import { type ParsedSlide, parseSlide } from "./parse.js";
import type { SlidePlugin } from "./plugin.js";
import type { SlideValidationError } from "./schema.js";
import type { SlideTheme } from "./themes/index.js";
import { useSlideFit } from "./use-slide-fit.js";

export type { SlideTheme } from "./themes/index.js";
export type {
  SlideValidationError,
  SlideValidationErrorCode,
} from "./schema.js";
export type { SlidePlugin } from "./plugin.js";

export interface SlideAspectRatio {
  width: number;
  height: number;
}

export interface SlideProps {
  /**
   * Slide markdown. CommonMark + GFM + optional YAML frontmatter delimited
   * by `---`. Top-level horizontal rules (`---` on their own line outside
   * frontmatter) imply a deck split and trigger `MULTIPLE_SLIDES`; only the
   * first slide is rendered.
   *
   * Note: `<figure>`/`<figcaption>` tags are stripped by the default
   * sanitize schema (D8). Use `<img>` directly for captionless images.
   */
  markdown: string;
  /** Theme name. Defaults to `"default"`. */
  theme?: SlideTheme;
  /**
   * Aspect ratio of the logical canvas. Default `"16:9"` → 1280×720.
   * Custom `{ width, height }` accepted; zero/negative/NaN fallback to 16:9.
   */
  aspectRatio?: "16:9" | "4:3" | SlideAspectRatio;
  /** Lower clamp for container-fit scale. Default 0.1. */
  minScale?: number;
  /** Upper clamp for container-fit scale. Default 4. */
  maxScale?: number;
  /** Best-effort callback invoked in useEffect when validation/sanitize emits errors. */
  onValidationError?: (errors: SlideValidationError[]) => void;
  /** Override individual element renderers (passed to hast-util-to-jsx-runtime). */
  // biome-ignore lint/suspicious/noExplicitAny: third-party component override map
  components?: Record<string, FC<any>>;
  /**
   * Rich-content plugins (Tier 2). Each plugin transforms the mdast/hast tree
   * or adds React component overrides. Pass MEMOIZED arrays to avoid re-parses
   * on every render (D15).
   *
   * @example
   *   const plugins = useMemo(() => [emojiPlugin(), shikiPlugin()], []);
   *   <Slide markdown={md} plugins={plugins} />
   */
  plugins?: SlidePlugin[];
  /** Accessible label for the slide. Defaults to `"Slide"`. */
  "aria-label"?: string;
  /** Optional class applied to the outer host element (sizing/positioning hook). */
  className?: string;
}

const ASPECT_PRESETS: Record<"16:9" | "4:3", SlideAspectRatio> = {
  "16:9": { width: 1280, height: 720 },
  "4:3": { width: 960, height: 720 },
};

/**
 * Resolve aspectRatio prop to concrete dimensions. Invalid custom values
 * (zero, negative, non-finite) silently fall back to 16:9 — surfaced via
 * `INVALID_ASPECT_RATIO` error in `onValidationError`. ADR D14.
 */
function resolveCanvas(ar: SlideProps["aspectRatio"]): {
  width: number;
  height: number;
  invalid?: boolean;
} {
  if (!ar || ar === "16:9") return ASPECT_PRESETS["16:9"];
  if (ar === "4:3") return ASPECT_PRESETS["4:3"];
  if (
    ar.width <= 0 ||
    ar.height <= 0 ||
    !Number.isFinite(ar.width) ||
    !Number.isFinite(ar.height)
  ) {
    return { ...ASPECT_PRESETS["16:9"], invalid: true };
  }
  return ar;
}

export const Slide: FC<SlideProps> = ({
  markdown,
  theme = "default",
  aspectRatio = "16:9",
  minScale,
  maxScale,
  onValidationError,
  // #154 — markdown gets this package's defaults unless the consumer decides otherwise. A default
  // and never a merge: a consumer passing `components` is making a decision, and merging ours over
  // theirs would make the default a ceiling instead of a floor.
  components = slideMarkdownComponents,
  plugins,
  className,
  "aria-label": ariaLabel = "Slide",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas = useMemo(() => resolveCanvas(aspectRatio), [aspectRatio]);
  const scale = useSlideFit(containerRef, canvas.width, canvas.height, {
    minScale,
    maxScale,
  });

  const [parsed, setParsed] = useState<ParsedSlide | null>(null);

  // Surface INVALID_ASPECT_RATIO immediately when the prop is invalid.
  // Independent of markdown parsing so consumers see the signal even with
  // an empty markdown payload.
  useEffect(() => {
    if (canvas.invalid && onValidationError) {
      onValidationError([
        {
          code: "INVALID_ASPECT_RATIO",
          path: ["aspectRatio"],
          message:
            "aspectRatio width/height must be positive finite numbers; falling back to 16:9.",
          got: aspectRatio,
        },
      ]);
    }
  }, [canvas.invalid, onValidationError, aspectRatio]);

  // EC-7 / version counter — prevents older parses from overwriting newer
  // ones on rapid prop changes.
  const versionRef = useRef(0);
  useEffect(() => {
    const myVersion = ++versionRef.current;
    let cancelled = false;
    parseSlide(markdown, { components, plugins }).then(
      (result) => {
        if (cancelled || myVersion !== versionRef.current) return;
        setParsed(result);
        if (result.errors.length > 0 && onValidationError) {
          onValidationError(result.errors);
        }
      },
      (err: unknown) => {
        // Defensive: parseSlide promises to never throw, but if a runtime
        // failure escapes (e.g. peer-dep missing), surface a synthetic error
        // and keep the slide visible with empty body.
        if (cancelled || myVersion !== versionRef.current) return;
        if (onValidationError) {
          onValidationError([
            {
              code: "INVALID_FRONTMATTER",
              path: [],
              message: err instanceof Error ? err.message : "parseSlide rejected.",
            },
          ]);
        }
        setParsed({
          frontmatter: {},
          tree: emptyFragment(),
          errors: [],
          truncated: false,
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [markdown, components, plugins, onValidationError]);

  const treeNode: ReactNode = parsed?.tree ?? null;
  const slideThemeAttr: SlideTheme = theme;

  // Tier 1 — frontmatter-driven attributes & overlays.
  const fm = parsed?.frontmatter ?? {};
  const layout = fm.layout;
  // Background precedence: explicit frontmatter > Marpit ![bg](url) (D18 / EC-5).
  const bgUrl = fm.backgroundImage ?? parsed?.extractedBackground?.url;
  const bgModifier = parsed?.extractedBackground?.modifier;
  const bgGradient = fm.backgroundGradient;
  const headerText = fm.header;
  const footerText = fm.footer;
  const paginateValue = fm.paginate;
  const showPaginate = paginateValue === true;

  // Background style: gradient > image > inherited.
  const backgroundImageStyle: string | undefined = bgGradient
    ? bgGradient
    : bgUrl
      ? `url("${bgUrl}")`
      : undefined;

  return (
    <div
      data-slot="slide"
      ref={containerRef}
      className={["theo-slide-host", className].filter(Boolean).join(" ")}
      data-theo-slide-host
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
      }}
    >
      {/*
        Section is taken out of normal flow with position:absolute so its
        1280×720 layout box doesn't inflate the host. `translate(-50%, -50%)`
        anchors the section's center to the host's center; the scale applies
        relative to that same origin. Mirrors Reveal.js transformSlides()
        (see `wiki/engines/slide-authoring-guide.md`).
      */}
      <section
        aria-roledescription="slide"
        aria-label={ariaLabel}
        className="theo-slide"
        data-theo-slide-theme={slideThemeAttr}
        data-theo-slide-layout={layout ?? "default"}
        data-theo-slide-bg-modifier={bgModifier}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: canvas.width,
          height: canvas.height,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center",
          padding: "var(--theo-slide-padding, 64px)",
          color: "inherit",
          // Background fills the canvas. When neither image nor gradient is set,
          // the slide inherits the parent surface (same pattern as Whiteboard).
          background: "transparent",
          // Only set backgroundImage + ancillary props when one is provided —
          // otherwise the shorthand `background: transparent` is preserved as-is
          // (important for the inherit-from-parent guarantee).
          ...(backgroundImageStyle
            ? {
                backgroundImage: backgroundImageStyle,
                backgroundSize: bgModifier === "fit" ? "contain" : "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : {}),
          fontFamily:
            "var(--theo-slide-font-family, system-ui, -apple-system, 'Segoe UI', sans-serif)",
          fontSize: "var(--theo-slide-font-base, 28px)",
          lineHeight: 1.5,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {headerText ? (
          <div className="theo-slide-header" aria-hidden="true">
            {headerText}
          </div>
        ) : null}
        {treeNode}
        {footerText ? (
          <div className="theo-slide-footer" aria-hidden="true">
            {footerText}
          </div>
        ) : null}
        {showPaginate ? (
          <div className="theo-slide-paginate" aria-hidden="true">
            1
          </div>
        ) : null}
      </section>
    </div>
  );
};

/** Empty React fragment placeholder used when parseSlide fails fatally. */
function emptyFragment(): ReactElement {
  // Cheap fallback that does not require importing Fragment from react/jsx-runtime.
  // Using a real element keeps the type as ReactElement (not ReactNode).
  return { type: "span", props: { children: null }, key: null } as unknown as ReactElement;
}
