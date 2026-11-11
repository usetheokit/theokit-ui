// @theokit/ui — barrel entry.
//
// Architecture (see wiki/architecture/taxonomy-rule.md):
//   - lib/         pure utilities (cn) — no React state
//   - themes/      theme registry + ThemeProvider + ThemeSwitcher
//   - components/
//       primitives/   atomic components: only depend on Radix, lucide, cn
//       composites/   compose primitives: depend on >=1 other component here
//   - types/       shared domain models (Message, AgentEvent, …)
//   - screens/     example screen compositions (stories only, not exported)

export { cn } from "./lib/cn.js";
export * from "./lib/i18n/index.js";

// Generic primitives re-exported from `@usetheo/ui`.
//
// `@usetheo/ui` is this package's non-AI foundation and holds the generic
// primitives; this package holds the agent-specific ones. It is a REQUIRED peer
// dependency (`>=0.22.0 <1`, not listed in `peerDependenciesMeta` as optional),
// so every consumer of `@theokit/ui` already has it installed and the re-export
// resolves at their node_modules — nothing is vendored, and `tsup` keeps the
// specifier external the same way it already does for the `Toaster` import in
// `theo-ui-provider.tsx`.
//
// The barrel carried these until 0.19.0 and stopped at 1.0.0. Nothing caught it:
// `validate-exports.mjs` checks the export MAP (does the subpath resolve, does it
// import) and never which SYMBOLS the barrel carries, so five releases shipped
// without a Button and `@theokit/plugin-canvas` / `@theokit/plugin-forms` went out
// broken — 10 x TS2305 on typecheck, a DTS error on build, 4 red suites.
// See usetheokit/theokit-plugins#9 and usetheokit/theokit-ui#40.
//
// This list is the set those two plugins actually import — the measured consumer
// contract, not a wishlist. `tests/contract/barrel-primitives.test.ts` is the gate
// that keeps it from regressing again. Adding a name here widens the public API
// deliberately; removing one is a breaking change.
export {
  Alert,
  Button,
  CodeBlock,
  CopyButton,
  DropdownMenu,
  FormField,
  Tooltip,
} from "@usetheo/ui";

// Theme system
export {
  ThemeProvider,
  ThemeScript,
  ThemeSwitcher,
  ThemeEditor,
  builtinThemes,
  classicPaper,
  auroraTerminal,
  defineTheme,
  hex,
  rgb,
  useDensity,
  useTheme,
  violetForge,
  // The TheoKit brand theme — primary measured from the falcon mark.
  falconRed,
  // 7 new themes (RFC 0007)
  vercelMono,
  githubDark,
  dracula,
  oneDark,
  anthropicStyle,
  openaiStyle,
  linearGlass,
  // Runtime contrast, for anything building a theme in a UI. Shipped rather than kept in
  // `scripts/` so an editor can run the same check the build gate runs.
  CONTRAST_PAIRS,
  WCAG_AA,
  auditColorScale,
  deriveColorScale,
  contrastLevel,
  contrastRatio,
  cssColorToHex,
  relativeLuminance,
  toOklch,
  readStoredTheme,
  useStoredTheme,
  type ColorScale,
  type ContrastFinding,
  type ContrastLevel,
  type DeriveOptions,
  type StoredThemeApi,
  type DefineThemeInput,
  type Density,
  type DensityContextValue,
  type MotionScale,
  type RadiusScale,
  type ShadowScale,
  type SpaceScale,
  type Theme,
  type ThemeEditorProps,
  type ThemeFonts,
  type ThemeMode,
} from "./themes/index.js";

// Primary entry point — composes ThemeProvider + Toaster (T2.1)
export { TheoUIProvider, type TheoUIProviderProps } from "./theo-ui-provider.js";

