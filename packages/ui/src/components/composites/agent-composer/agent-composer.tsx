"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, KeyboardEvent, ReactNode } from "react";
import { cn } from "../../../lib/cn.js";
import {
  type MentionItem,
  MentionMenu,
  type MentionTrigger,
} from "../../primitives/mention-menu/index.js";
import { ChatComposer } from "../chat-composer/chat-composer.js";

/**
 * AgentComposer — ChatComposer + slash-command / @file / #memory triggers.
 *
 * Wraps ChatComposer and watches the value for three trigger characters:
 *   `/` → slash commands (`/clear`, `/help`, …)
 *   `@` → file references (`@src/components/Foo.tsx`)
 *   `#` → memory entries (`#alignment-grid`)
 *
 * Detection is string-based — no textarea ref required. A trigger is active
 * iff the value ends with a token of the form `[\s|^]([/@#])[^\s]*` (i.e. a
 * trigger char preceded by start-of-string or whitespace, with no space
 * after).
 *
 * The consumer provides the candidate items per trigger. On selection the
 * trailing token is replaced with the chosen value plus a trailing space.
 */

type ItemsProvider = (query: string) => MentionItem[];

interface AgentComposerProps extends ComponentProps<typeof ChatComposer> {
  /** Items shown when `/` is the active trigger. */
  commands?: MentionItem[] | ItemsProvider;
  /** Items shown when `@` is the active trigger. */
  files?: MentionItem[] | ItemsProvider;
  /** Items shown when `#` is the active trigger. */
  memories?: MentionItem[] | ItemsProvider;
  /**
   * What text gets inserted when an item is picked. Defaults to
   * `${trigger}${item.label}` (assumes `label` is a string). Override to
   * insert a token different from the visible label (e.g. include path,
   * id, …).
   */
  resolveInsertText?: (item: MentionItem, trigger: MentionTrigger) => string;
  /** Optional slot for the empty-state copy per trigger. */
  emptyLabels?: Partial<Record<MentionTrigger, ReactNode>>;
  /** Outer wrapper className (the relative positioning anchor for the menu). */
  containerClassName?: string;
}

const TRIGGER_CHARS: ReadonlyArray<MentionTrigger> = ["/", "@", "#"];

// `@` and `#` are mentions and work mid-sentence.
const MENTION_RE = /(^|\s)([@#])([^\s]*)$/;
// `/` is a command: only the first character of the first line, and only until
// the first whitespace after it.
const SLASH_RE = /^\/(\S*)$/;

interface DetectedTrigger {
  trigger: MentionTrigger;
  query: string;
  /** Index in the value where the trigger char starts. */
  start: number;
}

function detectTrigger(value: string): DetectedTrigger | null {
  const slash = value.match(SLASH_RE);
  if (slash) return { trigger: "/", query: slash[1] ?? "", start: 0 };
  const match = value.match(MENTION_RE);
  if (!match) return null;
  const leading = match[1] ?? "";
  const triggerChar = match[2] as MentionTrigger;
  const query = match[3] ?? "";
  if (!TRIGGER_CHARS.includes(triggerChar)) return null;
  // start = position of the trigger char itself
  const start = (match.index ?? 0) + leading.length;
  return { trigger: triggerChar, query, start };
}

function resolveItems(
  source: MentionItem[] | ItemsProvider | undefined,
  query: string,
): MentionItem[] {
  if (!source) return [];
  if (typeof source === "function") return source(query);
  if (!query) return source;
  const q = query.toLowerCase();
  return source.filter((item) => {
    const haystack = `${typeof item.label === "string" ? item.label : ""} ${
      typeof item.description === "string" ? item.description : ""
    }`.toLowerCase();
    return haystack.includes(q);
  });
}

function defaultInsertText(item: MentionItem, trigger: MentionTrigger): string {
  const label = typeof item.label === "string" ? item.label : "";
  // If the visible label already starts with the trigger char (e.g. "/clear"),
  // use it as-is so we don't end up with "//clear".
  if (label.startsWith(trigger)) return label;
  return `${trigger}${label}`;
}

export function AgentComposer({
  value,
  onValueChange,
  commands,
  files,
  memories,
  resolveInsertText = defaultInsertText,
  emptyLabels,
  containerClassName,
  className,
  textareaProps,
  ...chatComposerProps
}: AgentComposerProps) {
  // Trigger detection + manual dismiss state.
  // We honour `dismissed` so the user can Esc the menu and keep typing after
  // a trigger char without the menu re-appearing.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  // Anchor for re-focusing the textarea after a mouse selection, and a flag that
  // marks the next value change as "caused by a pick" so the effect only fires then.
  const containerRef = useRef<HTMLDivElement>(null);
  const refocusPending = useRef(false);

  const detected = useMemo(() => detectTrigger(value), [value]);
  const isDismissed = detected !== null && dismissedAt === detected.start;
  const activeTrigger = isDismissed ? null : (detected?.trigger ?? null);
  const query = isDismissed ? "" : (detected?.query ?? "");

  const items = useMemo(() => {
    if (!activeTrigger || !detected) return [];
    if (activeTrigger === "/") return resolveItems(commands, query);
    if (activeTrigger === "@") return resolveItems(files, query);
    if (activeTrigger === "#") return resolveItems(memories, query);
    return [];
  }, [activeTrigger, detected, commands, files, memories, query]);

  const menuOpen = !!activeTrigger && items.length > 0;

  const handleSelect = (item: MentionItem) => {
    if (!detected) return;
    const before = value.slice(0, detected.start);
    const insert = resolveInsertText(item, detected.trigger);
    refocusPending.current = true;
    onValueChange(`${before}${insert} `);
    setDismissedAt(null);
  };

  // A click on a menu item steals focus from the textarea. Once the picked value
  // has been applied, hand focus back and drop the caret at the end so the user
  // keeps typing without touching the mouse again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `value` is the intentional re-run trigger (body reads refocusPending, not value); dropping it stops the refocus firing.
  useEffect(() => {
    if (!refocusPending.current) return;
    refocusPending.current = false;
    const ta = containerRef.current?.querySelector("textarea");
    if (!ta) return;
    ta.focus();
    const end = ta.value.length;
    ta.setSelectionRange(end, end);
  }, [value]);

  const handleClose = () => {
    if (detected) setDismissedAt(detected.start);
  };

  const interceptKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) {
      // Let MentionMenu's global key handler take Arrow/Enter/Esc.
      if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) {
        if (e.key === "Enter") e.preventDefault(); // also prevent form submit
        return;
      }
    }
    // Mirror ChatComposer's default Enter-to-submit when menu is closed.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
    }
    textareaProps?.onKeyDown?.(e);
  };

  return (
    <div
      ref={containerRef}
      data-slot="agent-composer"
      className={cn("relative", containerClassName)}
    >
      <MentionMenu
        open={menuOpen}
        trigger={(activeTrigger ?? "/") as MentionTrigger}
        items={items}
        onSelect={handleSelect}
        onClose={handleClose}
        emptyLabel={activeTrigger ? emptyLabels?.[activeTrigger] : undefined}
      />
      <ChatComposer
        value={value}
        onValueChange={(next) => {
          // If user clears the trigger token, drop the dismissed marker too.
          if (!detectTrigger(next)) setDismissedAt(null);
          onValueChange(next);
        }}
        className={className}
        textareaProps={{
          ...textareaProps,
          onKeyDown: interceptKeyDown,
        }}
        {...chatComposerProps}
      />
    </div>
  );
}
