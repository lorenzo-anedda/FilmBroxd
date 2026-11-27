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
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#131722]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div
          className="inline-flex rounded-lg border border-slate-200 bg-[#F5F7FA] p-0.5 text-[11px] font-medium dark:border-slate-700 dark:bg-[#0B0E14]"
          role="group"
          aria-label={`Ordinamento ${title}`}
        >
          <button
            type="button"
            onClick={() => setSortMode("love")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              sortMode === "love"
                ? "bg-white text-[#2563EB] shadow-xs dark:bg-[#1A202E] dark:text-[#60A5FA]"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Più amati
          </button>
          <button
            type="button"
            onClick={() => setSortMode("count")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              sortMode === "count"
                ? "bg-white text-[#2563EB] shadow-xs dark:bg-[#1A202E] dark:text-[#60A5FA]"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Più visti
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
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
                  onClick={() =>
                    setExpandedPerson(isExpanded ? null : person.name)
                  }
                  className="block w-full text-left"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate text-sm font-semibold text-slate-900 hover:text-[#2563EB] dark:text-slate-100 dark:hover:text-[#60A5FA]">
                          {person.name}
                        </span>
                      </div>
                      {person.topFilms.length > 0 && (
                        <p className="truncate pl-6 text-[11px] text-slate-500 dark:text-slate-400">
                          {person.topFilms.join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {person.count}
                      </span>{" "}
                      <span className="text-slate-500 dark:text-slate-400">film</span>
                      {person.avgRating != null && (
                        <span className="ml-2 text-[#2563EB] dark:text-[#60A5FA]">
                          {person.avgRating.toFixed(1)}
                          {scaleMax === 5 ? "★" : "/10"}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-slate-100 text-[#2563EB] dark:bg-slate-800/80 dark:text-[#3B82F6]"
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
                  <div className="ml-6 rounded-xl border border-slate-200/80 bg-[#F5F7FA] p-3 text-xs dark:border-slate-800 dark:bg-[#0B0E14]">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Film attribuiti ({person.filmItems.length})
                      </span>
                      {aiAvailable && (
                        <button
                          type="button"
                          disabled={busyPeople}
                          onClick={() => onReenrichFilms(person.filmItems)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-[#2563EB] transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-[#131722] dark:text-[#60A5FA]"
                        >
                          Rianalizza questi {person.filmItems.length} film
                        </button>
                      )}
                    </div>
                    <p className="leading-relaxed text-slate-600 dark:text-slate-400">
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
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#131722]">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Statistiche dei film visti
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Panoramica calcolata in tempo reale dai tuoi {stats.totalSeen} film già visti.
            </p>
          </div>
          {stats.mostWatchedDecade && (
            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              Decennio più visto: {stats.mostWatchedDecade.label} ({stats.mostWatchedDecade.count})
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-[#F5F7FA] px-4 py-3 dark:border-slate-800 dark:bg-[#0B0E14]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Film visti
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {stats.totalSeen}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-[#F5F7FA] px-4 py-3 dark:border-slate-800 dark:bg-[#0B0E14]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Film votati
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {stats.ratedCount}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-[#F5F7FA] px-4 py-3 dark:border-slate-800 dark:bg-[#0B0E14]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Media voti
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
              {stats.avgRating != null
                ? `${stats.avgRating.toFixed(2)}${stats.scaleMax === 5 ? "★" : "/10"}`
                : "—"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-[#F5F7FA] px-4 py-3 dark:border-slate-800 dark:bg-[#0B0E14]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Rivisti
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {stats.rewatchesCount}
            </div>
          </div>
        </div>
      </div>

      {/* Rating distribution & Preferred decades */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Distribuzione dei voti */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#131722]">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                Distribuzione dei voti
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stats.ratedCount} valutazioni su scala {stats.scaleMax === 5 ? "0.5–5★" : "1–10"}
              </p>
            </div>
            {stats.peakRatingBucket && (
              <span className="font-mono text-xs font-medium tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
                Picco: {stats.peakRatingBucket.label}
                {stats.scaleMax === 5 ? "★" : ""} ({stats.peakRatingBucket.count})
              </span>
            )}
          </div>

          {stats.ratedCount === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
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
                      <span className="font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                        {b.count > 0 ? b.count : ""}
                      </span>
                      <div className="flex h-32 w-full items-end rounded-sm bg-slate-100/80 p-0.5 dark:bg-[#0B0E14]">
                        {b.count > 0 && (
                          <svg
                            className={`h-full w-full ${
                              isPeak
                                ? "text-[#2563EB] dark:text-[#3B82F6]"
                                : "text-slate-400 dark:text-slate-600"
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
                            ? "font-semibold text-[#2563EB] dark:text-[#60A5FA]"
                            : "text-slate-600 dark:text-slate-400"
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
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#131722]">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                Decenni preferiti
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Volume di visione e media voto per epoca
              </p>
            </div>
            {stats.highestRatedDecade && stats.highestRatedDecade.avgRating != null && (
              <span className="font-mono text-xs font-medium tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
                Media top: {stats.highestRatedDecade.label} ·{" "}
                {stats.highestRatedDecade.avgRating.toFixed(2)}
                {stats.scaleMax === 5 ? "★" : "/10"}
              </span>
            )}
          </div>

          {stats.decades.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
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
                          ? "font-semibold text-slate-900 dark:text-slate-100"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {d.label}
                    </span>
                    <svg
                      className={`h-2.5 w-full overflow-hidden rounded-sm bg-slate-100 dark:bg-[#0B0E14] ${
                        isBestRated
                          ? "text-[#2563EB] dark:text-[#3B82F6]"
                          : isMostWatched
                          ? "text-slate-700 dark:text-slate-300"
                          : "text-slate-400 dark:text-slate-600"
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
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {d.count}
                      </span>
                      {d.avgRating != null && (
                        <span
                          className={`ml-2 ${
                            isBestRated
                              ? "font-semibold text-[#2563EB] dark:text-[#60A5FA]"
                              : "text-slate-500 dark:text-slate-400"
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
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-[#131722]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                <span>
                  Registi noti: {stats.seenWithDirector}/{stats.totalSeen} · Attori reali noti: {stats.seenWithActors}/{stats.totalSeen}
                  {stats.checkedNoCastCount > 0 &&
                    ` · ${stats.checkedNoCastCount} verificati senza cast`}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {peopleProgress ||
                  "Esclude automaticamente i doppiatori dei film d'animazione (mantenendo gli attori tradizionali come Tom Hanks nei loro film dal vivo). Clicca un nome qui sotto per ispezionare o correggere i film collegati."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {busyPeople ? (
                <button
                  type="button"
                  onClick={onStopEnrichPeople}
                  className="rounded-lg border border-slate-300 bg-[#F5F7FA] px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-200 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-200 dark:hover:bg-slate-800"
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
                      className="rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 whitespace-nowrap shrink-0 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
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
                      className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Riprova i {stats.checkedNoCastCount} senza cast
                    </button>
                  )}
                  {(stats.seenWithDirector > 0 || stats.seenWithActors > 0) && (
                    <button
                      type="button"
                      disabled={!aiAvailable}
                      onClick={onResetAndReenrichPeople}
                      className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
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
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#131722]">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
              <div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Ritmo mensile (Diario)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {stats.diaryStats.currentYear}:{" "}
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
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
                <span className="font-mono text-xs font-medium tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
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
                    <span className="font-mono text-[10px] tabular-nums text-slate-600 dark:text-slate-400">
                      {m.currentCount > 0 ? m.currentCount : ""}
                    </span>
                    <div className="flex h-28 w-full items-end justify-center gap-0.5 rounded-sm bg-slate-100/80 p-0.5 dark:bg-[#0B0E14]">
                      {m.previousCount > 0 && (
                        <svg
                          className="h-full w-1/2 text-slate-300 dark:text-slate-700"
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
                          className="h-full w-1/2 text-[#2563EB] dark:text-[#3B82F6]"
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
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-end gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-2.5 w-2.5 text-[#2563EB] dark:text-[#3B82F6]" viewBox="0 0 10 10" aria-hidden="true">
                    <rect width="10" height="10" rx="2" fill="currentColor" />
                  </svg>
                  {stats.diaryStats.currentYear}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-2.5 w-2.5 text-slate-300 dark:text-slate-700" viewBox="0 0 10 10" aria-hidden="true">
                    <rect width="10" height="10" rx="2" fill="currentColor" />
                  </svg>
                  {stats.diaryStats.previousYear}
                </span>
              </div>
            </div>
          </div>

          {/* Most Rewatched Films */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-[#131722]">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
              <div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Film più rivisti
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Titoli con rewatch o visioni multiple nel Diario
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {stats.diaryStats.topRewatches.length}
              </span>
            </div>

            {stats.diaryStats.topRewatches.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Nessun rewatch registrato ancora nel Diario.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200/70 dark:divide-slate-800">
                {stats.diaryStats.topRewatches.map((item, idx) => (
                  <li
                    key={item.k}
                    className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.t}
                        </span>
                        {item.y && (
                          <span className="shrink-0 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                            {item.y}
                          </span>
                        )}
                      </div>
                      <p className="pl-6 text-[11px] text-slate-500 dark:text-slate-400">
                        Ultima visione: {item.lastWatchedDate}
                      </p>
                    </div>
                    <div className="shrink-0 font-mono text-xs tabular-nums">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.count}×
                      </span>
                      {item.rating != null && (
                        <span className="ml-2 text-[#2563EB] dark:text-[#60A5FA]">
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