// Shared domain types
export type {
  Attachment,
  CustomContentUIPart,
  DataUIPart,
  FileUIPart,
  MessageRole,
  ProviderMetadata,
  ReasoningFileUIPart,
  ReasoningUIPart,
  SourceDocumentUIPart,
  SourceUrlUIPart,
  StepStartUIPart,
  TextUIPart,
  ToolInvocationState,
  ToolUIPart,
  UIMessage,
  UIMessagePart,
} from "./types/chat.js";
export {
  isCustomContentUIPart,
  isDataUIPart,
  isFileUIPart,
  isReasoningFileUIPart,
  isReasoningUIPart,
  isSourceDocumentUIPart,
  isSourceUrlUIPart,
  isStepStartUIPart,
  isTextUIPart,
  isToolUIPart,
} from "./types/chat.js";
export type {
  AgentEvent as AgentEventModel,
  AgentEventStatus,
  AgentEventType,
} from "./types/agent.js";
export type {
  PermissionDecision,
  PermissionOperation,
  PermissionRequest,
} from "./types/permission.js";
export type { TaskStatus, TaskStep, TaskStepStatus } from "./types/task.js";

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES — atomic, do not depend on any other @theokit/ui component.
// ─────────────────────────────────────────────────────────────────────────────

// Foundations

// theokit-ui-parity Phase 1 — 7 new components
export {
  ThinkingLevelSelector,
  type ThinkingLevel,
  type ThinkingLevelOrInherited,
  type ThinkingLevelSelectorProps,
} from "./components/primitives/thinking-level-selector/index.js";
export {
  RunStatusPill,
  type RunStatus,
  type RunStatusPillProps,
} from "./components/primitives/run-status-pill/index.js";
export {
  BranchIndicator,
  type BranchIndicatorProps,
} from "./components/primitives/branch-indicator/index.js";
export {
  GatewayStatusIndicator,
  type GatewayStatus,
  type GatewayStatusIndicatorProps,
} from "./components/primitives/gateway-status-indicator/index.js";

export {
  ExportChatDialog,
  type ExportChatDialogProps,
  type ExportFormat,
} from "./components/primitives/export-chat-dialog/index.js";
export {
  StabilityBundleViewer,
  type StabilityBundle,
  type StabilityBundleViewerProps,
  type StabilitySeverity,
} from "./components/composites/stability-bundle-viewer/index.js";

// Agent transparency & configuration primitives
export { ContextWindowBar } from "./components/primitives/context-window-bar/index.js";
export {
  CapabilityIndicator,
  capabilityPresets,
  type Capability,
  type CapabilityState,
} from "./components/primitives/capability-indicator/index.js";
export {
  ToolsList,
  type ToolEnablement,
  type ToolEntry,
} from "./components/primitives/tools-list/index.js";
export {
  PermissionMatrix,
  type PermissionDecisionKind,
  type PermissionRule,
} from "./components/primitives/permission-matrix/index.js";
export {
  SkillCard,
  type Skill,
  type SkillSource,
  type SkillState,
} from "./components/primitives/skill-card/index.js";
export { RuleCard } from "./components/primitives/rule-card/index.js";
export type { Rule, RuleScope, RuleState } from "./types/rule.js";
export { ALL_MODES, MODE_LABEL, type Mode } from "./types/mode.js";
export { CostMeter } from "./components/primitives/cost-meter/index.js";
export {
  TaskNode,
  TaskPlan,
  type PlanNode,
  type PlanNodeStatus,
} from "./components/primitives/task-plan/index.js";
export { SystemPromptEditor } from "./components/primitives/system-prompt-editor/index.js";
export {
  MemoryEditor,
  type MemoryLayer,
  type MemoryScope,
} from "./components/primitives/memory-editor/index.js";
export {
  HookConfig,
  HOOK_EVENTS,
  type HookEntry,
  type HookEvent,
} from "./components/primitives/hook-config/index.js";
export {
  HookEventLog,
  type HookEventEntry,
  type HookEventResult,
} from "./components/primitives/hook-event-log/index.js";
export {
  CronJobCard,
  type CronJob,
  type CronJobStatus,
} from "./components/primitives/cron-job-card/index.js";
export {
  MCPServerCard,
  type MCPServer,
  type MCPServerStatus,
} from "./components/primitives/mcp-server-card/index.js";
export {
  ChannelCard,
  type Channel,
  type ChannelPlatform,
  type ChannelStatus,
} from "./components/primitives/channel-card/index.js";
export {
  ModelCard,
  modelCapabilityPresets,
  type ModelCapabilityFlag,
  type ModelInfo,
} from "./components/primitives/model-card/index.js";

