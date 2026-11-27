import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Clapperboard,
  Shuffle,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { fetchFilmPreview } from "../utils/aiClient";
import { playAdvanceSound, playVictoryFanfare } from "../utils/cinemaSound";
import { displayTitle, filmKey, nz } from "../utils/filmHelpers";
import {
  cloneBracketWithWinner,
  countCompletedMatches,
  createBracket,
  findNextPlayableMatch,
  getChampionPath,
  getRoundNames,
  pickContenders,
  type BracketMatch,
  type BracketSize,
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
  title: string;
  subtitle: string;
  steps: string;
}> = [
  {
    size: 8,
    title: "Solo Quarti · 8 film",
    subtitle: "Torneo rapido in 7 sfide (Quarti → Semifinali → Finale).",
    steps: "Quarti (4) · Semifinali (2) · Finale (1)",
  },
  {
    size: 16,
    title: "Ottavi di finale · 16 film",
    subtitle: "Tabellone completo in 15 sfide (Ottavi → Quarti → Semifinali → Finale).",
    steps: "Ottavi (8) · Quarti (4) · Semifinali (2) · Finale (1)",
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
      `Seleziona ${n} titoli dalla tua watchlist più affini ai tuoi gusti.`,
  },
  {
    id: "watchlist_random",
    title: "Watchlist · Sorteggio libero",
    desc: (n) =>
      `Estrae ${n} film casuali tra tutti quelli ancora da vedere.`,
  },
  {
    id: "seen_cult",
    title: "Film già visti · Torneo cult",
    desc: (n) =>
      `Sfida tra ${n} film che hai già visto e amato per eleggere il migliore.`,
  },
];

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
      className={`group relative flex h-full w-full flex-col justify-between rounded-2xl border bg-white p-5 text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:bg-[#131722] ${
        state === "winner"
          ? "duel-winner border-[#2563EB] ring-2 ring-[#2563EB]/25 dark:border-[#3B82F6] dark:ring-[#3B82F6]/30"
          : state === "loser"
          ? "duel-loser border-slate-200/80 dark:border-slate-800"
          : "border-slate-200/90 hover:-translate-y-0.5 hover:border-[#2563EB]/60 hover:shadow-md dark:border-slate-800 dark:hover:border-[#3B82F6]/60"
      }`}
    >
      <div>
        <div className="mb-3 flex items-center justify-between gap-2 text-xs">
          <span className="font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {sideLabel}
          </span>
          <span
            className={`font-mono text-[11px] font-semibold transition-colors ${
              state === "winner"
                ? "text-[#2563EB] dark:text-[#60A5FA]"
                : "text-slate-400 group-hover:text-[#2563EB] dark:text-slate-500 dark:group-hover:text-[#60A5FA]"
            }`}
          >
            {state === "winner" ? "PASSA IL TURNO" : `Tasto ${shortcutHint}`}
          </span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Visible prominent movie poster */}
          <div className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-40">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 dark:border-slate-800 dark:bg-[#0B0E14]">
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

          {/* Title, metadata & synopsis */}
          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <h3 className="font-display text-xl font-bold leading-snug tracking-tight text-slate-900 dark:text-slate-100 [text-wrap:balance]">
                {title}
              </h3>
              {origDiffers && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {origDiffers}
                </p>
              )}
            </div>

            {metaParts.length > 0 && (
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {metaParts.join(" · ")}
              </p>
            )}

            <p className="line-clamp-5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {preview?.loading && !preview.description
                ? "Recupero trama e locandina…"
                : preview?.description ||
                  "Sinossi non disponibile per questo titolo."}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-200/80 pt-3.5 text-xs font-semibold dark:border-slate-800">
        <span
          className={
            state === "winner"
              ? "text-[#2563EB] dark:text-[#60A5FA]"
              : "text-slate-700 group-hover:text-[#2563EB] dark:text-slate-300 dark:group-hover:text-[#60A5FA]"
          }
        >
          {state === "winner" ? "Avanza al turno successivo" : "Scegli questo film"}
        </span>
        <ArrowRight
          className={`h-4 w-4 transition-transform duration-200 ${
            state === "winner"
              ? "translate-x-1 text-[#2563EB] dark:text-[#60A5FA]"
              : "text-slate-400 group-hover:translate-x-1 group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA]"
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

  const activeWatchPool =
    useEveningFilters && hasActiveFilters && filteredPool.length >= bracketSize
      ? filteredPool
      : watchlistPool;

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

  // Preload posters & descriptions using a 6-worker fast queue (posters appear immediately without waiting on AI)
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

    const missingSynopsisQueue: FilmItem[] = [];
    let cursor = 0;

    const runFastWorker = async () => {
      while (cursor < films.length && mountedRef.current) {
        const f = films[cursor++];
        const k = filmKey(f);
        const meta = lib.meta[k];
        const data = await fetchFilmPreview(f, meta?.d, { fast: true });
        if (!mountedRef.current) return;
        setPreviews((cur) => ({ ...cur, [k]: { ...data, loading: false } }));
        if (!data.description || data.description.length < 70) {
          missingSynopsisQueue.push(f);
        }
      }
    };

    const workerCount = Math.min(6, films.length);
    await Promise.all(Array.from({ length: workerCount }, () => runFastWorker()));

    // Quietly upgrade missing Italian synopses after all covers are already loaded
    let synCursor = 0;
    const runSynopsisWorker = async () => {
      while (synCursor < missingSynopsisQueue.length && mountedRef.current) {
        const f = missingSynopsisQueue[synCursor++];
        const k = filmKey(f);
        const meta = lib.meta[k];
        const fullData = await fetchFilmPreview(f, meta?.d, { fast: false });
        if (!mountedRef.current) return;
        setPreviews((cur) => ({
          ...cur,
          [k]: { ...fullData, loading: false },
        }));
      }
    };

    if (missingSynopsisQueue.length > 0 && mountedRef.current) {
      await Promise.all(
        Array.from(
          { length: Math.min(3, missingSynopsisQueue.length) },
          () => runSynopsisWorker()
        )
      );
    }
  };

  const handleStartTournament = (
    chosenSource: TournamentSource = source,
    chosenSize: BracketSize = bracketSize
  ) => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    const poolForDraw =
      chosenSource === "seen_cult" ? watchlistPool : activeWatchPool;
    const contenders = pickContenders(
      chosenSource,
      chosenSize,
      poolForDraw,
      allSeen,
      lib
    );
    if (contenders.length < chosenSize) return;

    setRounds(createBracket(contenders, chosenSize));
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

  const availableCountForSource = (s: TournamentSource) => {
    if (s === "seen_cult") return allSeen.length;
    return activeWatchPool.length;
  };

  const championPath = useMemo(
    () => (champion ? getChampionPath(rounds, champion) : []),
    [champion, rounds]
  );

  const selectedFormat =
    FORMAT_OPTIONS.find((f) => f.size === bracketSize) || FORMAT_OPTIONS[1];

  if (phase === "MENU") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-[#131722]">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
                <Trophy className="h-4 w-4" />
                <span>Torneo a eliminazione diretta</span>
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
                ReelRouette
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Scegli il formato dai Quarti o dagli Ottavi di finale: sfida dopo sfida con locandina e trama, eleggi il vincitore della serata.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
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

          {/* Format selector: Solo Quarti (8) vs Ottavi di finale (16) */}
          <div className="mb-5">
            <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Formato del tabellone
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {FORMAT_OPTIONS.map((fmt) => {
                const active = bracketSize === fmt.size;
                return (
                  <button
                    key={fmt.size}
                    type="button"
                    onClick={() => setBracketSize(fmt.size)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? "border-[#2563EB] bg-[#2563EB]/[0.06] dark:border-[#3B82F6] dark:bg-[#3B82F6]/[0.1]"
                        : "border-slate-200 bg-[#F5F7FA] hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0E14] dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {fmt.title}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
                        {fmt.size - 1} sfide
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {fmt.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pool source selector */}
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Da dove pescare i film
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {SOURCE_OPTIONS.map((opt) => {
              const selected = source === opt.id;
              const avail = availableCountForSource(opt.id);
              const tooSmall = avail < bracketSize;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={tooSmall}
                  onClick={() => setSource(opt.id)}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-colors disabled:opacity-45 ${
                    selected
                      ? "border-[#2563EB] bg-[#2563EB]/[0.06] dark:border-[#3B82F6] dark:bg-[#3B82F6]/[0.1]"
                      : "border-slate-200 bg-[#F5F7FA] hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0E14] dark:hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {opt.title}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {opt.desc(bracketSize)}
                    </p>
                  </div>
                  <div className="mt-4 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {avail} film disponibili
                  </div>
                </button>
              );
            })}
          </div>

          {hasActiveFilters && source !== "seen_cult" && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-[#F5F7FA] px-4 py-3 text-xs dark:border-slate-800 dark:bg-[#0B0E14]">
              <span className="text-slate-600 dark:text-slate-300">
                Hai filtri attivi nella scheda Serata ({filteredPool.length} film compatibili).
              </span>
              <button
                type="button"
                onClick={() => setUseEveningFilters((v) => !v)}
                disabled={filteredPool.length < bracketSize}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${
                  useEveningFilters && filteredPool.length >= bracketSize
                    ? "bg-[#2563EB] text-white dark:bg-[#3B82F6]"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#131722] dark:text-slate-300"
                }`}
              >
                {filteredPool.length < bracketSize
                  ? `Servono almeno ${bracketSize} film filtrati`
                  : useEveningFilters
                  ? "Uso i filtri di Serata · Attivo"
                  : "Applica filtri di Serata"}
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 pt-5 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Clapperboard className="h-4 w-4 text-slate-400" />
              <span>{selectedFormat.steps}</span>
            </div>

            <button
              type="button"
              disabled={availableCountForSource(source) < bracketSize}
              onClick={() => handleStartTournament(source, bracketSize)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 whitespace-nowrap shrink-0 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-[#131722]">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            ReelRouette
          </h1>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>
          {phase === "VICTORY" ? (
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Torneo completato
            </span>
          ) : activePos ? (
            <span className="text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA]">
              {roundNames[activePos.roundIdx]} · Sfida{" "}
              {activePos.matchIdx + 1} di {rounds[activePos.roundIdx].length}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {completedCount}/{totalMatches} sfide
          </span>

          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            aria-label={soundEnabled ? "Disattiva audio" : "Attiva audio"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span>Nuovo sorteggio</span>
          </button>

          <button
            type="button"
            onClick={handleResetToMenu}
            className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cambia opzioni
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white font-mono text-xs font-bold text-slate-600 shadow-xs dark:border-slate-800 dark:bg-[#131722] dark:text-slate-300">
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
