import React from "react";
import { Star } from "lucide-react";
import { PosterImage } from "./PosterImage";
import {
  formatPersonalRating,
  type LibraryEntry,
  type LibraryViewMode,
} from "../utils/libraryHelpers";
import type { FilmPreviewData } from "../types";

interface LibraryFilmCardProps {
  entry: LibraryEntry;
  mode: LibraryViewMode;
  scaleMax: 5 | 10;
  preview?: FilmPreviewData;
  onVisible: (entry: LibraryEntry) => void;
  onSelect: (entry: LibraryEntry) => void;
}

export const LibraryFilmCard: React.FC<LibraryFilmCardProps> = React.memo(
  ({ entry, mode, scaleMax, preview, onVisible, onSelect }) => {
    const ratingText =
      entry.status === "watched"
        ? formatPersonalRating(entry.rating, scaleMax)
        : "";
    const showOriginal =
      Boolean(entry.italianTitle) &&
      entry.originalTitle.toLowerCase() !== entry.title.toLowerCase();

    if (mode === "list") {
      const metaItems = [
        entry.director,
        entry.genres.length > 0 ? entry.genres.join(" / ") : "",
        entry.runtime ? `${entry.runtime} min` : "",
      ].filter(Boolean);

      return (
        <button
          type="button"
          onClick={() => onSelect(entry)}
          className="group flex w-full items-center gap-3.5 rounded-xl border border-cg-border bg-cg-surface px-3.5 py-2.5 text-left transition-colors hover:border-cg-border-strong hover:bg-cg-elevated/60 sm:gap-4 sm:px-4"
        >
          <div className="w-11 shrink-0 overflow-hidden rounded-lg border border-cg-border bg-cg-elevated sm:w-12">
            <div className="aspect-[2/3] w-full">
              <PosterImage
                cacheKey={entry.key}
                title={entry.title}
                year={entry.year}
                posterUrl={preview?.posterUrl}
                loading={preview?.loading}
                compactFallback
                rootMargin="160px 0px"
                className="h-full w-full"
                onVisible={() => onVisible(entry)}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-display text-sm font-semibold leading-snug text-cg-text group-hover:text-cg-accent-text transition-colors sm:text-base">
                {entry.title}
              </span>
              {entry.year && (
                <span className="font-mono text-xs tabular-nums text-cg-muted">
                  {entry.year}
                </span>
              )}
            </div>

            {showOriginal && (
              <div className="mt-0.5 truncate text-xs text-cg-muted">
                {entry.originalTitle}
              </div>
            )}

            {metaItems.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-cg-secondary sm:hidden">
                {metaItems.map((part, idx) => (
                  <React.Fragment key={`${part}-${idx}`}>
                    {idx > 0 && (
                      <span aria-hidden="true" className="text-cg-muted">
                        ·
                      </span>
                    )}
                    <span>{part}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          <div className="hidden min-w-0 flex-1 items-center gap-5 text-xs text-cg-secondary sm:flex lg:max-w-lg">
            <span className="min-w-0 flex-1 truncate">
              {entry.director || "—"}
            </span>
            <span className="min-w-0 flex-1 truncate text-cg-muted">
              {entry.genres.length > 0 ? entry.genres.join(" / ") : "—"}
            </span>
            <span className="w-16 shrink-0 text-right font-mono tabular-nums text-cg-muted">
              {entry.runtime ? `${entry.runtime} min` : "—"}
            </span>
          </div>

          {entry.status === "watched" && (
            <div className="w-16 shrink-0 text-right font-mono text-xs font-semibold tabular-nums">
              {ratingText ? (
                <span className="inline-flex items-center justify-end gap-1 text-cg-rating">
                  <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                  <span>{ratingText}</span>
                </span>
              ) : (
                <span className="text-cg-muted">—</span>
              )}
            </div>
          )}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onSelect(entry)}
        title={
          showOriginal
            ? `${entry.title} — ${entry.originalTitle}${
                entry.year ? ` (${entry.year})` : ""
              }`
            : `${entry.title}${entry.year ? ` (${entry.year})` : ""}`
        }
        className="group flex flex-col overflow-hidden rounded-xl border border-cg-border bg-cg-surface text-left transition-colors hover:border-cg-border-strong"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-cg-elevated">
          <PosterImage
            cacheKey={entry.key}
            title={entry.title}
            year={entry.year}
            posterUrl={preview?.posterUrl}
            loading={preview?.loading}
            rootMargin="180px 0px"
            className="h-full w-full"
            imgClassName="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03] motion-reduce:transition-none"
            onVisible={() => onVisible(entry)}
          />
        </div>

        <div className="flex flex-1 flex-col justify-between gap-1.5 p-2.5 sm:p-3">
          <div className="line-clamp-2 font-display text-sm font-semibold leading-snug text-cg-text transition-colors group-hover:text-cg-accent-text">
            {entry.title}
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono tabular-nums text-cg-muted">
              {entry.year || "—"}
            </span>
            {ratingText && (
              <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-cg-rating">
                <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                <span>{ratingText}</span>
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }
);

LibraryFilmCard.displayName = "LibraryFilmCard";