// Sprint 3 — multi-agent & advanced transparency
export {
  AgentProfile,
  type AgentProfileDescriptor,
} from "./components/primitives/agent-profile/index.js";
export {
  SubAgentDispatch,
  type SubAgentRun,
  type SubAgentState,
} from "./components/primitives/sub-agent-dispatch/index.js";
export {
  SessionTimeline,
  type SessionStatus,
  type SessionSummary,
} from "./components/primitives/session-timeline/index.js";
export {
  AuditLogEntry,
  type AuditActorKind,
  type AuditEntry,
  type AuditSeverity,
} from "./components/primitives/audit-log-entry/index.js";
export {
  LaneBoard,
  type Lane,
  type LaneCard,
  type LaneState,
} from "./components/primitives/lane-board/index.js";
export {
  TokenUsageChart,
  type TokenUsagePoint,
  splitUsagePoints,
  toUsageMetrics,
  type UsageMetrics,
  type UsageSeries,
} from "./components/primitives/token-usage-chart/index.js";
export { AutoCompactNotice } from "./components/primitives/auto-compact-notice/index.js";
export { AgentHandoff, type HandoffParty } from "./components/primitives/agent-handoff/index.js";
export { AgentStreaming } from "./components/primitives/agent-streaming/index.js";
export {
  AgentErrorCard,
  type AgentErrorKind,
} from "./components/primitives/agent-error-card/index.js";
export {
  ToolCallCard,
  type ToolCallStatus,
} from "./components/primitives/tool-call-card/index.js";

// Layout shells (atomic — internal subparts only)

export {
  ProjectSwitcher,
  type ProjectStatus,
} from "./components/primitives/project-switcher/index.js";
export {
  SessionListItem,
  type SessionMode,
  type SessionRunStatus,
} from "./components/primitives/session-list-item/index.js";

// Chat atoms
export {
  ChatMessage,
  ChatMessageAction,
  ChatMessageActions,
  ChatMessageBranch,
  ChatMessageBranchContent,
  ChatMessageBranchNext,
  ChatMessageBranchPage,
  ChatMessageBranchPrevious,
  ChatMessageBranchSelector,
  ChatMessageContent,
  ChatMessageResponse,
  ChatMessageRoot,
  ChatMessageToolbar,
  DataPart,
  FilePart,
  ReasoningPart,
  SourceDocumentPart,
  SourceUrlPart,
  TextPart,
  ToolCallPart,
  renderPart,
  type ChatMessageProps,
  type ChatMessageRootProps,
  type ChatMessageContentProps,
  type ChatMessageContentVariant,
  type ChatMessageResponseProps,
  type ChatMessageActionsProps,
  type ChatMessageActionProps,
  type ChatMessageToolbarProps,
  type ChatMessageBranchProps,
  type ChatMessageBranchContentProps,
  type ChatMessageBranchSelectorProps,
  type ChatMessageBranchPreviousProps,
  type ChatMessageBranchNextProps,
  type ChatMessageBranchPageProps,
  type DataPartProps,
  type DataRenderer,
  type DataRendererMap,
  type FilePartProps,
  type PartRendererMap,
  type ReasoningPartProps,
  type RenderPartOptions,
  type SourceDocumentPartProps,
  type SourceUrlPartProps,
  type TextPartProps,
  type ToolCallPartProps,
} from "./components/composites/chat-message/index.js";
export { ChatThread } from "./components/primitives/chat-thread/index.js";
export { ModelSelector, type ModelOption } from "./components/primitives/model-selector/index.js";
export {
  IntentSelector,
  type IntentOption,
} from "./components/primitives/intent-selector/index.js";
export {
  MentionMenu,
  type MentionItem,
  type MentionTrigger,
} from "./components/primitives/mention-menu/index.js";
export { FolderSelector } from "./components/primitives/folder-selector/index.js";
export { AttachmentChip } from "./components/primitives/attachment-chip/index.js";
export {
  QuickActionChips,
  type QuickAction,
} from "./components/primitives/quick-action-chips/index.js";

