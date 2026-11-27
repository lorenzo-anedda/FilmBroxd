import React, { useState } from "react";
import { DISCARD_REASONS, displayTitle, filmKey } from "../utils/filmLogic";
import { PosterImage } from "./PosterImage";
import type { ActivePick, FilmPreviewData } from "../types";
import {
  MoreHorizontal,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";

interface PickCardProps {
  pick: ActivePick;
  indexLabel: string;
  aiEnabled: boolean;
  preview?: FilmPreviewData;
  onVisible?: (pick: ActivePick) => void;
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

export const PickCard: React.FC<PickCardProps> = ({
  pick,
  indexLabel,
  aiEnabled,
  preview,
  onVisible,
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
  const [menuOpen, setMenuOpen] = useState(false);

  if (pick.status === "done") {
    return (
      <article className="rounded-2xl border border-slate-200/80 bg-white/75 p-5 dark:border-slate-800 dark:bg-[#131722]/75">
        <p className="text-sm text-slate-600 dark:text-slate-300">{pick.statusMessage}</p>
        {pick.askWhy && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {pick.whySaved ? `Annotato: ${pick.whySaved}` : "Motivo?"}
            </span>
            {!pick.whySaved &&
              DISCARD_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => onNoteReason(pick, reason)}
                  className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {reason}
                </button>
              ))}
          </div>
        )}
      </article>
    );
  }

  const title = displayTitle(pick.film);

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-[#131722] dark:hover:border-slate-700">
      <div className="flex items-start gap-4 sm:gap-5">
        {/* Poster thumbnail button with IntersectionObserver lazy loading */}
        <button
          type="button"
          onClick={() => onOpenPreview(pick)}
          aria-label={`Apri anteprima di ${title}`}
          className="group relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-[#F5F7FA] transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#2563EB] sm:w-24 dark:border-slate-800 dark:bg-[#0B0E14] dark:focus:ring-[#3B82F6]"
        >
          <PosterImage
            cacheKey={filmKey(pick.film)}
            title={title}
            year={pick.film.y}
            posterUrl={preview?.posterUrl}
            loading={preview?.loading}
            compactFallback
            className="h-full w-full"
            onVisible={() => onVisible?.(pick)}
          />
        </button>

        {/* Main title + metadata + short description */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {indexLabel}
              </span>
              {pick.extra && (
                <span className="font-mono text-xs font-medium uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
                  Fuori lista
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenPreview(pick)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Anteprima</span>
            </button>
          </div>

          <h3 className="font-display text-xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-100">
            {title}
            {pick.film.y ? (
              <span className="ml-2 font-mono text-sm font-normal tabular-nums text-slate-500 dark:text-slate-400">
                ({pick.film.y})
              </span>
            ) : null}
          </h3>

          {(pick.regista || pick.durata) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-600 dark:text-slate-400">
              {pick.regista && (
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {pick.regista}
                </span>
              )}
              {pick.regista && pick.durata && <span aria-hidden="true">·</span>}
              {pick.durata && (
                <span className="font-mono text-xs tabular-nums">{pick.durata}</span>
              )}
            </div>
          )}

          {preview?.loading ? (
            <div className="mt-2.5 space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-slate-200/80 dark:bg-slate-800/80" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800/80" />
            </div>
          ) : preview?.description ? (
            <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
              {preview.description}
            </p>
          ) : null}
        </div>
      </div>

      {pick.perche && (
        <p className="mt-3.5 text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
          {pick.perche}
        </p>
      )}

      {pick.ratingOpen ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3.5 dark:border-slate-800">
          <span className="mr-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Che voto dai?
          </span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onRateSeen(pick, n)}
              className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-1.5 font-mono text-xs font-medium tabular-nums text-slate-800 transition-colors hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-200 dark:hover:border-[#60A5FA] dark:hover:text-[#60A5FA]"
            >
              {n}★
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2.5 border-t border-slate-200/80 pt-3.5 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onWatchTonight(pick)}
              className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap shrink-0 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
            >
              Guardo questo
            </button>
            <button
              type="button"
              disabled={pick.altLoading}
              onClick={() => onReplace(pick)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pick.altLoading ? "animate-spin" : ""}`} />
              {pick.altLoading ? "Cerco…" : "Un altro"}
            </button>
            <button
              type="button"
              onClick={() => onLater(pick)}
              className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Non stasera
            </button>
            <button
              type="button"
              onClick={() => onNever(pick)}
              className="rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              Mai
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {aiEnabled && (
              <button
                type="button"
                onClick={() => onExplainWhy(pick)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
                Perché proprio questo?
                {pick.deepWhy &&
                  (pick.deepWhyOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ))}
              </button>
            )}
            <button
              type="button"
              disabled={pick.simLoading}
              onClick={() => onSimilar(pick)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 whitespace-nowrap shrink-0 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {pick.simLoading ? "Cerco simile…" : "Dammene un altro simile"}
            </button>
            <button
              type="button"
              aria-label="Altre azioni"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center rounded-lg px-2 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {menuOpen && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRateSeen(pick, -1);
                }}
                className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
              >
                L’ho già visto
              </button>
              {pick.extra && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onAddExtraToList(pick);
                  }}
                  className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Aggiungi alla watchlist
                </button>
              )}
            </div>
          )}

          {pick.deepWhyOpen && (
            <div className="rounded-xl border border-slate-200/80 bg-[#F5F7FA] p-3.5 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-[#0B0E14] dark:text-slate-300">
              {pick.deepWhyLoading ? "Ci penso…" : pick.deepWhy}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
