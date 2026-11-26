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
      className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-[#131722]"
    >
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-slate-200/80 pb-3 dark:border-slate-800">
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
          Com’è andata?
        </h2>
        <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {items.length} in attesa di riscontro
        </span>
      </div>

      <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
        {items.map((h) => (
          <div key={h.k} className="py-3.5 first:pt-0 last:pb-0">
            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                {displayTitle(h)}
              </span>
              {h.y && (
                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
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
                      ? "rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap shrink-0 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
                      : "rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                  }
                >
                  {OUTCOMES[k].label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onDefer(h)}
                className="rounded-lg border border-slate-200 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Non l’ho ancora visto
              </button>
              <button
                type="button"
                onClick={() => onDismiss(h)}
                className="rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