// Agent atoms
export { AgentEvent } from "./components/primitives/agent-event/index.js";
export { AgentStartingState } from "./components/primitives/agent-starting-state/index.js";
export { RunStats } from "./components/primitives/run-stats/index.js";
export { ToolCall } from "./components/primitives/tool-call/index.js";
export { ToolResult } from "./components/primitives/tool-result/index.js";

// PaaS-shape primitives + composites (RFC dashboard-paas-primitives, 0.7.0-next.0)
// Sibling components for cloud-dashboard surfaces — distinct from the
// agent-first siblings (CostMeter, Badge, ProjectSwitcher) so both
// shapes can coexist without API widening. UsageMeter + AccountMenu are
// composites (depend on sibling primitives — Progress / Avatar+PlanBadge);
// Progress + PlanBadge are standalone primitives.

export {
  UsageMeter,
  type UsageMeterProps,
  type UsageMetric,
} from "./components/composites/usage-meter/index.js";

// Cross-cutting PaaS primitives (RFC dashboard-paas-primitives-2, 0.8.0-next.0)
// Brief #2 — 8 components closing the cross-cutting gaps surfaced by the
// TheoCloud dashboard migration. 6 primitives + 2 composites (ConfirmDialog
// depends on Dialog/Input/Button; CodeBlock depends on CopyButton).

export {
  AgentToolRenderer,
  type AgentToolRendererProps,
  type ClassifyTool,
  defaultClassifyTool,
  defaultToolRegistry,
  resolveToolRenderer,
  type ToolRenderer,
  type ToolRendererKind,
  type ToolRendererRegistry,
} from "./components/composites/agent-tool-renderer/index.js";
export {
  adaptApplyPatchResult,
  adaptGitDiffResult,
  adaptListDirResult,
  adaptReadFileResult,
  adaptShellResult,
  type CodeBlockAdapterProps,
  type CreatedFilesAdapterProps,
  type DataTableAdapterProps,
  type ParsedDiff,
  parseResult,
  parseUnifiedDiff,
} from "./lib/sdk-tools-adapters/index.js";

// StatusIndicator composite — operational state, consumes status-* tokens (ADR-0007).
// Plan: theo-ui-community-best-practices-alignment T4.1.

// MetricCard composite — dashboard metric tile with trend semantics + invertTrend (EC-17).
// Plan: theo-ui-community-best-practices-alignment T4.2.

// Brief #3 deferred primitives (0.9.0-next.0)

// Brief #5 — 3 dashboard primitives + 2 pre-reqs (0.11.0-next.0)
// Closes 3 TheoCloud Deep Review findings (§ 2.12 P2, § 2.2 + § 2.4 P1
// Top-5 fix #2, CC-3 boilerplate dedup). DropdownMenu + ActionBar
// added as explicit pre-reqs (Brief #5 assumed they existed).

// Files & folder context atoms
export { ProgressChecklist } from "./components/primitives/progress-checklist/index.js";
export {
  FolderContextCard,
  type FolderEntry,
} from "./components/primitives/folder-context-card/index.js";
export { ContextCard } from "./components/primitives/context-card/index.js";
export {
  CreatedFilesCard,
  type CreatedFile,
} from "./components/primitives/created-files-card/index.js";
export { ArtifactPreview } from "./components/primitives/artifact-preview/index.js";
export { StepsRail, type RailStep } from "./components/primitives/steps-rail/index.js";
export { WorkLog, type WorkLogProps } from "./components/primitives/work-log/index.js";
export {
  ApprovalModeSelector,
  type ApprovalMode,
  type ApprovalModeSelectorProps,
} from "./components/primitives/approval-mode-selector/index.js";
export {
  ModelEffortPicker,
  type ModelEffortOption,
  type ModelEffortPickerProps,
} from "./components/primitives/model-effort-picker/index.js";
export {
  CodeReviewPanel,
  type CodeReviewPanelProps,
  type ReviewFile,
} from "./components/primitives/code-review-panel/index.js";
export {
  RecentFoldersList,
  type RecentFolder,
} from "./components/primitives/recent-folders-list/index.js";

