/**
 * Public surface of `@theokit/ui/slide`. Subpath-isolated engine: this bundle
 * is emitted separately from the barrel (see `tsup.config.ts`) and depends on
 * the markdown stack via optional peer-deps.
 */
export { Slide } from "./slide.js";
export type {
  SlideAspectRatio,
  SlideProps,
  SlideTheme,
  SlideValidationError,
  SlideValidationErrorCode,
} from "./slide.js";
export {
  parseSlide,
  parseBody,
  mdastToHast,
  sanitizeHast,
  hastToReact,
  type ParseSlideOptions,
  type ParsedSlide,
} from "./parse.js";
export { validateSlide, type ValidationResult } from "./validate.js";
export {
  extractFrontmatter,
  MAX_RAW_FRONTMATTER,
  type ExtractFrontmatterResult,
} from "./frontmatter.js";
export {
  slideFrontmatter,
  slideInput,
  slideTheme,
  type SlideFrontmatter,
  type SlideInput,
} from "./schema.js";
export { isSlideTheme, slideThemes } from "./themes/index.js";
export { useSlideFit, type UseSlideFitOptions } from "./use-slide-fit.js";
export { collectTagCounts, getSlideSanitizeSchema } from "./sanitize.js";
export {
  composePlugins,
  type SlidePlugin,
  type SlideSanitizeExtension,
  type MergedSanitizeExtensions,
  type PluginComposer,
} from "./plugin.js";
export { slideFrontmatterJsonSchema } from "./json-schema.js";
export { slideMarkdownComponents } from "./markdown-components.js";
