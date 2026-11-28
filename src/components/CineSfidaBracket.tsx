import React from "react";
import { Clapperboard } from "lucide-react";
import { displayTitle, filmKey, safeExternalUrl } from "../utils/filmHelpers";
import { getRoundShortNames, type BracketMatch } from "../utils/tournament";
import type { FilmItem, FilmPreviewData } from "../types";

interface CineSfidaBracketProps {
  rounds: BracketMatch[][];
  activePos: { roundIdx: number; matchIdx: number } | null;
  previews: Record<string, FilmPreviewData>;
  recentlyAdvancedKey?: string | null;
}

const BracketSlot: React.FC<{
  film: FilmItem | null;
  isWinner: boolean;
  isEliminated: boolean;
  isRecentlyAdvanced: boolean;
  preview?: FilmPreviewData;
}> = ({ film, isWinner, isEliminated, isRecentlyAdvanced, preview }) => {
  if (!film) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-cg-border bg-cg-bg/70 px-2 py-1.5 text-[11px] text-cg-muted">
        <div className="h-6 w-4 shrink-0 rounded-[2px] bg-cg-elevated" />
        <span className="truncate">In attesa…</span>
      </div>
    );
  }

  const title = displayTitle(film);
  const safePosterUrl = safeExternalUrl(preview?.posterUrl);

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-all duration-200 ${
        isRecentlyAdvanced ? "bracket-pop" : ""
      } ${
        isWinner
          ? "bg-cg-accent-soft text-cg-accent-text"
          : isEliminated
          ? "opacity-40 text-cg-muted"
          : "text-cg-text"
      }`}
    >
      <div className="h-6 w-4 shrink-0 overflow-hidden rounded-[2px] bg-cg-elevated">
        {safePosterUrl ? (
          <img
            src={safePosterUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-cg-muted">
            <Clapperboard className="h-2.5 w-2.5" />
          </div>
        )}
      </div>
      <span
        className={`min-w-0 flex-1 truncate text-[11px] ${
          isWinner ? "font-semibold" : "font-medium"
        }`}
        title={title}
      >
        {title}
      </span>
      {film.y && (
        <span className="shrink-0 font-mono text-[10px] tabular-nums opacity-70">
          {film.y}
        </span>
      )}
    </div>
  );
};

export const CineSfidaBracket: React.FC<CineSfidaBracketProps> = ({
  rounds,
  activePos,
  previews,
  recentlyAdvancedKey,
}) => {
  const shortNames = getRoundShortNames(rounds.length);
  const isQuarters = rounds.length === 3;

  return (
    <section className="rounded-2xl border border-cg-border bg-cg-surface p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-cg-border pb-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-cg-text">
            Tabellone del torneo
          </h3>
          <p className="text-xs text-cg-muted">
            {isQuarters
              ? "Segui l’avanzamento dai Quarti fino alla Finale."
              : "Segui l’avanzamento dagli Ottavi fino alla Finale."}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className={`grid gap-4 ${
            isQuarters
              ? "min-w-[600px] grid-cols-3"
              : "min-w-[780px] grid-cols-4"
          }`}
        >
          {rounds.map((matches, rIdx) => (
            <div key={shortNames[rIdx]} className="flex flex-col">
              <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-cg-muted">
                <span>{shortNames[rIdx]}</span>
                <span className="font-mono text-[11px] tabular-nums">
                  {matches.filter((m) => m.winner).length}/{matches.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col justify-around gap-3">
                {matches.map((match, mIdx) => {
                  const isCurrent =
                    activePos?.roundIdx === rIdx &&
                    activePos?.matchIdx === mIdx;
                  const winKey = match.winner ? filmKey(match.winner) : null;
                  const keyA = match.a ? filmKey(match.a) : null;
                  const keyB = match.b ? filmKey(match.b) : null;

                  return (
                    <div
                      key={match.id}
                      className={`rounded-xl border p-1.5 transition-colors ${
                        isCurrent
                          ? "border-cg-accent bg-cg-accent-soft"
                          : "border-cg-border bg-cg-bg/70"
                      }`}
                    >
                      <div className="space-y-1">
                        <BracketSlot
                          film={match.a}
                          isWinner={Boolean(winKey && keyA === winKey)}
                          isEliminated={Boolean(winKey && keyA && keyA !== winKey)}
                          isRecentlyAdvanced={Boolean(
                            keyA &&
                              recentlyAdvancedKey &&
                              keyA === recentlyAdvancedKey &&
                              !match.winner
                          )}
                          preview={keyA ? previews[keyA] : undefined}
                        />
                        <div className="h-px bg-cg-border" />
                        <BracketSlot
                          film={match.b}
                          isWinner={Boolean(winKey && keyB === winKey)}
                          isEliminated={Boolean(winKey && keyB && keyB !== winKey)}
                          isRecentlyAdvanced={Boolean(
                            keyB &&
                              recentlyAdvancedKey &&
                              keyB === recentlyAdvancedKey &&
                              !match.winner
                          )}
                          preview={keyB ? previews[keyB] : undefined}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