// Code workspace atoms
export {
  DiffViewer,
  parseUnifiedDiffToHunks,
  type DiffHunk,
  type DiffLine,
  type DiffLineKind,
} from "./components/primitives/diff-viewer/index.js";
export {
  TerminalPanel,
  type TerminalLine,
} from "./components/primitives/terminal-panel/index.js";
export {
  RunningTasksPanel,
  type RunningTaskItem,
  type RunningTaskStatus,
  type TaskSource,
} from "./components/primitives/running-tasks-panel/index.js";
export { BrowserControls } from "./components/primitives/browser-controls/index.js";
export {
  BuildLogStream,
  type LogLevel,
  type LogLine,
} from "./components/primitives/build-log-stream/index.js";

// Auth atoms

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITES — depend on one or more primitives above.
// ─────────────────────────────────────────────────────────────────────────────

// Configuration & registry composites (skill, rule, MCP server, cron job, agent editors and lists)
// Previously mis-grouped under PRIMITIVES. Mechanically these are composites
// because they import primitives via the barrel (T2.4, MF-1 of edge review).
export { SkillsList } from "./components/composites/skills-list/index.js";
export { SkillEditor } from "./components/composites/skill-editor/index.js";
export { RuleEditor } from "./components/composites/rule-editor/index.js";
export { CronJobsList } from "./components/composites/cron-jobs-list/index.js";
export { MCPServerList } from "./components/composites/mcp-server-list/index.js";
export {
  AgentEditor,
  type AgentDraft,
} from "./components/composites/agent-editor/index.js";
export {
  ApprovalCard,
  type ApprovalSeverity,
} from "./components/composites/approval-card/index.js";

// Prompt composites — ask-the-user cards (one question at a time)
export {
  ChoicePrompt,
  type ChoicePromptProps,
  type ChoicePromptResult,
  type PromptOption,
} from "./components/composites/choice-prompt/index.js";
export {
  MultiSelectPrompt,
  type MultiSelectPromptProps,
  type MultiSelectPromptResult,
} from "./components/composites/multi-select-prompt/index.js";
export {
  TextPrompt,
  type TextPromptProps,
  type TextPromptResult,
} from "./components/composites/text-prompt/index.js";
export {
  ConfirmPrompt,
  type ConfirmPromptProps,
} from "./components/composites/confirm-prompt/index.js";

// Chat composites
export {
  ChatComposer,
  type ComposerMode,
} from "./components/composites/chat-composer/index.js";
export { AgentComposer } from "./components/composites/agent-composer/index.js";
export {
  AgentStream,
  type AgentStreamItem,
  mapAgentEventStatus,
  type ToAgentStreamItemsInput,
  type ToAgentStreamItemsOptions,
  type ToolCallOverride,
  toAgentStreamItems,
} from "./components/composites/agent-stream/index.js";

// Agent composites
export { AgentTimeline } from "./components/composites/agent-timeline/index.js";

// Hooks — SDK ↔ UI streaming bridge (M5). `useAgentStream` consumes an SDK
// `Run.stream()` / `subscribe()` async stream and drives `<AgentStream>`.
export {
  useAgentStream,
  agentStreamReducer,
  initialAgentStreamState,
  type AgentStreamState,
  type AgentStreamStatus,
  type SdkStreamMessage,
} from "./hooks/use-agent-stream/index.js";

// Permission & approval composites
export { PermissionModal } from "./components/composites/permission-modal/index.js";

// Code workspace composites
export { PreviewPanel } from "./components/composites/preview-panel/index.js";

// PaaS composites

// Globals
