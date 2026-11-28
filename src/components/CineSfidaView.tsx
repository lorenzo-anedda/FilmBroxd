import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Clapperboard,
  RotateCcw,
  Search,
  Shuffle,
  SlidersHorizontal,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { DECADE_FILTERS, GENRE_FILTERS } from "../constants/filters";
import { fetchFilmPreview } from "../utils/aiClient";
import { playAdvanceSound, playVictoryFanfare } from "../utils/cinemaSound";
import { displayTitle, filmKey, nz } from "../utils/filmHelpers";
import {
  cloneBracketWithWinner,
  countCompletedMatches,
  createBracket,
  filterTournamentPool,
  findNextPlayableMatch,
  getChampionPath,
  getRoundNames,
  hasTournamentFilters,
  pickContenders,
  type BracketMatch,
  type BracketSize,
  type TournamentFilterOptions,
  type TournamentSource,
} from "../utils/tournament";
import { CineSfidaBracket } from "./CineSfidaBracket";
import { CineSfidaVictory } from "./CineSfidaVictory";
import { PosterImage } from "./PosterImage";
import type {
  FilmItem,
  FilmMeta,
  FilmPreviewData,
  LibraryState,
  SeenFilmItem,
} from "../types";

interface CineSfidaViewProps {
  watchlistPool: FilmItem[];
  filteredPool: FilmItem[];
  hasActiveFilters: boolean;
  allSeen: SeenFilmItem[];
  lib: LibraryState;
  onWatchTonightFilm: (film: FilmItem, director: string) => void;
}

type GamePhase = "MENU" | "PLAYING" | "VICTORY";

const FORMAT_OPTIONS: Array<{
  size: BracketSize;
  shortLabel: string;
  title: string;
  subtitle: string;
  steps: string;
}> = [
  {
    size: 16,
    shortLabel: "Ottavi (16)",
    title: "Ottavi di finale · 16 film",
    subtitle: "Tabellone completo in 15 sfide (Ottavi → Quarti → Semifinali → Finale).",
    steps: "Ottavi (8) · Quarti (4) · Semifinali (2) · Finale (1)",
  },
  {
    size: 8,
    shortLabel: "Quarti (8)",
    title: "Quarti di finale · 8 film",
    subtitle: "Torneo rapido in 7 sfide (Quarti → Semifinali → Finale).",
    steps: "Quarti (4) · Semifinali (2) · Finale (1)",
  },
];

const SOURCE_OPTIONS: Array<{
  id: TournamentSource;
  title: string;
  desc: (count: BracketSize) => string;
}> = [
  {
    id: "watchlist_taste",
    title: "Watchlist · Su misura per te",
    desc: (n) =>
      `Seleziona ${n} titoli dal pool filtrato più affini ai tuoi gusti.`,
  },
  {
    id: "watchlist_random",
    title: "Watchlist · Sorteggio libero",
    desc: (n) =>
      `Estrae ${n} film casuali dal pool filtrato ancora da vedere.`,
  },
  {
    id: "seen_cult",
    title: "Film già visti · Torneo cult",
    desc: (n) =>
      `Sfida tra ${n} film già visti e amati presenti nel pool filtrato.`,
  },
];

const DURATION_PRESETS = [
  { label: "Tutte", value: 0 },
  { label: "≤ 100 min", value: 100 },
  { label: "≤ 120 min", value: 120 },
  { label: "≤ 150 min", value: 150 },
] as const;

