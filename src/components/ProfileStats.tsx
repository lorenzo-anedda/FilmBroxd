import React, { useMemo, useState } from "react";
import { displayTitle } from "../utils/filmHelpers";
import { computeProfileStats, type PersonStat } from "../utils/profileStats";
import type { DiaryEntry, FilmMeta, SeenFilmItem } from "../types";

interface ProfileStatsProps {
  allSeen: SeenFilmItem[];
  meta: Record<string, FilmMeta>;
  diary?: DiaryEntry[];
  aiAvailable: boolean;
  busyPeople: boolean;
  peopleProgress: string;
  onEnrichPeople: () => void;
  onStopEnrichPeople: () => void;
  onRetryCheckedPeople: () => void;
  onReenrichFilms: (films: SeenFilmItem[]) => void;
  onResetAndReenrichPeople: () => void;
}

const PeopleCard: React.FC<{
  title: string;
  subtitle: string;
  itemsByLove: PersonStat[];
  itemsByCount: PersonStat[];
  defaultSort: "love" | "count";
  scaleMax: 5 | 10;
  emptyText: string;
  aiAvailable: boolean;
  busyPeople: boolean;
  onReenrichFilms: (films: SeenFilmItem[]) => void;
}> = ({
  title,
  subtitle,
  itemsByLove,
  itemsByCount,
  defaultSort,
  scaleMax,
  emptyText,
  aiAvailable,
  busyPeople,
  onReenrichFilms,
}) => {
  const [sortMode, setSortMode] = useState<"love" | "count">(defaultSort);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const items = sortMode === "love" ? itemsByLove : itemsByCount;

  return (
    <div className="rounded-2xl border border-cg-border bg-cg-surface p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-cg-border pb-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-cg-text">
            {title}
          </h3>
          <p className="text-xs text-cg-muted">{subtitle}</p>
        </div>
        <div
          className="inline-flex rounded-lg border border-cg-border bg-cg-bg p-0.5 text-[11px] font-medium"
          role="group"
          aria-label={`Ordinamento ${title}`}
        >
          <button
            type="button"
            aria-pressed={sortMode === "love"}
            onClick={() => setSortMode("love")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              sortMode === "love"
                ? "bg-cg-surface text-cg-accent-text shadow-xs"
                : "text-cg-muted hover:text-cg-text"
            }`}
          >
            Più amati
          </button>
          <button
            type="button"
            aria-pressed={sortMode === "count"}
            onClick={() => setSortMode("count")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              sortMode === "count"
                ? "bg-cg-surface text-cg-accent-text shadow-xs"
                : "text-cg-muted hover:text-cg-text"
            }`}
          >
            Più visti
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-cg-muted">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((person, idx) => {
            const isExpanded = expandedPerson === person.name;
            return (
              <li key={person.name} className="space-y-1.5">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedPerson(isExpanded ? null : person.name)
                  }
                  className="block w-full text-left"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] tabular-nums text-cg-muted">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate text-sm font-semibold text-cg-text hover:text-cg-accent-text">
                          {person.name}
                        </span>
                      </div>
                      {person.topFilms.length > 0 && (
                        <p className="truncate pl-6 text-[11px] text-cg-muted">
                          {person.topFilms.join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                      <span className="font-semibold text-cg-text">
                        {person.count}
                      </span>{" "}
                      <span className="text-cg-muted">film</span>
                      {person.avgRating != null && (
                        <span className="ml-2 text-cg-rating">
                          {person.avgRating.toFixed(1)}
                          {scaleMax === 5 ? "★" : "/10"}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-cg-elevated text-cg-accent"
                    viewBox="0 0 100 6"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="0"
                      y="0"
                      width={person.pctOfMaxCount}
                      height="6"
                      fill="currentColor"
                    />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="ml-6 rounded-xl border border-cg-border bg-cg-bg p-3 text-xs">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-cg-secondary">
                        Film attribuiti ({person.filmItems.length})
                      </span>
                      {aiAvailable && (
                        <button
                          type="button"
                          disabled={busyPeople}
                          onClick={() => onReenrichFilms(person.filmItems)}
                          className="rounded-md border border-cg-border bg-cg-surface px-2.5 py-1 text-[11px] font-medium text-cg-accent-text transition-colors hover:bg-cg-elevated disabled:opacity-50"
                        >
                          Rianalizza questi {person.filmItems.length} film
                        </button>
                      )}
                    </div>
                    <p className="leading-relaxed text-cg-muted">
                      {person.filmItems
                        .map((f) => `${displayTitle(f)}${f.y ? ` (${f.y})` : ""}`)
                        .join(" · ")}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const ProfileStats: React.FC<ProfileStatsProps> = ({
  allSeen,
  meta,
  diary,
  aiAvailable,
  busyPeople,
  peopleProgress,
  onEnrichPeople,
  onStopEnrichPeople,
  onRetryCheckedPeople,
  onReenrichFilms,
  onResetAndReenrichPeople,
}) => {
  const stats = useMemo(
    () => computeProfileStats(allSeen, meta, diary),
    [allSeen, meta, diary]
  );

  if (stats.totalSeen === 0) {
    return null;
  }

  const missingCount = stats.missingPeopleFilms.length;

  return (
    <section className="space-y-6">
      {/* Header & KPI strip */}
      <div className="rounded-2xl border border-cg-border bg-cg-surface p-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-cg-border pb-3">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-cg-text">
              Statistiche dei film visti
            </h2>
            <p className="mt-1 text-sm text-cg-muted">
              Panoramica calcolata in tempo reale dai tuoi {stats.totalSeen} film già visti.
            </p>
          </div>
          {stats.mostWatchedDecade && (
            <span className="font-mono text-xs tabular-nums text-cg-muted">
              Decennio più visto: {stats.mostWatchedDecade.label} ({stats.mostWatchedDecade.count})
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-cg-border bg-cg-bg px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-cg-muted">
              Film visti
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-cg-text">
              {stats.totalSeen}
            </div>
          </div>

          <div className="rounded-xl border border-cg-border bg-cg-bg px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-cg-muted">
              Film votati
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-cg-text">
              {stats.ratedCount}
            </div>
          </div>

          <div className="rounded-xl border border-cg-border bg-cg-bg px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-cg-muted">
              Media voti
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-cg-rating">
              {stats.avgRating != null
                ? `${stats.avgRating.toFixed(2)}${stats.scaleMax === 5 ? "★" : "/10"}`
                : "—"}
            </div>
          </div>

          <div className="rounded-xl border border-cg-border bg-cg-bg px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-cg-muted">
              Rivisti
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-cg-text">
              {stats.rewatchesCount}
            </div>
          </div>
        </div>
      </div>

      {/* Rating distribution & Preferred decades */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Distribuzione dei voti */}
        <div className="rounded-2xl border border-cg-border bg-cg-surface p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-cg-border pb-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-cg-text">
                Distribuzione dei voti
              </h3>
              <p className="text-xs text-cg-muted">
                {stats.ratedCount} valutazioni su scala {stats.scaleMax === 5 ? "0.5–5★" : "1–10"}
              </p>
            </div>
            {stats.peakRatingBucket && (
              <span className="font-mono text-xs font-medium tabular-nums text-cg-accent-text">
                Picco: {stats.peakRatingBucket.label}
                {stats.scaleMax === 5 ? "★" : ""} ({stats.peakRatingBucket.count})
              </span>
            )}
          </div>

          {stats.ratedCount === 0 ? (
            <p className="py-10 text-center text-sm text-cg-muted">
              Nessun film ancora votato.
            </p>
          ) : (
            <div className="pt-2">
              <div className="grid grid-cols-10 items-end gap-1.5 sm:gap-2">
                {stats.ratingBuckets.map((b) => {
                  const isPeak =
                    stats.peakRatingBucket &&
                    stats.peakRatingBucket.value === b.value &&
                    b.count > 0;
                  return (
                    <div
                      key={b.value}
                      className="flex flex-col items-center gap-1.5"
                      title={`${b.label}${stats.scaleMax === 5 ? "★" : ""}: ${b.count} film`}
                    >
                      <span className="font-mono text-[10px] tabular-nums text-cg-muted">
                        {b.count > 0 ? b.count : ""}
                      </span>
                      <div className="flex h-32 w-full items-end rounded-sm bg-cg-bg p-0.5">
                        {b.count > 0 && (
                          <svg
                            className={`h-full w-full ${
                              isPeak ? "text-cg-accent" : "text-cg-chart-muted"
                            }`}
                            viewBox="0 0 24 100"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                          >
                            <rect
                              x="0"
                              y={100 - b.pct}
                              width="24"
                              height={b.pct}
                              rx="2"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          isPeak
                            ? "font-semibold text-cg-accent-text"
                            : "text-cg-muted"
                        }`}
                      >
                        {b.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Decenni preferiti */}
        <div className="rounded-2xl border border-cg-border bg-cg-surface p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-cg-border pb-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-cg-text">
                Decenni preferiti
              </h3>
              <p className="text-xs text-cg-muted">
                Volume di visione e media voto per epoca
              </p>
            </div>
            {stats.highestRatedDecade && stats.highestRatedDecade.avgRating != null && (
              <span className="font-mono text-xs font-medium tabular-nums text-cg-accent-text">
                Media top: {stats.highestRatedDecade.label} ·{" "}
                {stats.highestRatedDecade.avgRating.toFixed(2)}
                {stats.scaleMax === 5 ? "★" : "/10"}
              </span>
            )}
          </div>

          {stats.decades.length === 0 ? (
            <p className="py-10 text-center text-sm text-cg-muted">
              Nessun anno di uscita disponibile.
            </p>
          ) : (
            <div className="space-y-2.5">
              {stats.decades.map((d) => {
                const isBestRated = stats.highestRatedDecade?.key === d.key;
                const isMostWatched = stats.mostWatchedDecade?.key === d.key;
                return (
                  <div key={d.key} className="grid grid-cols-[58px_1fr_92px] items-center gap-3">
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        isBestRated || isMostWatched
                          ? "font-semibold text-cg-text"
                          : "text-cg-muted"
                      }`}
                    >
                      {d.label}
                    </span>
                    <svg
                      className={`h-2.5 w-full overflow-hidden rounded-sm bg-cg-bg ${
                        isBestRated
                          ? "text-cg-accent"
                          : isMostWatched
                          ? "text-cg-secondary"
                          : "text-cg-chart-muted"
                      }`}
                      viewBox="0 0 100 10"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <rect
                        x="0"
                        y="0"
                        width={d.pctOfMax}
                        height="10"
                        fill="currentColor"
                      />
                    </svg>
                    <div className="text-right font-mono text-xs tabular-nums">
                      <span className="font-semibold text-cg-text">
                        {d.count}
                      </span>
                      {d.avgRating != null && (
                        <span
                          className={`ml-2 ${
                            isBestRated
                              ? "font-semibold text-cg-accent-text"
                              : "text-cg-muted"
                          }`}
                        >
                          {d.avgRating.toFixed(1)}
                          {stats.scaleMax === 5 ? "★" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* People enrichment bar (when seen films still lack director or actors) */}
      {(missingCount > 0 ||
        stats.checkedNoCastCount > 0 ||
        stats.seenWithDirector > 0 ||
        stats.seenWithActors > 0 ||
        busyPeople ||
        peopleProgress) && (
        <div className="rounded-2xl border border-cg-border bg-cg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-cg-text">
                <span>
                  Registi noti: {stats.seenWithDirector}/{stats.totalSeen} · Attori reali noti: {stats.seenWithActors}/{stats.totalSeen}
                  {stats.checkedNoCastCount > 0 &&
                    ` · ${stats.checkedNoCastCount} verificati senza cast`}
                </span>
              </div>
              <p className="text-xs text-cg-muted">
                {peopleProgress ||
                  "Esclude automaticamente i doppiatori dei film d'animazione (mantenendo gli attori tradizionali come Tom Hanks nei loro film dal vivo). Clicca un nome qui sotto per ispezionare o correggere i film collegati."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {busyPeople ? (
                <button
                  type="button"
                  onClick={onStopEnrichPeople}
                  className="rounded-lg border border-cg-border-strong bg-cg-bg px-3.5 py-2 text-xs font-semibold text-cg-text transition-colors hover:bg-cg-elevated whitespace-nowrap shrink-0"
                >
                  Ferma analisi
                </button>
              ) : (
                <>
                  {missingCount > 0 && (
                    <button
                      type="button"
                      disabled={!aiAvailable}
                      onClick={onEnrichPeople}
                      className="rounded-lg bg-cg-accent px-3.5 py-2 text-xs font-semibold text-cg-accent-fg transition-colors hover:bg-cg-accent-hover disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {stats.seenWithDirector === 0 && stats.seenWithActors === 0
                        ? `Analizza registi e attori (${missingCount})`
                        : `Completa mancanti (${missingCount})`}
                    </button>
                  )}
                  {missingCount === 0 && stats.checkedNoCastCount > 0 && (
                    <button
                      type="button"
                      disabled={!aiAvailable}
                      onClick={onRetryCheckedPeople}
                      className="rounded-lg border border-cg-border bg-cg-bg px-3.5 py-2 text-xs font-medium text-cg-secondary transition-colors hover:bg-cg-elevated disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      Riprova i {stats.checkedNoCastCount} senza cast
                    </button>
                  )}
                  {(stats.seenWithDirector > 0 || stats.seenWithActors > 0) && (
                    <button
                      type="button"
                      disabled={!aiAvailable}
                      onClick={onResetAndReenrichPeople}
                      className="rounded-lg border border-cg-border bg-cg-bg px-3.5 py-2 text-xs font-medium text-cg-secondary transition-colors hover:bg-cg-elevated disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      Rianalizza tutto (solo attori reali)
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Directors & Actors */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PeopleCard
          title="Registi più amati"
          subtitle={`Calcolati su ${stats.seenWithDirector} film con regista noto`}
          itemsByLove={stats.directorsByLove}
          itemsByCount={stats.directorsByCount}
          defaultSort="love"
          scaleMax={stats.scaleMax}
          emptyText="Premi «Analizza registi e attori» qui sopra per calcolare i tuoi registi preferiti dai film già visti."
          aiAvailable={aiAvailable}
          busyPeople={busyPeople}
          onReenrichFilms={onReenrichFilms}
        />

        <PeopleCard
          title="Attori più visti"
          subtitle={`Solo attori reali · esclusi i doppiaggi animati (${stats.seenWithActors} film)`}
          itemsByLove={stats.actorsByLove}
          itemsByCount={stats.actorsByCount}
          defaultSort="count"
          scaleMax={stats.scaleMax}
          emptyText="Premi «Analizza registi e attori» qui sopra per scoprire gli attori che compaiono di più nei tuoi film visti."
          aiAvailable={aiAvailable}
          busyPeople={busyPeople}
          onReenrichFilms={onReenrichFilms}
        />
      </div>

      {/* Diary Analytics: Monthly pace + Top Rewatches */}
      {stats.diaryStats && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Pace Comparison */}
          <div className="rounded-2xl border border-cg-border bg-cg-surface p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-cg-border pb-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-cg-text">
                  Ritmo mensile (Diario)
                </h3>
                <p className="text-xs text-cg-muted">
                  {stats.diaryStats.currentYear}:{" "}
                  <span className="font-mono font-semibold text-cg-text">
                    {stats.diaryStats.currentYearCount}
                  </span>{" "}
                  film · {stats.diaryStats.previousYear}:{" "}
                  <span className="font-mono">
                    {stats.diaryStats.previousYearCount}
                  </span>{" "}
                  film
                </p>
              </div>
              {stats.diaryStats.peakMonth && (
                <span className="font-mono text-xs font-medium tabular-nums text-cg-accent-text">
                  Picco: {stats.diaryStats.peakMonth.label} ({stats.diaryStats.peakMonth.count})
                </span>
              )}
            </div>

            <div className="pt-2">
              <div className="grid grid-cols-12 items-end gap-1.5">
                {stats.diaryStats.monthlyComparison.map((m) => (
                  <div
                    key={m.monthIndex}
                    className="flex flex-col items-center gap-1.5"
                    title={`${m.label}: ${m.currentCount} (${stats.diaryStats!.currentYear}) vs ${m.previousCount} (${stats.diaryStats!.previousYear})`}
                  >
                    <span className="font-mono text-[10px] tabular-nums text-cg-muted">
                      {m.currentCount > 0 ? m.currentCount : ""}
                    </span>
                    <div className="flex h-28 w-full items-end justify-center gap-0.5 rounded-sm bg-cg-bg p-0.5">
                      {m.previousCount > 0 && (
                        <svg
                          className="h-full w-1/2 text-cg-chart-muted"
                          viewBox="0 0 12 100"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <rect
                            x="0"
                            y={100 - m.previousPct}
                            width="12"
                            height={m.previousPct}
                            rx="2"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                      {m.currentCount > 0 && (
                        <svg
                          className="h-full w-1/2 text-cg-accent"
                          viewBox="0 0 12 100"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <rect
                            x="0"
                            y={100 - m.currentPct}
                            width="12"
                            height={m.currentPct}
                            rx="2"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-cg-muted">
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-end gap-4 text-[11px] text-cg-muted">
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-2.5 w-2.5 text-cg-accent" viewBox="0 0 10 10" aria-hidden="true">
                    <rect width="10" height="10" rx="2" fill="currentColor" />
                  </svg>
                  {stats.diaryStats.currentYear}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-2.5 w-2.5 text-cg-chart-muted" viewBox="0 0 10 10" aria-hidden="true">
                    <rect width="10" height="10" rx="2" fill="currentColor" />
                  </svg>
                  {stats.diaryStats.previousYear}
                </span>
              </div>
            </div>
          </div>

          {/* Most Rewatched Films */}
          <div className="rounded-2xl border border-cg-border bg-cg-surface p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-cg-border pb-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-cg-text">
                  Film più rivisti
                </h3>
                <p className="text-xs text-cg-muted">
                  Titoli con rewatch o visioni multiple nel Diario
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-cg-muted">
                {stats.diaryStats.topRewatches.length}
              </span>
            </div>

            {stats.diaryStats.topRewatches.length === 0 ? (
              <p className="py-8 text-center text-sm text-cg-muted">
                Nessun rewatch registrato ancora nel Diario.
              </p>
            ) : (
              <ul className="divide-y divide-cg-border">
                {stats.diaryStats.topRewatches.map((item, idx) => (
                  <li
                    key={item.k}
                    className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] tabular-nums text-cg-muted">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate text-sm font-semibold text-cg-text">
                          {item.t}
                        </span>
                        {item.y && (
                          <span className="shrink-0 font-mono text-xs tabular-nums text-cg-muted">
                            {item.y}
                          </span>
                        )}
                      </div>
                      <p className="pl-6 text-[11px] text-cg-muted">
                        Ultima visione: {item.lastWatchedDate}
                      </p>
                    </div>
                    <div className="shrink-0 font-mono text-xs tabular-nums">
                      <span className="font-semibold text-cg-text">
                        {item.count}×
                      </span>
                      {item.rating != null && (
                        <span className="ml-2 text-cg-rating">
                          {item.rating}
                          {stats.scaleMax === 5 ? "★" : "/10"}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
