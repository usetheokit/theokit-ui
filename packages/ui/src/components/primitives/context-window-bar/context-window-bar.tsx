import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../../lib/cn.js";

interface ContextWindowBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Tokens currently used in the context window. */
  used: number;
  /** Model's total context capacity (e.g. 200_000, 1_000_000). */
  total: number;
  /** Optional secondary label rendered on the right (e.g. model name). */
  trailing?: ReactNode;
  /** Optional title shown above the bar. */
  label?: ReactNode;
  /** Compact mode hides numbers and label; just the bar. */
  compact?: boolean;
  /**
   * Override warning thresholds (0..1). Defaults: warn 0.75, danger 0.9
   * (the same as `contextPressure` in `@theokit/agents`).
   */
  warnAt?: number;
  dangerAt?: number;
  /**
   * Pressure computed by the caller (for example with `contextPressure` from
   * `@theokit/agents`). Wins over warnAt/dangerAt.
   */
  pressure?: "ok" | "warn" | "critical";
  /** The token count is an estimate; render it with a leading "~". */
  estimated?: boolean;
}

const formatTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
};

/**
 * ContextWindowBar — shows how much of the model's context window has been
 * consumed. Color transitions: success → warning → destructive past thresholds.
 *
 * Critical for transparency: a user should always be able to glance at this
 * and know if the conversation is about to hit the cap.
 */
const ContextWindowBar = forwardRef<HTMLDivElement, ContextWindowBarProps>(
  (
    {
      className,
      used,
      total,
      trailing,
      label = "Context",
      compact,
      warnAt = 0.75,
      dangerAt = 0.9,
      pressure,
      estimated,
      ...props
    },
    ref,
  ) => {
    const known = Number.isFinite(total) && total > 0;
    const safeUsed = Number.isFinite(used) ? Math.max(0, used) : 0;
    const ratio = known ? Math.max(0, Math.min(1, safeUsed / total)) : 0;
    const computed = ratio >= dangerAt ? "destructive" : ratio >= warnAt ? "warning" : "primary";
    const fromPressure = pressure
      ? ({ ok: "primary", warn: "warning", critical: "destructive" } as const)[pressure]
      : undefined;
    const tone = known ? (fromPressure ?? computed) : "unknown";
    const percent = Math.round(ratio * 100);
    const usedText = `${estimated ? "~" : ""}${formatTokens(safeUsed)}`;

    const barColor = {
      primary: "bg-primary",
      warning: "bg-warning",
      destructive: "bg-destructive",
      unknown: "bg-muted-foreground/40",
    }[tone];

    const textColor = {
      primary: "text-foreground",
      warning: "text-warning",
      destructive: "text-destructive",
      unknown: "text-muted-foreground",
    }[tone];

    return (
      <div
        data-slot="context-window-bar"
        ref={ref}
        className={cn("grid gap-1.5", className)}
        {...props}
      >
        {!compact ? (
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-label-caps text-muted-foreground uppercase tracking-wider">
              {label}
            </span>
            <span className={cn("font-mono text-body-sm tabular-nums", textColor)}>
              {known ? (
                <>
                  {usedText} / {formatTokens(total)}{" "}
                  <span className="opacity-60">({percent}%)</span>
                </>
              ) : (
                <>{usedText} / unknown</>
              )}
            </span>
          </div>
        ) : null}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          tabIndex={-1}
          aria-valuenow={known ? safeUsed : undefined}
          aria-valuemin={known ? 0 : undefined}
          aria-valuemax={known ? total : undefined}
          aria-label={known ? `${percent}% of context window used` : "Context window size unknown"}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width,background-color] duration-base ease-out-soft",
              barColor,
            )}
            style={{ width: known ? `${percent}%` : "0%" }}
          />
        </div>
        {trailing ? (
          <div className="font-mono text-label text-muted-foreground">{trailing}</div>
        ) : null}
      </div>
    );
  },
);
ContextWindowBar.displayName = "ContextWindowBar";

export { ContextWindowBar };
