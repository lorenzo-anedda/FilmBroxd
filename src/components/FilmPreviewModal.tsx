import React, { useEffect } from "react";
import { X, ExternalLink, Star, RotateCcw } from "lucide-react";
import {
  canonicalLabel,
  displayTitle,
  filmKey,
  nz,
  safeExternalUrl,
} from "../utils/filmLogic";
import { formatPersonalRating } from "../utils/libraryHelpers";
import { PosterImage } from "./PosterImage";
import type { ActivePick, FilmItem, FilmMeta, FilmPreviewData } from "../types";

export interface FilmDetailModalProps {
  open: boolean;
  film: FilmItem | null;
  preview?: FilmPreviewData;
  meta?: FilmMeta;
  regista?: string;
  durata?: string;
  statusLabel?: string;
  personalRating?: number | null;
  ratingScaleMax?: 5 | 10;
  rewatch?: boolean;
  extra?: boolean;
  noteTitle?: string;
  noteText?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onVisiblePoster?: () => void;
  onClose: () => void;
}

export const FilmDetailModal: React.FC<FilmDetailModalProps> = ({
  open,
  film,
  preview,
  meta,
  regista,
  durata,
  statusLabel,
  personalRating,
  ratingScaleMax = 5,
  rewatch = false,
  extra = false,
  noteTitle,
  noteText,
  primaryActionLabel,
  onPrimaryAction,
  onVisiblePoster,
  onClose,
}) => {
  useEffect(() => {
    if (!open || !film) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, film, onClose]);

  if (!open || !film) return null;

  const title = displayTitle(film);
  const showOriginal =
    Boolean(film.it) && film.it!.toLowerCase() !== film.t.toLowerCase();
  const letterboxdUrl = `https://letterboxd.com/search/${encodeURIComponent(
    canonicalLabel(film)
  )}/`;
  const safeWikiUrl = safeExternalUrl(preview?.wikiUrl, ["wikipedia.org"]);

  const effectiveDirector = regista || (nz(meta?.d) ? meta!.d : "");
  const effectiveDuration =
    durata || (meta?.m && meta.m > 0 ? `${meta.m} min` : "");
  const effectiveGenre = nz(meta?.g) ? meta!.g.replace(/\//g, " · ") : "";
  const effectiveCountry = nz(meta?.c) ? meta!.c.replace(/\//g, ", ") : "";
  const effectiveCast = nz(meta?.a)
    ? meta!.a!
        .split(/[/,]/)
        .map((s) => s.trim())
        .filter((s) => s && s.toLowerCase() !== "null")
        .join(", ")
    : "";

  const metaParts = [
    effectiveDirector,
    effectiveDuration,
    effectiveGenre,
    effectiveCountry,
  ].filter(Boolean);

  const formattedRating = formatPersonalRating(
    personalRating ?? null,
    ratingScaleMax
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--cg-backdrop)] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cg-border bg-cg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi scheda film"
          className="sticky float-right right-4 top-4 z-10 mr-4 mt-4 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cg-border bg-cg-surface/95 text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:gap-6 sm:p-7">
          {/* Poster with IntersectionObserver lazy loading & dominant-color placeholder */}
          <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-48">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-cg-border bg-cg-elevated">
              <PosterImage
                cacheKey={filmKey(film)}
                title={title}
                year={film.y}
                posterUrl={preview?.posterUrl}
                loading={preview?.loading}
                rootMargin="0px"
                className="h-full w-full"
                onVisible={onVisiblePoster}
              />
            </div>
          </div>

          {/* Details */}
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div>
              {(extra || statusLabel || formattedRating || rewatch) && (
                <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                  {extra && (
                    <span className="font-mono font-medium uppercase tracking-wider text-cg-accent-text">
                      Fuori lista
                    </span>
                  )}
                  {statusLabel && (
                    <span className="font-mono font-medium uppercase tracking-wider text-cg-accent-text">
                      {statusLabel}
                    </span>
                  )}
                  {formattedRating && (
                    <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-cg-rating">
                      <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      <span>{formattedRating}</span>
                    </span>
                  )}
                  {rewatch && (
                    <span className="inline-flex items-center gap-1 text-cg-muted">
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                      <span>Rivisto</span>
                    </span>
                  )}
                </div>
              )}

              <h2
                id="preview-modal-title"
                className="pr-8 font-display text-2xl font-bold leading-tight tracking-tight text-cg-text text-balance"
              >
                {title}
                {film.y && (
                  <span className="ml-2 font-mono text-base font-normal tabular-nums text-cg-muted">
                    ({film.y})
                  </span>
                )}
              </h2>

              {showOriginal && (
                <p className="mt-1 text-xs text-cg-muted">
                  Titolo originale: {film.t}
                </p>
              )}

              {metaParts.length > 0 && (
                <p className="mt-2.5 text-xs font-medium text-cg-muted">
                  {metaParts.join(" · ")}
                </p>
              )}

              {effectiveCast && (
                <p className="mt-2 text-xs text-cg-secondary">
                  <span className="font-semibold text-cg-muted">Cast: </span>
                  {effectiveCast}
                </p>
              )}

              {/* Synopsis */}
              <div className="mt-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-cg-muted">
                  Sinossi
                </div>
                {preview?.loading ? (
                  <div className="space-y-2">
                    <div className="h-3.5 w-full animate-pulse rounded bg-cg-elevated" />
                    <div className="h-3.5 w-5/6 animate-pulse rounded bg-cg-elevated" />
                  </div>
                ) : preview?.description ? (
                  <p className="text-sm leading-relaxed text-cg-secondary">
                    {preview.description}
                  </p>
                ) : (
                  <p className="text-sm italic text-cg-muted">
                    Descrizione breve non disponibile per questo titolo.
                  </p>
                )}
              </div>

              {/* Recommendation note */}
              {noteText && (
                <div className="mt-4 rounded-xl border border-cg-border bg-cg-elevated p-3.5">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-cg-accent-text">
                    {noteTitle || "Nota"}
                  </div>
                  <p className="text-sm leading-relaxed text-cg-secondary">
                    {noteText}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-cg-border pt-4">
              {primaryActionLabel && onPrimaryAction && (
                <button
                  type="button"
                  onClick={() => {
                    onPrimaryAction();
                    onClose();
                  }}
                  className="rounded-lg bg-cg-accent px-4 py-2 text-xs font-semibold text-cg-accent-fg transition-colors hover:bg-cg-accent-hover whitespace-nowrap shrink-0"
                >
                  {primaryActionLabel}
                </button>
              )}
              <a
                href={letterboxdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-cg-border bg-cg-elevated px-3.5 py-2 text-xs font-medium text-cg-secondary transition-colors hover:border-cg-border-strong hover:text-cg-text whitespace-nowrap shrink-0"
              >
                Letterboxd
                <ExternalLink className="h-3 w-3" />
              </a>
              {safeWikiUrl && (
                <a
                  href={safeWikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cg-border bg-transparent px-3.5 py-2 text-xs font-medium text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text whitespace-nowrap shrink-0"
                >
                  Wikipedia
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FilmPreviewModalProps {
  pick: ActivePick | null;
  preview?: FilmPreviewData;
  meta?: FilmMeta;
  onRequestPreview?: (pick: ActivePick) => void;
  onClose: () => void;
  onWatchTonight: (pick: ActivePick) => void;
}

export const FilmPreviewModal: React.FC<FilmPreviewModalProps> = ({
  pick,
  preview,
  meta,
  onRequestPreview,
  onClose,
  onWatchTonight,
}) => {
  return (
    <FilmDetailModal
      open={Boolean(pick)}
      film={pick?.film ?? null}
      preview={preview}
      meta={meta}
      regista={pick?.regista}
      durata={pick?.durata}
      extra={pick?.extra}
      noteTitle="Perché stasera"
      noteText={pick?.perche}
      primaryActionLabel={pick?.status === "active" ? "Guardo questo" : undefined}
      onPrimaryAction={
        pick?.status === "active" ? () => onWatchTonight(pick) : undefined
      }
      onVisiblePoster={pick ? () => onRequestPreview?.(pick) : undefined}
      onClose={onClose}
    />
  );
};
