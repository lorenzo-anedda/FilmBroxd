import React from "react";
import { filmKey } from "../utils/filmHelpers";
import { PendingQueue } from "./PendingQueue";
import { PickCard } from "./PickCard";
import type {
  ActivePick,
  FilmPreviewData,
  HistoryEntry,
  OutcomeKey,
} from "../types";

interface RecommendationsStageProps {
  pendingItems: HistoryEntry[];
  onOutcome: (entry: HistoryEntry, outcome: OutcomeKey) => void;
  onDeferPending: (entry: HistoryEntry) => void;
  onDismissHistory: (entry: HistoryEntry) => void;
  stageError: string;
  stageNotice: string;
  loading: boolean;
  picks: ActivePick[];
  watchlistCount: number;
  seenCount: number;
  avgRating: number;
  profile: string;
  onOpenProfile: () => void;
  onOpenArchive: () => void;
  aiEnabled: boolean;
  previews: Record<string, FilmPreviewData>;
  onRequestPreview: (pick: ActivePick) => void;
  onOpenPreview: (pick: ActivePick) => void;
  onWatchTonight: (pick: ActivePick) => void;
  onReplace: (pick: ActivePick) => void;
  onLater: (pick: ActivePick) => void;
  onNever: (pick: ActivePick) => void;
  onExplainWhy: (pick: ActivePick) => void;
  onSimilar: (pick: ActivePick) => void;
  onRateSeen: (pick: ActivePick, rating: number) => void;
  onAddExtraToList: (pick: ActivePick) => void;
  onNoteReason: (pick: ActivePick, reason: string) => void;
}

export const RecommendationsStage: React.FC<RecommendationsStageProps> = ({
  pendingItems,
  onOutcome,
  onDeferPending,
  onDismissHistory,
  stageError,
  stageNotice,
  loading,
  picks,
  watchlistCount,
  seenCount,
  avgRating,
  profile,
  onOpenProfile,
  onOpenArchive,
  aiEnabled,
  previews,
  onRequestPreview,
  onOpenPreview,
  onWatchTonight,
  onReplace,
  onLater,
  onNever,
  onExplainWhy,
  onSimilar,
  onRateSeen,
  onAddExtraToList,
  onNoteReason,
}) => {
  const listPicks = picks.filter((p) => !p.extra);
  const extraPicks = picks.filter((p) => p.extra);

  return (
    <section className="lg:col-span-7">
      <PendingQueue
        items={pendingItems}
        onOutcome={onOutcome}
        onDefer={onDeferPending}
        onDismiss={onDismissHistory}
      />

      {stageError && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          {stageError}
        </div>
      )}

      {stageNotice && !loading && (
        <p className="mb-5 text-sm text-slate-600 dark:text-slate-400">
          {stageNotice}
        </p>
      )}

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#131722]"
            >
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="mt-3 h-6 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="mt-2 h-3.5 w-40 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800/80" />
              <div className="mt-4 h-12 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
            </div>
          ))}
        </div>
      )}

      {!loading && picks.length === 0 && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-[#131722]">
          <span className="font-mono text-xs uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
            {watchlistCount === 0 ? "Nessuna lista caricata" : "Archivio pronto"}
          </span>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {watchlistCount === 0
              ? "Carica la tua watchlist Letterboxd"
              : "Scegli il mood per iniziare la serata"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {watchlistCount === 0
              ? "La watchlist è attualmente vuota. Vai in Archivio per caricare il tuo watchlist.csv (e facoltativamente watched.csv e ratings.csv) esportato da Letterboxd."
              : "Imposta come ti senti adesso o aggiungi dei filtri su durata, genere ed epoca. Verranno proposti 5 titoli dalla tua watchlist e 1 fuori lista calibrato sul tuo gusto."}
          </p>
          {watchlistCount === 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onOpenArchive}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB]"
              >
                Carica i tuoi CSV in Archivio
              </button>
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-4 border-y border-slate-200/80 py-4 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                In watchlist
              </div>
              <div className="mt-0.5 font-mono text-xl font-medium tabular-nums text-slate-900 dark:text-white">
                {watchlistCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Film visti
              </div>
              <div className="mt-0.5 font-mono text-xl font-medium tabular-nums text-slate-900 dark:text-white">
                {seenCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Media voti
              </div>
              <div className="mt-0.5 font-mono text-xl font-medium tabular-nums text-slate-900 dark:text-white">
                {avgRating ? `${avgRating.toFixed(1)}★` : "—"}
              </div>
            </div>
          </div>

          {profile && (
            <div className="mt-5">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Sintesi del tuo profilo gusti
              </div>
              <p className="line-clamp-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {profile}
              </p>
              <button
                type="button"
                onClick={onOpenProfile}
                className="mt-2.5 text-xs font-medium text-[#2563EB] underline-offset-4 hover:underline dark:text-[#60A5FA]"
              >
                Leggi o modifica il profilo completo
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && picks.length > 0 && (
        <div className="space-y-8">
          {listPicks.length > 0 && (
            <div>
              <div className="mb-3 flex items-baseline justify-between border-b border-slate-200/80 pb-2 dark:border-slate-800">
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                  Dalla tua watchlist
                </h2>
                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {listPicks.length} proposte
                </span>
              </div>
              <div className="space-y-4">
                {listPicks.map((p, idx) => (
                  <PickCard
                    key={p.id}
                    pick={p}
                    indexLabel={String(idx + 1).padStart(2, "0")}
                    aiEnabled={aiEnabled}
                    preview={previews[filmKey(p.film)]}
                    onVisible={onRequestPreview}
                    onOpenPreview={onOpenPreview}
                    onWatchTonight={onWatchTonight}
                    onReplace={onReplace}
                    onLater={onLater}
                    onNever={onNever}
                    onExplainWhy={onExplainWhy}
                    onSimilar={onSimilar}
                    onRateSeen={onRateSeen}
                    onAddExtraToList={onAddExtraToList}
                    onNoteReason={onNoteReason}
                  />
                ))}
              </div>
            </div>
          )}

          {extraPicks.length > 0 && (
            <div>
              <div className="mb-3 flex items-baseline justify-between border-b border-slate-200/80 pb-2 dark:border-slate-800">
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                  Bonus fuori dalla watchlist
                </h2>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  affine ai tuoi gusti
                </span>
              </div>
              <div className="space-y-4">
                {extraPicks.map((p) => (
                  <PickCard
                    key={p.id}
                    pick={p}
                    indexLabel="Bonus"
                    aiEnabled={aiEnabled}
                    preview={previews[filmKey(p.film)]}
                    onVisible={onRequestPreview}
                    onOpenPreview={onOpenPreview}
                    onWatchTonight={onWatchTonight}
                    onReplace={onReplace}
                    onLater={onLater}
                    onNever={onNever}
                    onExplainWhy={onExplainWhy}
                    onSimilar={onSimilar}
                    onRateSeen={onRateSeen}
                    onAddExtraToList={onAddExtraToList}
                    onNoteReason={onNoteReason}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