const ContenderCard: React.FC<{
  film: FilmItem;
  sideLabel: string;
  shortcutHint: string;
  meta?: FilmMeta;
  preview?: FilmPreviewData;
  state: "idle" | "winner" | "loser";
  disabled: boolean;
  onSelect: () => void;
}> = ({
  film,
  sideLabel,
  shortcutHint,
  meta,
  preview,
  state,
  disabled,
  onSelect,
}) => {
  const title = displayTitle(film);
  const origDiffers =
    title.toLowerCase() !== film.t.toLowerCase() ? film.t : "";

  const metaParts: string[] = [];
  if (film.y) metaParts.push(film.y);
  if (meta && nz(meta.d)) metaParts.push(meta.d);
  if (meta && meta.m > 0) metaParts.push(`${meta.m} min`);
  if (meta && nz(meta.g)) metaParts.push(meta.g);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`group relative flex h-full w-full flex-col justify-between rounded-2xl border bg-cg-surface p-5 text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cg-focus ${
        state === "winner"
          ? "duel-winner border-cg-accent ring-2 ring-cg-accent/25"
          : state === "loser"
          ? "duel-loser border-cg-border"
          : "border-cg-border hover:-translate-y-0.5 hover:border-cg-accent/70 hover:shadow-md"
      }`}
    >
      <div>
        <div className="mb-3 flex items-center justify-between gap-2 text-xs">
          <span className="font-mono uppercase tracking-wider text-cg-muted">
            {sideLabel}
          </span>
          <span
            className={`font-mono text-[11px] font-semibold transition-colors ${
              state === "winner"
                ? "text-cg-accent-text"
                : "text-cg-muted group-hover:text-cg-accent-text"
            }`}
          >
            {state === "winner" ? "PASSA IL TURNO" : `Tasto ${shortcutHint}`}
          </span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-40">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-cg-border bg-cg-elevated">
              <PosterImage
                cacheKey={filmKey(film)}
                title={title}
                year={film.y}
                posterUrl={preview?.posterUrl}
                loading={preview?.loading}
                className="h-full w-full"
                imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <h3 className="font-display text-xl font-bold leading-snug tracking-tight text-cg-text [text-wrap:balance]">
                {title}
              </h3>
              {origDiffers && (
                <p className="mt-0.5 text-xs text-cg-muted">
                  {origDiffers}
                </p>
              )}
            </div>

            {metaParts.length > 0 && (
              <p className="text-xs leading-relaxed text-cg-muted">
                {metaParts.join(" · ")}
              </p>
            )}

            <p className="line-clamp-5 text-xs leading-relaxed text-cg-secondary">
              {preview?.loading && !preview.description
                ? "Recupero trama e locandina…"
                : preview?.description ||
                  "Sinossi non disponibile per questo titolo."}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-cg-border pt-3.5 text-xs font-semibold">
        <span
          className={
            state === "winner"
              ? "text-cg-accent-text"
              : "text-cg-secondary group-hover:text-cg-accent-text"
          }
        >
          {state === "winner" ? "Avanza al turno successivo" : "Scegli questo film"}
        </span>
        <ArrowRight
          className={`h-4 w-4 transition-transform duration-200 ${
            state === "winner"
              ? "translate-x-1 text-cg-accent-text"
              : "text-cg-muted group-hover:translate-x-1 group-hover:text-cg-accent-text"
          }`}
        />
      </div>
    </button>
  );
};

