import React, { useMemo, useState } from "react";
import { AlertCircle, Shuffle, Sparkles } from "lucide-react";
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
          className="mb-6 flex items-start gap-2.5 rounded-2xl border border-cg-error-border bg-cg-error-bg p-4 text-sm text-cg-error"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{stageError}</span>
        </div>
      )}

      {stageNotice && !loading && (
        <p className="mb-5 text-sm text-cg-secondary">
          {stageNotice}
        </p>
      )}

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="flex gap-4 rounded-2xl border border-cg-border bg-cg-surface p-6"
            >
              <div className="aspect-[2/3] w-20 shrink-0 animate-pulse rounded-xl bg-cg-elevated sm:w-24" />
              <div className="flex-1 space-y-3">
                <div className="h-3 w-20 animate-pulse rounded bg-cg-elevated" />
                <div className="h-6 w-2/3 animate-pulse rounded bg-cg-elevated" />
                <div className="h-3.5 w-44 animate-pulse rounded bg-cg-elevated" />
                <div className="h-12 w-full animate-pulse rounded bg-cg-elevated" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && picks.length === 0 && (
        <div className="rounded-2xl border border-cg-border bg-cg-surface p-6 sm:p-8">
          {watchlistCount === 0 ? (
            <>
              <span className="font-mono text-xs uppercase tracking-wider text-cg-accent-text">
                Nessuna lista caricata
              </span>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-cg-text [text-wrap:balance]">
                Carica la tua watchlist Letterboxd
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-cg-muted">
                La watchlist è attualmente vuota. Vai in Archivio per caricare il tuo watchlist.csv (e facoltativamente watched.csv e ratings.csv) esportato da Letterboxd.
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={onOpenArchive}
                  className="rounded-xl bg-cg-accent px-4 py-2.5 text-xs font-semibold text-cg-accent-fg transition-colors hover:bg-cg-accent-hover"
                >
                  Carica i tuoi CSV in Archivio
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-cg-accent-text">
                    Vetrina dalla watchlist
                  </span>
                  <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-cg-text [text-wrap:balance]">
                    Ispirazione immediata o scelta su misura
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-cg-muted">
                    Apri una locandina per leggere la trama oppure imposta mood e filtri a sinistra per 5 proposte mirate più 1 bonus.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowcaseSeed((s) => s + 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-cg-border bg-cg-elevated px-3 py-2 text-xs font-medium text-cg-secondary transition-colors hover:border-cg-border-strong hover:text-cg-text whitespace-nowrap"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    <span>Cambia</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSurprisePick}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cg-accent px-3.5 py-2 text-xs font-semibold text-cg-accent-fg transition-colors hover:bg-cg-accent-hover whitespace-nowrap"
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
                        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-cg-border bg-cg-elevated transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:border-cg-accent group-focus-visible:ring-2 group-focus-visible:ring-cg-focus">
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
                        <div className="mt-2 truncate text-xs font-medium text-cg-text transition-colors group-hover:text-cg-accent-text">
                          {title}
                        </div>
                        {film.y && (
                          <div className="font-mono text-[11px] tabular-nums text-cg-muted">
                            {film.y}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Archive summary strip */}
              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-cg-border pt-5">
                <div>
                  <div className="text-xs text-cg-muted">
                    In watchlist
                  </div>
                  <div className="mt-0.5 font-mono text-xl font-medium tabular-nums text-cg-text">
                    {watchlistCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-cg-muted">
                    Film visti
                  </div>
                  <div className="mt-0.5 font-mono text-xl font-medium tabular-nums text-cg-text">
                    {seenCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-cg-muted">
                    Media voti
                  </div>
                  <div className="mt-0.5 font-mono text-xl font-medium tabular-nums text-cg-rating">
                    {avgRating ? `${avgRating.toFixed(1)}★` : "—"}
                  </div>
                </div>
              </div>

              {profile && (
                <div className="mt-5 border-t border-cg-border pt-4">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-cg-muted">
                    Il tuo profilo gusti
                  </div>
                  <p className="line-clamp-3 text-sm leading-relaxed text-cg-secondary">
                    {profile}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="mt-2 text-xs font-medium text-cg-accent-text underline-offset-4 hover:underline"
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
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-cg-border pb-2.5">
                <div className="flex items-baseline gap-2.5">
                  <h2 className="font-display text-xl font-semibold text-cg-text">
                    Dalla tua watchlist
                  </h2>
                  <span className="font-mono text-xs tabular-nums text-cg-muted">
                    {listPicks.length} {listPicks.length === 1 ? "proposta" : "proposte"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClearPicks}
                  className="text-xs font-medium text-cg-muted underline-offset-4 hover:text-cg-text hover:underline"
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
              <div className="mb-3 flex items-baseline justify-between border-b border-cg-border pb-2.5">
                <h2 className="font-display text-xl font-semibold text-cg-text">
                  Bonus fuori dalla watchlist
                </h2>
                <span className="font-mono text-xs text-cg-muted">
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
