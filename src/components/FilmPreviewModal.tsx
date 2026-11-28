import React, { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import { canonicalLabel, displayTitle, filmKey, safeExternalUrl } from "../utils/filmLogic";
import { PosterImage } from "./PosterImage";
import type { ActivePick, FilmMeta, FilmPreviewData } from "../types";

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
  useEffect(() => {
    if (!pick) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pick, onClose]);

  if (!pick) return null;

  const title = displayTitle(pick.film);
  const showOriginal =
    pick.film.it && pick.film.it.toLowerCase() !== pick.film.t.toLowerCase();
  const letterboxdUrl = `https://letterboxd.com/search/${encodeURIComponent(
    canonicalLabel(pick.film)
  )}/`;
  const safeWikiUrl = safeExternalUrl(preview?.wikiUrl, ["wikipedia.org"]);

  const metaParts = [
    pick.regista,
    pick.durata,
    meta?.g ? meta.g.replace(/\//g, " · ") : "",
    meta?.c ? meta.c.replace(/\//g, ", ") : "",
  ].filter(Boolean);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--cg-backdrop)] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-cg-border bg-cg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi anteprima"
          className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cg-border bg-cg-surface/95 text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:gap-6 sm:p-7">
          {/* Poster with IntersectionObserver lazy loading & dominant-color placeholder */}
          <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-48">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-cg-border bg-cg-elevated">
              <PosterImage
                cacheKey={filmKey(pick.film)}
                title={title}
                year={pick.film.y}
                posterUrl={preview?.posterUrl}
                loading={preview?.loading}
                rootMargin="0px"
                className="h-full w-full"
                onVisible={() => onRequestPreview?.(pick)}
              />
            </div>
          </div>

          {/* Details */}
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div>
              {pick.extra && (
                <span className="mb-1 inline-block font-mono text-xs font-medium uppercase tracking-wider text-cg-accent-text">
                  Fuori lista
                </span>
              )}

              <h2
                id="preview-modal-title"
                className="pr-8 font-display text-2xl font-bold leading-tight tracking-tight text-cg-text"
              >
                {title}
                {pick.film.y && (
                  <span className="ml-2 font-mono text-base font-normal tabular-nums text-cg-muted">
                    ({pick.film.y})
                  </span>
                )}
              </h2>

              {showOriginal && (
                <p className="mt-0.5 text-xs text-cg-muted">
                  Titolo originale: {pick.film.t}
                </p>
              )}

              {metaParts.length > 0 && (
                <p className="mt-2 text-xs font-medium text-cg-muted">
                  {metaParts.join(" · ")}
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
              {pick.perche && (
                <div className="mt-4 rounded-xl border border-cg-border bg-cg-elevated p-3.5">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-cg-accent-text">
                    Perché stasera
                  </div>
                  <p className="text-sm leading-relaxed text-cg-secondary">
                    {pick.perche}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-cg-border pt-4">
              {pick.status === "active" && (
                <button
                  type="button"
                  onClick={() => {
                    onWatchTonight(pick);
                    onClose();
                  }}
                  className="rounded-lg bg-cg-accent px-4 py-2 text-xs font-semibold text-cg-accent-fg transition-colors hover:bg-cg-accent-hover whitespace-nowrap shrink-0"
                >
                  Guardo questo
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