export const CineSfidaView: React.FC<CineSfidaViewProps> = ({
  watchlistPool,
  filteredPool,
  hasActiveFilters,
  allSeen,
  lib,
  onWatchTonightFilm,
}) => {
  const [phase, setPhase] = useState<GamePhase>("MENU");
  const [bracketSize, setBracketSize] = useState<BracketSize>(16);
  const [source, setSource] = useState<TournamentSource>("watchlist_taste");
  const [useEveningFilters, setUseEveningFilters] = useState<boolean>(false);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [genreFilter, setGenreFilter] = useState<Set<string>>(() => new Set());
  const [decadeFilter, setDecadeFilter] = useState<Set<string>>(
    () => new Set()
  );
  const [maxMinutes, setMaxMinutes] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [excludeBlocked, setExcludeBlocked] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [rounds, setRounds] = useState<BracketMatch[][]>([]);
  const [previews, setPreviews] = useState<Record<string, FilmPreviewData>>({});
  const [advancingKey, setAdvancingKey] = useState<string | null>(null);
  const [recentlyAdvancedKey, setRecentlyAdvancedKey] = useState<string | null>(
    null
  );
  const [champion, setChampion] = useState<FilmItem | null>(null);
  const [watchedConfirmed, setWatchedConfirmed] = useState<boolean>(false);

  const advanceTimerRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  const tournamentFilters: TournamentFilterOptions = useMemo(
    () => ({
      genres: genreFilter,
      decades: decadeFilter,
      maxMinutes,
      searchQuery,
      excludeBlocked,
    }),
    [genreFilter, decadeFilter, maxMinutes, searchQuery, excludeBlocked]
  );

  const baseWatchlistForSource = useMemo(() => {
    if (useEveningFilters && hasActiveFilters) {
      return filteredPool;
    }
    return watchlistPool;
  }, [useEveningFilters, hasActiveFilters, filteredPool, watchlistPool]);

  const poolsBySource = useMemo(
    () => ({
      watchlist_taste: filterTournamentPool(
        "watchlist_taste",
        baseWatchlistForSource,
        allSeen,
        lib,
        tournamentFilters
      ),
      watchlist_random: filterTournamentPool(
        "watchlist_random",
        baseWatchlistForSource,
        allSeen,
        lib,
        tournamentFilters
      ),
      seen_cult: filterTournamentPool(
        "seen_cult",
        baseWatchlistForSource,
        allSeen,
        lib,
        tournamentFilters
      ),
    }),
    [baseWatchlistForSource, allSeen, lib, tournamentFilters]
  );

  const eligiblePool = poolsBySource[source];
  const filtersActive =
    hasTournamentFilters(tournamentFilters) ||
    (useEveningFilters && hasActiveFilters && source !== "seen_cult");

  // Auto-adapt bracketSize when pool has 8..15 eligible titles so Ottavi isn't stuck selected
  useEffect(() => {
    if (phase !== "MENU") return;
    if (bracketSize === 16 && eligiblePool.length < 16 && eligiblePool.length >= 8) {
      setBracketSize(8);
    }
  }, [phase, bracketSize, eligiblePool.length]);

  const activePos = useMemo(
    () => (phase === "PLAYING" ? findNextPlayableMatch(rounds) : null),
    [phase, rounds]
  );

  const currentMatch =
    activePos && rounds[activePos.roundIdx]
      ? rounds[activePos.roundIdx][activePos.matchIdx]
      : null;

  const completedCount = useMemo(() => countCompletedMatches(rounds), [rounds]);
  const totalMatches = rounds.length === 3 ? 7 : 15;
  const roundNames = useMemo(
    () => getRoundNames(rounds.length),
    [rounds.length]
  );

  const toggleFilterCode = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    code: string
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const resetPoolFilters = () => {
    setGenreFilter(new Set());
    setDecadeFilter(new Set());
    setMaxMinutes(0);
    setSearchQuery("");
    setUseEveningFilters(false);
    setExcludeBlocked(true);
  };

  // Preload posters & descriptions using a 6-worker fast queue
  const preloadContenders = async (films: FilmItem[]) => {
    setPreviews((prev) => {
      const next = { ...prev };
      for (const f of films) {
        const k = filmKey(f);
        if (!next[k]) {
          next[k] = { posterUrl: null, description: "", loading: true };
        }
      }
      return next;
    });

    let cursor = 0;

    const runFastWorker = async () => {
      while (cursor < films.length && mountedRef.current) {
        const f = films[cursor++];
        const k = filmKey(f);
        const meta = lib.meta[k];
        const data = await fetchFilmPreview(f, meta?.d, { fast: true });
        if (!mountedRef.current) return;
        setPreviews((cur) => ({ ...cur, [k]: { ...data, loading: false } }));
      }
    };

    const workerCount = Math.min(6, films.length);
    await Promise.all(Array.from({ length: workerCount }, () => runFastWorker()));
  };

  const handleStartTournament = (
    chosenSource: TournamentSource = source,
    chosenSize: BracketSize = bracketSize
  ) => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    const poolForSource = poolsBySource[chosenSource];
    const effectiveSize: BracketSize =
      chosenSize === 16 && poolForSource.length < 16 && poolForSource.length >= 8
        ? 8
        : chosenSize;

    const contenders = pickContenders(
      chosenSource,
      effectiveSize,
      poolForSource,
      allSeen,
      lib
    );
    if (contenders.length < effectiveSize) return;

    setBracketSize(effectiveSize);
    setRounds(createBracket(contenders, effectiveSize));
    setAdvancingKey(null);
    setRecentlyAdvancedKey(null);
    setChampion(null);
    setWatchedConfirmed(false);
    setPhase("PLAYING");
    void preloadContenders(contenders);
  };

  const handlePickWinner = (chosen: FilmItem) => {
    if (!activePos || !currentMatch || advancingKey) return;
    const chosenKey = filmKey(chosen);
    const isFinal = activePos.roundIdx === rounds.length - 1;

    setAdvancingKey(chosenKey);
    if (isFinal) {
      playVictoryFanfare(soundEnabled);
    } else {
      playAdvanceSound(soundEnabled);
    }

    advanceTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      const updated = cloneBracketWithWinner(
        rounds,
        activePos.roundIdx,
        activePos.matchIdx,
        chosen
      );
      setRounds(updated);
      setAdvancingKey(null);
      setRecentlyAdvancedKey(chosenKey);

      if (isFinal) {
        setChampion(chosen);
        setPhase("VICTORY");
      }
    }, 460);
  };

  // Keyboard shortcuts during duel (Left / 1, Right / 2)
  useEffect(() => {
    if (phase !== "PLAYING" || !currentMatch || !currentMatch.a || !currentMatch.b) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (advancingKey) return;

      if ((e.key === "ArrowLeft" || e.key === "1") && currentMatch.a) {
        e.preventDefault();
        handlePickWinner(currentMatch.a);
      } else if ((e.key === "ArrowRight" || e.key === "2") && currentMatch.b) {
        e.preventDefault();
        handlePickWinner(currentMatch.b);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleResetToMenu = () => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setAdvancingKey(null);
    setPhase("MENU");
  };

  const championPath = useMemo(
    () => (champion ? getChampionPath(rounds, champion) : []),
    [champion, rounds]
  );

  const selectedFormat =
    FORMAT_OPTIONS.find((f) => f.size === bracketSize) || FORMAT_OPTIONS[0];

  const activeFilterCount =
    genreFilter.size +
    decadeFilter.size +
    (maxMinutes > 0 ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (useEveningFilters && hasActiveFilters && source !== "seen_cult" ? 1 : 0);

  if (phase === "MENU") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-cg-border bg-cg-surface p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-cg-border pb-5">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cg-accent-text">
                <Trophy className="h-4 w-4" />
                <span>Torneo a eliminazione diretta</span>
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-cg-text [text-wrap:balance]">
                ReelRouette
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-cg-muted">
                Scegli la modalità tra Ottavi (16 film) o Quarti (8 film) e filtra il pool iniziale: sfida dopo sfida con locandina e trama, eleggi il vincitore della serata.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-cg-border bg-cg-bg px-3 py-2 text-xs font-medium text-cg-secondary transition-colors hover:bg-cg-elevated whitespace-nowrap shrink-0"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Audio attivo</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5" />
                  <span>Audio spento</span>
                </>
              )}
            </button>
          </div>

          {/* Mode selector: Ottavi di finale (16) vs Quarti di finale (8) */}
          <div className="mb-6">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-cg-muted">
                Modalità torneo
              </span>
              <span className="font-mono text-[11px] tabular-nums text-cg-muted">
                Pool idoneo: {eligiblePool.length} film
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {FORMAT_OPTIONS.map((fmt) => {
                const active = bracketSize === fmt.size;
                const unavailable = eligiblePool.length < fmt.size;
                return (
                  <button
                    key={fmt.size}
                    type="button"
                    disabled={unavailable}
                    aria-pressed={active}
                    onClick={() => setBracketSize(fmt.size)}
                    className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-45 ${
                      active
                        ? "border-cg-accent bg-cg-accent-soft"
                        : "border-cg-border bg-cg-bg hover:border-cg-border-strong"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-sm font-semibold text-cg-text">
                        {fmt.title}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-cg-accent-text">
                        {fmt.size - 1} sfide
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-cg-muted">
                      {unavailable
                        ? `Servono almeno ${fmt.size} film idonei nel pool filtrato (ora ${eligiblePool.length}).`
                        : fmt.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pool source selector */}
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-cg-muted">
            Da dove pescare i film
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {SOURCE_OPTIONS.map((opt) => {
              const selected = source === opt.id;
              const avail = poolsBySource[opt.id].length;
              const tooSmall = avail < 8;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={tooSmall}
                  aria-pressed={selected}
                  onClick={() => setSource(opt.id)}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-colors disabled:opacity-45 ${
                    selected
                      ? "border-cg-accent bg-cg-accent-soft"
                      : "border-cg-border bg-cg-bg hover:border-cg-border-strong"
                  }`}
                >
                  <div>
                    <div className="font-display text-sm font-semibold text-cg-text">
                      {opt.title}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-cg-muted">
                      {opt.desc(bracketSize)}
                    </p>
                  </div>
                  <div className="mt-4 font-mono text-[11px] tabular-nums text-cg-muted">
                    {avail} film idonei
                  </div>
                </button>
              );
            })}
          </div>

          {/* Initial pool filtering panel */}
          <div className="mt-5 rounded-xl border border-cg-border bg-cg-bg p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((v) => !v)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-cg-secondary transition-colors hover:text-cg-accent-text"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>
                  Filtra il pool iniziale
                  {activeFilterCount > 0 ? ` (${activeFilterCount} attivi)` : ""}
                </span>
              </button>

              <div className="flex flex-wrap items-center gap-3">
                {hasActiveFilters && source !== "seen_cult" && (
                  <button
                    type="button"
                    aria-pressed={useEveningFilters}
                    onClick={() => setUseEveningFilters((v) => !v)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      useEveningFilters
                        ? "bg-cg-accent text-cg-accent-fg"
                        : "border border-cg-border bg-cg-surface text-cg-secondary hover:bg-cg-elevated"
                    }`}
                  >
                    {useEveningFilters
                      ? `Filtri Serata attivi (${filteredPool.length})`
                      : `Applica filtri Serata (${filteredPool.length})`}
                  </button>
                )}

                {filtersActive && (
                  <button
                    type="button"
                    onClick={resetPoolFilters}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-cg-muted underline-offset-4 hover:text-cg-text hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Azzera filtri</span>
                  </button>
                )}
              </div>
            </div>

            {filtersOpen && (
              <div className="mt-4 space-y-4 border-t border-cg-border pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="tournament-search"
                      className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-cg-muted"
                    >
                      Cerca titolo o regista
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cg-muted" />
                      <input
                        id="tournament-search"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Es. Hitchcock, Lynch, Noir..."
                        className="w-full rounded-lg border border-cg-border bg-cg-surface py-1.5 pl-8 pr-3 text-xs text-cg-text placeholder:text-cg-muted focus:border-cg-accent focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-cg-muted">
                      Durata massima
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DURATION_PRESETS.map((preset) => {
                        const active = maxMinutes === preset.value;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setMaxMinutes(preset.value)}
                            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                              active
                                ? "bg-cg-accent text-cg-accent-fg"
                                : "border border-cg-border bg-cg-surface text-cg-secondary hover:bg-cg-elevated"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-cg-muted">
                    Generi
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {GENRE_FILTERS.map((g) => {
                      const active = genreFilter.has(g.value);
                      return (
                        <button
                          key={g.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            toggleFilterCode(setGenreFilter, g.value)
                          }
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            active
                              ? "bg-cg-accent text-cg-accent-fg"
                              : "border border-cg-border bg-cg-surface text-cg-secondary hover:bg-cg-elevated"
                          }`}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-cg-muted">
                    Epoche
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DECADE_FILTERS.map((d) => {
                      const active = decadeFilter.has(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            toggleFilterCode(setDecadeFilter, d.value)
                          }
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            active
                              ? "bg-cg-accent text-cg-accent-fg"
                              : "border border-cg-border bg-cg-surface text-cg-secondary hover:bg-cg-elevated"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {source !== "seen_cult" && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-cg-secondary">
                    <input
                      type="checkbox"
                      checked={excludeBlocked}
                      onChange={(e) => setExcludeBlocked(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-cg-border-strong accent-[var(--cg-accent)]"
                    />
                    <span>
                      Escludi titoli scartati o proposti di recente in Serata
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {eligiblePool.length < 8 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cg-warning-border bg-cg-warning-bg px-4 py-3 text-xs text-cg-warning">
              <span>
                Nel pool filtrato ci sono solo {eligiblePool.length} film: servono almeno 8 titoli per generare i Quarti di finale (o 16 per gli Ottavi).
              </span>
              {filtersActive && (
                <button
                  type="button"
                  onClick={resetPoolFilters}
                  className="rounded-lg bg-cg-accent px-3 py-1.5 text-[11px] font-semibold text-cg-accent-fg transition-colors hover:bg-cg-accent-hover"
                >
                  Azzera filtri torneo
                </button>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-cg-border pt-5">
            <div className="flex items-center gap-2 text-xs text-cg-muted">
              <Clapperboard className="h-4 w-4 text-cg-muted" />
              <span>{selectedFormat.steps}</span>
            </div>

            <button
              type="button"
              disabled={eligiblePool.length < bracketSize}
              onClick={() => handleStartTournament(source, bracketSize)}
              className="inline-flex items-center gap-2 rounded-xl bg-cg-accent px-6 py-3 text-sm font-semibold text-cg-accent-fg shadow-sm transition-colors hover:bg-cg-accent-hover disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Shuffle className="h-4 w-4" />
              <span>Sorteggia {bracketSize} film e inizia</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Top HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cg-border bg-cg-surface px-5 py-3.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-lg font-bold tracking-tight text-cg-text">
            ReelRouette
          </h1>
          <span className="text-cg-border-strong" aria-hidden="true">
            ·
          </span>
          {phase === "VICTORY" ? (
            <span className="text-xs font-semibold text-cg-rating">
              Torneo completato
            </span>
          ) : activePos ? (
            <span className="text-xs font-semibold text-cg-accent-text">
              {roundNames[activePos.roundIdx]} · Sfida{" "}
              {activePos.matchIdx + 1} di {rounds[activePos.roundIdx].length}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-xs tabular-nums text-cg-muted">
            {completedCount}/{totalMatches} sfide
          </span>

          {/* Quick mode switcher directly in HUD */}
          <div
            className="inline-flex rounded-lg border border-cg-border bg-cg-bg p-0.5"
            role="group"
            aria-label="Modalità torneo"
          >
            {FORMAT_OPTIONS.map((fmt) => {
              const active = bracketSize === fmt.size;
              const disabled = eligiblePool.length < fmt.size;
              return (
                <button
                  key={fmt.size}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!active && !disabled) {
                      handleStartTournament(source, fmt.size);
                    }
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${
                    active
                      ? "bg-cg-surface text-cg-accent-text shadow-xs"
                      : "text-cg-muted hover:text-cg-text"
                  }`}
                >
                  {fmt.shortLabel}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            aria-label={soundEnabled ? "Disattiva audio" : "Attiva audio"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cg-border bg-cg-bg px-3 py-1.5 text-xs font-medium text-cg-secondary transition-colors hover:bg-cg-elevated whitespace-nowrap shrink-0"
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {soundEnabled ? "Audio" : "Muto"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleStartTournament(source, bracketSize)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cg-border bg-cg-bg px-3 py-1.5 text-xs font-medium text-cg-secondary transition-colors hover:bg-cg-elevated whitespace-nowrap shrink-0"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span>Nuovo sorteggio</span>
          </button>

          <button
            type="button"
            onClick={handleResetToMenu}
            className="rounded-lg border border-cg-border bg-cg-bg px-3 py-1.5 text-xs font-medium text-cg-muted transition-colors hover:bg-cg-elevated hover:text-cg-text whitespace-nowrap shrink-0"
          >
            Filtri e opzioni
          </button>
        </div>
      </div>

      {/* Main Stage: Active Duel OR Victory Celebration */}
      {phase === "VICTORY" && champion ? (
        <CineSfidaVictory
          champion={champion}
          meta={lib.meta[filmKey(champion)]}
          preview={previews[filmKey(champion)]}
          path={championPath}
          canWatchTonight={source !== "seen_cult"}
          watchedConfirmed={watchedConfirmed}
          onWatchTonight={() => {
            const meta = lib.meta[filmKey(champion)];
            onWatchTonightFilm(champion, meta?.d || "");
            setWatchedConfirmed(true);
          }}
          onPlayAgain={() => handleStartTournament(source, bracketSize)}
        />
      ) : (
        currentMatch &&
        currentMatch.a &&
        currentMatch.b && (
          <div
            key={currentMatch.id}
            className="duel-enter grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-5"
          >
            <ContenderCard
              film={currentMatch.a}
              sideLabel="Sfidante A"
              shortcutHint="← o 1"
              meta={lib.meta[filmKey(currentMatch.a)]}
              preview={previews[filmKey(currentMatch.a)]}
              state={
                advancingKey === filmKey(currentMatch.a)
                  ? "winner"
                  : advancingKey
                  ? "loser"
                  : "idle"
              }
              disabled={Boolean(advancingKey)}
              onSelect={() => handlePickWinner(currentMatch.a!)}
            />

            <div className="flex items-center justify-center py-1 md:py-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cg-border bg-cg-surface font-mono text-xs font-bold text-cg-secondary shadow-xs">
                VS
              </div>
            </div>

            <ContenderCard
              film={currentMatch.b}
              sideLabel="Sfidante B"
              shortcutHint="→ o 2"
              meta={lib.meta[filmKey(currentMatch.b)]}
              preview={previews[filmKey(currentMatch.b)]}
              state={
                advancingKey === filmKey(currentMatch.b)
                  ? "winner"
                  : advancingKey
                  ? "loser"
                  : "idle"
              }
              disabled={Boolean(advancingKey)}
              onSelect={() => handlePickWinner(currentMatch.b!)}
            />
          </div>
        )
      )}

      {/* Live bracket overview */}
      <CineSfidaBracket
        rounds={rounds}
        activePos={activePos}
        previews={previews}
        recentlyAdvancedKey={recentlyAdvancedKey}
      />
    </div>
  );
};
