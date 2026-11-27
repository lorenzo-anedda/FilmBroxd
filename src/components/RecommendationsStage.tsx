import React, { useMemo, useState } from "react";
import { Shuffle, Sparkles } from "lucide-react";
import { displayTitle, filmKey } from "../utils/filmHelpers";
import { PendingQueue } from "./PendingQueue";
import { PickCard } from "./PickCard";
import { PosterImage } from "./PosterImage";
import type {
  ActivePick,
  FilmItem,
  FilmMeta,
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
  watchlistPool: FilmItem[];
  filteredPool: FilmItem[];
  metaMap: Record<string, FilmMeta>;
  watchlistCount: number;
  seenCount: number;
  avgRating: number;
  profile: string;
  onOpenProfile: () => void;
  onOpenArchive: () => void;
  onSurprisePick: () => void;
  onClearPicks: () => void;
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

function toShowcasePick(film: FilmItem, meta?: FilmMeta): ActivePick {
  return {
    id: `showcase-${filmKey(film)}`,
    film,
    extra: false,
    durata: meta?.m ? `${meta.m} min` : "",
    regista: meta?.d || "",
    perche: "",
    status: "active",
  };
}

function pickShowcaseFilms(pool: FilmItem[], seed: number): FilmItem[] {
  if (pool.length <= 6) return pool;
  const copy = [...pool];
  // Deterministic Fisher-Yates seeded by showcaseSeed so clicking Reshuffle rotates cleanly
  let state = (seed + 1) * 2654435761;
  for (let i = copy.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 6);
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
  watchlistPool,
  filteredPool,
  metaMap,
  watchlistCount,
  seenCount,
  avgRating,
  profile,
  onOpenProfile,
  onOpenArchive,
  onSurprisePick,
  onClearPicks,
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
  const [showcaseSeed, setShowcaseSeed] = useState<number>(() =>
    Math.floor(Date.now() / 60000)
  );

  const listPicks = picks.filter((p) => !p.extra);
  const extraPicks = picks.filter((p) => p.extra);

  const showcasePool =
    filteredPool.length >= 6 ? filteredPool : watchlistPool;
  const showcaseFilms = useMemo(
    () => pickShowcaseFilms(showcasePool, showcaseSeed),
    [showcasePool, showcaseSeed]
  );

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
              className="flex gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#131722]"
            >
              <div className="aspect-[2/3] w-20 shrink-0 animate-pulse rounded-xl bg-slate-200 sm:w-24 dark:bg-slate-800" />
              <div className="flex-1 space-y-3">
                <div className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-6 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3.5 w-44 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800/80" />
                <div className="h-12 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && picks.length === 0 && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-[#131722]">
          {watchlistCount === 0 ? (
            <>
              <span className="font-mono text-xs uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
                Nessuna lista caricata
              </span>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
                Carica la tua watchlist Letterboxd
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                La watchlist è attualmente vuota. Vai in Archivio per caricare il tuo watchlist.csv (e facoltativamente watched.csv e ratings.csv) esportato da Letterboxd.
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={onOpenArchive}
                  className="rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
                >
                  Carica i tuoi CSV in Archivio
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
                    Vetrina dalla watchlist
                  </span>
                  <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
                    Ispirazione immediata o scelta su misura
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    Apri una locandina per leggere la trama oppure imposta mood e filtri a sinistra per 5 proposte mirate più 1 bonus.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowcaseSeed((s) => s + 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F5F7FA] px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    <span>Cambia</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSurprisePick}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Sorprendimi (1 film)</span>
                  </button>
                </div>
              </div>

              {/* 6-poster live showcase */}
              {showcaseFilms.length > 0 && (
                <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-3.5">
                  {showcaseFilms.map((film) => {
                    const key = filmKey(film);
                    const meta = metaMap[key];
                    const showcasePick = toShowcasePick(film, meta);
                    const preview = previews[key];
                    const title = displayTitle(film);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          onRequestPreview(showcasePick);
                          onOpenPreview(showcasePick);
                        }}
                        className="group text-left focus:outline-none"
                      >
                        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-slate-200/90 bg-[#F5F7FA] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:border-[#2563EB]/60 group-focus-visible:ring-2 group-focus-visible:ring-[#2563EB] dark:border-slate-800 dark:bg-[#0B0E14] dark:group-hover:border-[#3B82F6]/60">
                          <PosterImage
                            cacheKey={key}
                            title={title}
                            year={film.y}
                            posterUrl={preview?.posterUrl}
                            loading={preview?.loading}
                            compactFallback
                            className="h-full w-full"
                            onVisible={() => onRequestPreview(showcasePick)}
                          />
                        </div>
                        <div className="mt-2 truncate text-xs font-medium text-slate-800 transition-colors group-hover:text-[#2563EB] dark:text-slate-200 dark:group-hover:text-[#60A5FA]">
                          {title}
                        </div>
                        {film.y && (
                          <div className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                            {film.y}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Archive summary strip */}
              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-200/80 pt-5 dark:border-slate-800">
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
                <div className="mt-5 border-t border-slate-200/80 pt-4 dark:border-slate-800">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Il tuo profilo gusti
                  </div>
                  <p className="line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {profile}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="mt-2 text-xs font-medium text-[#2563EB] underline-offset-4 hover:underline dark:text-[#60A5FA]"
                  >
                    Leggi o modifica il profilo completo
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!loading && picks.length > 0 && (
        <div className="space-y-8">
          {listPicks.length > 0 && (
            <div>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-200/80 pb-2.5 dark:border-slate-800">
                <div className="flex items-baseline gap-2.5">
                  <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                    Dalla tua watchlist
                  </h2>
                  <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {listPicks.length} {listPicks.length === 1 ? "proposta" : "proposte"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClearPicks}
                  className="text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Torna alla vetrina
                </button>
              </div>
              <div className="space-y-4">
                {listPicks.map((p, idx) => (
                  <PickCard
                    key={p.id}
                    pick={p}
                    indexLabel={String(idx + 1).padStart(2, "0")}
                    featured={idx === 0 && listPicks.length > 1}
                    meta={metaMap[filmKey(p.film)]}
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
              <div className="mb-3 flex items-baseline justify-between border-b border-slate-200/80 pb-2.5 dark:border-slate-800">
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
                    meta={metaMap[filmKey(p.film)]}
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
