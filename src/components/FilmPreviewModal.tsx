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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#131722]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi anteprima"
          className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-[#0B0E14]/90 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:gap-6 sm:p-7">
          {/* Poster with IntersectionObserver lazy loading & dominant-color placeholder */}
          <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-48">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-[#F5F7FA] dark:border-slate-800 dark:bg-[#0B0E14]">
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
                <span className="mb-1 inline-block font-mono text-xs font-medium uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
                  Fuori lista
                </span>
              )}

              <h2
                id="preview-modal-title"
                className="pr-8 font-display text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white"
              >
                {title}
                {pick.film.y && (
                  <span className="ml-2 font-mono text-base font-normal tabular-nums text-slate-500 dark:text-slate-400">
                    ({pick.film.y})
                  </span>
                )}
              </h2>

              {showOriginal && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Titolo originale: {pick.film.t}
                </p>
              )}

              {metaParts.length > 0 && (
                <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  {metaParts.join(" · ")}
                </p>
              )}

              {/* Synopsis */}
              <div className="mt-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Sinossi
                </div>
                {preview?.loading ? (
                  <div className="space-y-2">
                    <div className="h-3.5 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-3.5 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  </div>
                ) : preview?.description ? (
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {preview.description}
                  </p>
                ) : (
                  <p className="text-sm italic text-slate-500 dark:text-slate-400">
                    Descrizione breve non disponibile per questo titolo.
                  </p>
                )}
              </div>

              {/* Recommendation note */}
              {pick.perche && (
                <div className="mt-4 rounded-xl border border-slate-200/80 bg-[#F5F7FA] p-3.5 dark:border-slate-800 dark:bg-[#0B0E14]">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
                    Perché stasera
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {pick.perche}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-800">
              {pick.status === "active" && (
                <button
                  type="button"
                  onClick={() => {
                    onWatchTonight(pick);
                    onClose();
                  }}
                  className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap shrink-0 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
                >
                  Guardo questo
                </button>
              )}
              <a
                href={letterboxdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F5F7FA] px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Letterboxd
                <ExternalLink className="h-3 w-3" />
              </a>
              {safeWikiUrl && (
                <a
                  href={safeWikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-transparent px-3.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
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
