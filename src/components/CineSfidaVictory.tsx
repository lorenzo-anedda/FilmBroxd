import React from "react";
import { Award, Clapperboard, Film, Play, RotateCcw, Sparkles } from "lucide-react";
import { displayTitle, nz, safeExternalUrl } from "../utils/filmHelpers";
import type { ChampionDefeatStep } from "../utils/tournament";
import type { FilmItem, FilmMeta, FilmPreviewData } from "../types";

interface CineSfidaVictoryProps {
  champion: FilmItem;
  meta?: FilmMeta;
  preview?: FilmPreviewData;
  path: ChampionDefeatStep[];
  canWatchTonight: boolean;
  watchedConfirmed: boolean;
  onWatchTonight: () => void;
  onPlayAgain: () => void;
}

export const CineSfidaVictory: React.FC<CineSfidaVictoryProps> = ({
  champion,
  meta,
  preview,
  path,
  canWatchTonight,
  watchedConfirmed,
  onWatchTonight,
  onPlayAgain,
}) => {
  const title = displayTitle(champion);
  const originalDiffers =
    title.toLowerCase() !== champion.t.toLowerCase() ? champion.t : "";

  const metaParts: string[] = [];
  if (champion.y) metaParts.push(champion.y);
  if (meta && nz(meta.d)) metaParts.push(`Regia: ${meta.d}`);
  if (meta && meta.m > 0) metaParts.push(`${meta.m} min`);
  if (meta && nz(meta.g)) metaParts.push(meta.g);

  return (
    <section
      aria-label="Vincitore del torneo ReelRouette"
      className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-950 text-white shadow-xl dark:border-slate-800"
    >
      {/* Opening theater curtains */}
      <div
        aria-hidden="true"
        className="cinema-curtain-left pointer-events-none absolute inset-y-0 left-0 z-30 w-1/2 bg-gradient-to-r from-[#090D16] via-[#131C31] to-[#1D2B4C] border-r border-amber-400/20"
      />
      <div
        aria-hidden="true"
        className="cinema-curtain-right pointer-events-none absolute inset-y-0 right-0 z-30 w-1/2 bg-gradient-to-l from-[#090D16] via-[#131C31] to-[#1D2B4C] border-l border-amber-400/20"
      />

      {/* Projector spotlight glow */}
      <div
        aria-hidden="true"
        className="cinema-halo-pulse pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.18),_rgba(37,99,235,0.14)_45%,_transparent_75%)]"
      />

      {/* 35mm film strip sprocket border top */}
      <div
        aria-hidden="true"
        className="relative z-10 flex h-5 items-center justify-between border-b border-slate-800/90 bg-black/50 px-3"
      >
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="h-2.5 w-3.5 rounded-[2px] border border-slate-700/70 bg-slate-900/90"
          />
        ))}
      </div>

      {/* Floating cinema golden stars */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        <Sparkles className="cinema-star-float-1 absolute left-[12%] top-[28%] h-4 w-4 text-amber-300/80" />
        <Sparkles className="cinema-star-float-2 absolute right-[15%] top-[24%] h-5 w-5 text-amber-400/80" />
        <Sparkles className="cinema-star-float-3 absolute left-[48%] top-[16%] h-4 w-4 text-amber-200/75" />
      </div>

      <div className="cinema-victory-reveal relative z-20 p-6 sm:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="inline-flex items-center gap-2.5 text-amber-300">
              <Award className="h-5 w-5 shrink-0" />
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em]">
                Campione ReelRouette · Palma della Serata
              </span>
            </div>
            <span className="font-mono text-xs tabular-nums text-slate-400">
              {path.length} turni vinti su {path.length}
            </span>
          </div>

          <div className="grid items-center gap-8 md:grid-cols-[220px_1fr]">
            {/* Champion Poster with golden cinema frame */}
            <div className="mx-auto w-44 sm:w-52 md:w-full">
              <div className="relative overflow-hidden rounded-xl border border-amber-400/45 bg-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.65)] aspect-[2/3]">
                {safeExternalUrl(preview?.posterUrl) ? (
                  <img
                    src={safeExternalUrl(preview?.posterUrl)!}
                    alt={`Locandina di ${title}`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-900 to-slate-950 p-4 text-center">
                    <Film className="h-10 w-10 text-amber-400/80" />
                    <span className="font-display text-sm font-semibold text-slate-200">
                      {title}
                    </span>
                  </div>
                )}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
                />
              </div>
            </div>

            {/* Champion Details & Actions */}
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl [text-wrap:balance]">
                  {title}
                </h2>
                {originalDiffers && (
                  <p className="mt-1 text-sm text-slate-400">
                    Titolo originale: {originalDiffers}
                  </p>
                )}
                {metaParts.length > 0 && (
                  <p className="mt-2.5 text-sm font-medium text-amber-200/90">
                    {metaParts.join(" · ")}
                  </p>
                )}
              </div>

              {preview?.description && (
                <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
                  {preview.description}
                </p>
              )}

              {/* Path of defeated opponents */}
              {path.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    <Clapperboard className="h-3.5 w-3.5 text-amber-300" />
                    <span>Il cammino verso la finale</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {path.map((step) => (
                      <div
                        key={step.roundName}
                        className="flex items-baseline justify-between gap-2 text-xs"
                      >
                        <span className="shrink-0 font-mono text-[11px] text-amber-300/90">
                          {step.roundName}
                        </span>
                        <span className="truncate text-slate-300">
                          batte {displayTitle(step.opponent)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {canWatchTonight && (
                  <button
                    type="button"
                    disabled={watchedConfirmed}
                    onClick={onWatchTonight}
                    className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      watchedConfirmed
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                        : "bg-amber-400 text-slate-950 hover:bg-amber-300"
                    }`}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>
                      {watchedConfirmed
                        ? "Segnato per stasera · in Cronologia"
                        : "Guardo questo stasera"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onPlayAgain}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Nuovo torneo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 35mm film strip sprocket border bottom */}
      <div
        aria-hidden="true"
        className="relative z-10 flex h-5 items-center justify-between border-t border-slate-800/90 bg-black/50 px-3"
      >
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="h-2.5 w-3.5 rounded-[2px] border border-slate-700/70 bg-slate-900/90"
          />
        ))}
      </div>
    </section>
  );
};
