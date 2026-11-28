import React from "react";
import { OUTCOMES, displayTitle } from "../utils/filmLogic";
import type { HistoryEntry, OutcomeKey } from "../types";

interface PendingQueueProps {
  items: HistoryEntry[];
  onOutcome: (entry: HistoryEntry, outcome: OutcomeKey) => void;
  onDefer: (entry: HistoryEntry) => void;
  onDismiss: (entry: HistoryEntry) => void;
}

export const PendingQueue: React.FC<PendingQueueProps> = ({
  items,
  onOutcome,
  onDefer,
  onDismiss,
}) => {
  if (!items.length) return null;

  return (
    <section
      aria-label="Film scelti nelle sere scorse"
      className="mb-8 rounded-2xl border border-cg-border bg-cg-surface p-5 sm:p-6"
    >
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-cg-border pb-3">
        <h2 className="font-display text-lg font-semibold text-cg-text">
          Com’è andata?
        </h2>
        <span className="font-mono text-xs tabular-nums text-cg-muted">
          {items.length} in attesa di riscontro
        </span>
      </div>

      <div className="divide-y divide-cg-border">
        {items.map((h) => (
          <div key={h.k} className="py-3.5 first:pt-0 last:pb-0">
            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-base font-semibold text-cg-text">
                {displayTitle(h)}
              </span>
              {h.y && (
                <span className="font-mono text-xs tabular-nums text-cg-muted">
                  {h.y}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(OUTCOMES) as OutcomeKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => onOutcome(h, k)}
                  className={
                    k === "love"
                      ? "rounded-lg bg-cg-accent px-3 py-1.5 text-xs font-semibold text-cg-accent-fg transition-colors hover:bg-cg-accent-hover whitespace-nowrap shrink-0"
                      : "rounded-lg border border-cg-border bg-cg-elevated px-3 py-1.5 text-xs font-medium text-cg-secondary transition-colors hover:border-cg-border-strong hover:text-cg-text whitespace-nowrap shrink-0"
                  }
                >
                  {OUTCOMES[k].label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onDefer(h)}
                className="rounded-lg border border-cg-border bg-transparent px-3 py-1.5 text-xs font-medium text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text whitespace-nowrap shrink-0"
              >
                Non l’ho ancora visto
              </button>
              <button
                type="button"
                onClick={() => onDismiss(h)}
                className="rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text whitespace-nowrap shrink-0"
              >
                Non più
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
