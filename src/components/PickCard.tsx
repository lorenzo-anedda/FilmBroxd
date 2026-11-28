import React, { useState } from "react";
import {
  DISCARD_REASONS,
  displayTitle,
  filmKey,
  nz,
} from "../utils/filmLogic";
import { PosterImage } from "./PosterImage";
import type { ActivePick, FilmMeta, FilmPreviewData } from "../types";
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
  featured?: boolean;
  meta?: FilmMeta;
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
  featured = false,
  meta,
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
      <article className="rounded-2xl border border-cg-border bg-cg-surface/85 p-5">
        <p className="text-sm text-cg-secondary">
          {pick.statusMessage}
        </p>
        {pick.askWhy && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cg-border pt-3">
            <span className="text-xs font-medium text-cg-muted">
              {pick.whySaved ? `Annotato: ${pick.whySaved}` : "Motivo?"}
            </span>
            {!pick.whySaved &&
              DISCARD_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => onNoteReason(pick, reason)}
                  className="rounded-lg border border-cg-border bg-cg-elevated px-2.5 py-1 text-xs font-medium text-cg-secondary transition-colors hover:border-cg-border-strong hover:text-cg-text whitespace-nowrap shrink-0"
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
  const origDiffers =
    title.toLowerCase() !== pick.film.t.toLowerCase() ? pick.film.t : "";

  const metaParts: string[] = [];
  if (pick.regista) metaParts.push(pick.regista);
  if (pick.durata) metaParts.push(pick.durata);
  if (meta && nz(meta.g)) metaParts.push(meta.g);
  if (meta && nz(meta.c)) metaParts.push(meta.c);

  return (
    <article
      className={`rounded-2xl border bg-cg-surface p-5 sm:p-6 transition-colors ${
        featured
          ? "border-cg-accent/55 hover:border-cg-accent"
          : "border-cg-border hover:border-cg-border-strong"
      }`}
    >
      <div className="flex items-start gap-4 sm:gap-5">
        {/* Poster thumbnail button with IntersectionObserver lazy loading */}
        <button
          type="button"
          onClick={() => onOpenPreview(pick)}
          aria-label={`Apri anteprima di ${title}`}
          className={`group relative aspect-[2/3] shrink-0 overflow-hidden rounded-xl border border-cg-border bg-cg-elevated transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-cg-focus ${
            featured ? "w-24 sm:w-28" : "w-20 sm:w-24"
          }`}
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
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
              <span className="font-mono font-medium uppercase tracking-wider text-cg-muted">
                {indexLabel}
              </span>
              {featured && !pick.extra && (
                <>
                  <span className="text-cg-border-strong" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-medium text-cg-accent-text">
                    Prima scelta della serata
                  </span>
                </>
              )}
              {pick.extra && (
                <>
                  <span className="text-cg-border-strong" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-medium text-cg-accent-text">
                    Consiglio extra fuori lista
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenPreview(pick)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text whitespace-nowrap shrink-0"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Anteprima</span>
            </button>
          </div>

          <h3
            className={`font-display font-semibold leading-snug tracking-tight text-cg-text [text-wrap:balance] ${
              featured ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"
            }`}
          >
            {title}
            {pick.film.y ? (
              <span className="ml-2 font-mono text-sm font-normal tabular-nums text-cg-muted">
                ({pick.film.y})
              </span>
            ) : null}
          </h3>

          {origDiffers && (
            <p className="mt-0.5 text-xs text-cg-muted">
              {origDiffers}
            </p>
          )}

          {metaParts.length > 0 && (
            <p className="mt-1.5 text-xs leading-relaxed text-cg-muted">
              {metaParts.map((part, idx) => (
                <React.Fragment key={`${part}-${idx}`}>
                  {idx > 0 && (
                    <span
                      className="mx-1.5 text-cg-border-strong"
                      aria-hidden="true"
                    >
                      ·
                    </span>
                  )}
                  <span
                    className={
                      idx === 0 && pick.regista
                        ? "font-medium text-cg-secondary"
                        : idx === 1 && pick.durata
                        ? "font-mono tabular-nums"
                        : ""
                    }
                  >
                    {part}
                  </span>
                </React.Fragment>
              ))}
            </p>
          )}

          {preview?.loading ? (
            <div className="mt-2.5 space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-cg-elevated" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-cg-elevated" />
            </div>
          ) : preview?.description ? (
            <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-cg-muted">
              {preview.description}
            </p>
          ) : null}
        </div>
      </div>

      {pick.perche && (
        <p className="mt-4 border-t border-cg-border pt-3.5 text-[15px] leading-relaxed text-cg-secondary">
          {pick.perche}
        </p>
      )}

      {pick.ratingOpen ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-cg-border pt-3.5">
          <span className="mr-1 text-xs font-medium text-cg-muted">
            Che voto dai?
          </span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onRateSeen(pick, n)}
              className="rounded-lg border border-cg-border bg-cg-elevated px-3 py-1.5 font-mono text-xs font-medium tabular-nums text-cg-rating transition-colors hover:border-cg-accent hover:text-cg-accent-text whitespace-nowrap shrink-0"
            >
              {n}★
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5 border-t border-cg-border pt-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onWatchTonight(pick)}
                className="rounded-lg bg-cg-accent px-4 py-2 text-xs font-semibold text-cg-accent-fg transition-colors hover:bg-cg-accent-hover whitespace-nowrap shrink-0"
              >
                Guardo questo
              </button>
              <button
                type="button"
                disabled={pick.altLoading}
                onClick={() => onReplace(pick)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cg-border bg-cg-elevated px-3 py-2 text-xs font-medium text-cg-secondary transition-colors hover:border-cg-border-strong hover:text-cg-text disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${pick.altLoading ? "animate-spin" : ""}`}
                />
                {pick.altLoading ? "Cerco…" : "Un altro"}
              </button>
              <button
                type="button"
                onClick={() => onLater(pick)}
                className="rounded-lg border border-cg-border bg-transparent px-3 py-2 text-xs font-medium text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text whitespace-nowrap shrink-0"
              >
                Non stasera
              </button>
              <button
                type="button"
                onClick={() => onNever(pick)}
                className="rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text whitespace-nowrap shrink-0"
              >
                Mai
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {aiEnabled && (
              <button
                type="button"
                onClick={() => onExplainWhy(pick)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5 text-cg-accent-text" />
                <span>Perché proprio questo?</span>
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
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {pick.simLoading ? "Cerco simile…" : "Dammene un altro simile"}
            </button>
            <button
              type="button"
              aria-label="Altre azioni"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center rounded-lg px-2 py-1.5 text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text"
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
                className="rounded-lg border border-cg-border bg-cg-elevated px-3 py-1.5 text-xs font-medium text-cg-secondary transition-colors hover:border-cg-border-strong hover:text-cg-text whitespace-nowrap shrink-0"
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
                  className="rounded-lg border border-cg-border bg-cg-elevated px-3 py-1.5 text-xs font-medium text-cg-secondary transition-colors hover:border-cg-border-strong hover:text-cg-text whitespace-nowrap shrink-0"
                >
                  Aggiungi alla watchlist
                </button>
              )}
            </div>
          )}

          {pick.deepWhyOpen && (
            <div className="rounded-xl border border-cg-border bg-cg-elevated p-3.5 text-sm leading-relaxed text-cg-secondary">
              {pick.deepWhyLoading ? "Ci penso…" : pick.deepWhy}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
