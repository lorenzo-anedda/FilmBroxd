import React, { useMemo, useRef, useState } from "react";
import { ExternalLink, RefreshCw, RotateCcw, Search, Upload } from "lucide-react";
import { fetchFilmPreview } from "../utils/aiClient";
import { safeExternalUrl } from "../utils/filmHelpers";
import { parseDiaryCSV, parseFilmImport } from "../utils/parsers";
import { getCachedPreview } from "../utils/posterCache";
import { PosterImage } from "./PosterImage";
import type { DiaryEntry, FilmMeta, RssSyncResult } from "../types";

interface DiaryTabProps {
  diary: DiaryEntry[];
  letterboxdUser: string;
  diarySyncedAt?: number;
  meta: Record<string, FilmMeta>;
  onSyncRss: (
    username: string,
    options?: { onlyNew?: boolean }
  ) => Promise<RssSyncResult>;
  onImportDiaryCsv: (entries: DiaryEntry[]) => number;
  onOpenArchive?: () => void;
}

const MONTH_NAMES_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

function formatStars(rating?: number | null): string {
  if (rating == null || !Number.isFinite(rating) || rating <= 0) return "";
  const full = Math.floor(rating);
  const half = rating - full >= 0.25 && rating - full < 0.75;
  const roundedUp = rating - full >= 0.75 ? full + 1 : full;
  return `${"★".repeat(roundedUp)}${half ? "½" : ""}`;
}

function formatMonthHeading(ym: string): string {
  const [y, m] = ym.split("-");
  const monthIdx = Number(m) - 1;
  const name = MONTH_NAMES_IT[monthIdx] || m;
  return `${name} ${y}`;
}

export const DiaryTab: React.FC<DiaryTabProps> = ({
  diary,
  letterboxdUser,
  diarySyncedAt,
  meta,
  onSyncRss,
  onImportDiaryCsv,
  onOpenArchive,
}) => {
  const [userInput, setUserInput] = useState<string>(letterboxdUser || "");
  const [onlyNewFilms, setOnlyNewFilms] = useState<boolean>(true);
  const [syncBusy, setSyncBusy] = useState<boolean>(false);
  const [syncMsg, setSyncMsg] = useState<string>("");
  const [syncErr, setSyncErr] = useState<string>("");
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [yearFilter, setYearFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [rewatchOnly, setRewatchOnly] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [visibleCap, setVisibleCap] = useState<number>(30);
  const [resolvedPosters, setResolvedPosters] = useState<Record<string, string>>(
    {}
  );

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const e of diary) {
      const y = e.watchedDate.slice(0, 4);
      if (/^\d{4}$/.test(y)) set.add(y);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [diary]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of diary) {
      for (const tag of e.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([tag]) => tag);
  }, [diary]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return diary.filter((e) => {
      if (yearFilter !== "all" && !e.watchedDate.startsWith(yearFilter)) {
        return false;
      }
      if (rewatchOnly && !e.rw) {
        return false;
      }
      if (tagFilter !== "all" && !(e.tags || []).includes(tagFilter)) {
        return false;
      }
      if (q) {
        const hay = `${e.t} ${e.y} ${(e.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [diary, yearFilter, rewatchOnly, tagFilter, query]);

  const sliced = useMemo(
    () => filtered.slice(0, visibleCap),
    [filtered, visibleCap]
  );

  const groupedByMonth = useMemo(() => {
    const groups: Array<{ ym: string; label: string; items: DiaryEntry[] }> = [];
    const byYm = new Map<string, DiaryEntry[]>();
    for (const entry of sliced) {
      const ym = entry.watchedDate.slice(0, 7);
      const list = byYm.get(ym);
      if (list) list.push(entry);
      else byYm.set(ym, [entry]);
    }
    for (const [ym, items] of byYm.entries()) {
      groups.push({ ym, label: formatMonthHeading(ym), items });
    }
    return groups;
  }, [sliced]);

  const handleRssSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = userInput.trim().replace(/^@/, "");
    if (!clean || syncBusy) return;
    setSyncBusy(true);
    setSyncErr("");
    setSyncMsg("");
    try {
      const res = await onSyncRss(clean, { onlyNew: onlyNewFilms });
      if (res.onlyNew && res.added === 0) {
        setSyncMsg(
          `Nessun nuovo film da aggiungere da @${clean}: tutti i ${res.totalRss} titoli del feed RSS sono già presenti nella tua lista.`
        );
      } else {
        const skippedNote =
          res.onlyNew && res.skippedAlreadyLoaded > 0
            ? ` (${res.skippedAlreadyLoaded} già in lista ignorati)`
            : "";
        const actorsNote =
          res.enrichedActorsCount > 0
            ? ` · registi e attori reali analizzati per ${res.enrichedActorsCount} nuovi film`
            : "";
        setSyncMsg(
          `Sync completato da @${clean}: ${res.added} ${
            res.added === 1 ? "nuovo film aggiunto" : "nuovi film aggiunti"
          } su ${res.totalRss} nel feed${skippedNote}${actorsNote}. Lista precaricata e attori precedenti mantenuti intatti.`
        );
      }
    } catch (err) {
      setSyncErr(
        err instanceof Error ? err.message : "Errore nella sincronizzazione RSS."
      );
    } finally {
      setSyncBusy(false);
    }
  };

  const handleDiaryCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyncErr("");
    setSyncMsg("");
    const text = await file.text();
    const parsed = parseDiaryCSV(text);
    if (!parsed.length) {
      const fallback = parseFilmImport(text);
      setSyncErr(
        fallback.length > 0
          ? "Questo file non ha la colonna «Watched Date» di diary.csv: caricalo dalla scheda Archivio come watched.csv/ratings.csv."
          : "Nessuna voce valida trovata nel file diary.csv."
      );
      e.target.value = "";
      return;
    }
    const totalAfter = onImportDiaryCsv(parsed);
    setSyncMsg(
      `Importato ${parsed.length} visioni da diary.csv (${totalAfter} log totali nel Diario). Ora il sync RSS aggiungerà solo i nuovi film.`
    );
    e.target.value = "";
  };

  const requestPosterIfNeeded = (entry: DiaryEntry) => {
    if (entry.posterUrl || resolvedPosters[entry.k]) return;
    const director = meta[entry.k]?.d || "";
    const cacheKey = `${entry.t.toLowerCase()}|${entry.y || ""}|${director.toLowerCase()}`;
    const cached = getCachedPreview(cacheKey);
    if (cached?.posterUrl) {
      setResolvedPosters((prev) =>
        prev[entry.k] ? prev : { ...prev, [entry.k]: cached.posterUrl! }
      );
      return;
    }
    fetchFilmPreview({ t: entry.t, y: entry.y }, director, { fast: true }).then(
      (res) => {
        if (res.posterUrl) {
          setResolvedPosters((prev) => ({
            ...prev,
            [entry.k]: res.posterUrl!,
          }));
        }
      }
    );
  };

  return (
    <div className="space-y-5">
      {/* Quick RSS sync + full diary.csv import bar */}
      <form
        onSubmit={handleRssSubmit}
        className="space-y-3 rounded-xl border border-slate-200/80 bg-[#F5F7FA] p-3.5 dark:border-slate-800 dark:bg-[#0B0E14]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Sincronizza solo i film nuovi da Letterboxd
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Mantiene intatti lista precaricata e attori già analizzati: legge gli ultimi ~50 log pubblici e aggiunge solo i titoli che non hai ancora caricato (analizzandone automaticamente regista e attori)
              {diarySyncedAt
                ? ` · ultimo sync ${new Date(diarySyncedAt).toLocaleDateString(
                    "it-IT",
                    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
                  )}`
                : ""}
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={handleDiaryCsvFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#131722] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Upload className="h-3.5 w-3.5" />
              Carica diary.csv
            </button>

            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="username Letterboxd"
              aria-label="Username Letterboxd"
              className="w-40 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none dark:border-slate-700 dark:bg-[#131722] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[#3B82F6]"
            />
            <button
              type="submit"
              disabled={syncBusy || !userInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 whitespace-nowrap shrink-0 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncBusy ? "animate-spin" : ""}`} />
              {syncBusy ? "Sincronizzo…" : "Sincronizza RSS"}
            </button>
          </div>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={onlyNewFilms}
            onChange={(e) => setOnlyNewFilms(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB] dark:border-slate-600 dark:bg-[#131722]"
          />
          Importa solo i film nuovi non ancora presenti nella tua lista
        </label>
      </form>

      {(syncMsg || syncErr) && (
        <p
          className={`text-xs font-medium ${
            syncErr
              ? "text-rose-600 dark:text-rose-400"
              : "text-slate-700 dark:text-slate-300"
          }`}
        >
          {syncErr || syncMsg}
        </p>
      )}

      {diary.length === 0 ? (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Il tuo Diario è ancora vuoto. Sincronizza il tuo username Letterboxd qui
            sopra oppure carica <span className="font-mono">diary.csv</span> da Archivio.
          </p>
          {onOpenArchive && (
            <button
              type="button"
              onClick={onOpenArchive}
              className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Vai ad Archivio
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setVisibleCap(30);
                  }}
                  placeholder="Cerca titolo o tag…"
                  aria-label="Cerca nel diario"
                  className="w-44 rounded-lg border border-slate-200 bg-[#F5F7FA] py-1.5 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              {years.length > 0 && (
                <select
                  value={yearFilter}
                  aria-label="Filtra per anno"
                  onChange={(e) => {
                    setYearFilter(e.target.value);
                    setVisibleCap(30);
                  }}
                  className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-2.5 py-1.5 font-mono text-xs text-slate-700 focus:border-[#2563EB] focus:outline-none dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-200"
                >
                  <option value="all">Tutti gli anni ({diary.length})</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}

              {tags.length > 0 && (
                <select
                  value={tagFilter}
                  aria-label="Filtra per tag"
                  onChange={(e) => {
                    setTagFilter(e.target.value);
                    setVisibleCap(30);
                  }}
                  className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-2.5 py-1.5 text-xs text-slate-700 focus:border-[#2563EB] focus:outline-none dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-200"
                >
                  <option value="all">Tutti i tag</option>
                  {tags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => {
                  setRewatchOnly((v) => !v);
                  setVisibleCap(30);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  rewatchOnly
                    ? "border-[#2563EB] bg-[#2563EB] text-white dark:border-[#3B82F6] dark:bg-[#3B82F6]"
                    : "border-slate-200 bg-[#F5F7FA] text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <RotateCcw className="h-3 w-3" />
                Solo rewatch
              </button>
            </div>

            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {filtered.length} {filtered.length === 1 ? "visione" : "visioni"}
            </span>
          </div>

          {!groupedByMonth.length ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Nessuna visione trovata con questi filtri.
            </p>
          ) : (
            <div className="space-y-7 pt-1">
              {groupedByMonth.map((group) => (
                <div key={group.ym}>
                  <div className="mb-2 flex items-baseline justify-between border-b border-slate-200/80 pb-2 dark:border-slate-800">
                    <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {group.label}
                    </h3>
                    <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {group.items.length}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                    {group.items.map((entry) => {
                      const day = entry.watchedDate.slice(8, 10);
                      const stars = formatStars(entry.r);
                      const posterSrc =
                        entry.posterUrl || resolvedPosters[entry.k] || null;
                      const safeEntryLink = safeExternalUrl(
                        entry.letterboxdUrl,
                        ["letterboxd.com", "boxd.it"]
                      );
                      const m = meta[entry.k];

                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3.5 py-3 first:pt-1 last:pb-0"
                        >
                          <div className="w-8 shrink-0 text-center font-mono text-base font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                            {day}
                          </div>

                          <div className="h-14 w-9.5 shrink-0 overflow-hidden rounded-md border border-slate-200/80 bg-[#F5F7FA] dark:border-slate-800 dark:bg-[#0B0E14]">
                            <PosterImage
                              cacheKey={entry.k}
                              title={entry.t}
                              year={entry.y}
                              posterUrl={posterSrc}
                              compactFallback
                              className="h-full w-full"
                              onVisible={() => requestPosterIfNeeded(entry)}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="truncate font-display text-sm font-semibold text-slate-900 sm:text-base dark:text-slate-100">
                                {entry.t}
                              </span>
                              {entry.y && (
                                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                                  {entry.y}
                                </span>
                              )}
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                              {stars && (
                                <span className="font-mono font-medium text-[#2563EB] dark:text-[#60A5FA]">
                                  {stars}
                                </span>
                              )}
                              {entry.rw && (
                                <>
                                  {stars && <span aria-hidden="true">·</span>}
                                  <span className="font-medium text-slate-700 dark:text-slate-300">
                                    Rewatch
                                  </span>
                                </>
                              )}
                              {m?.d && (
                                <>
                                  {(stars || entry.rw) && (
                                    <span aria-hidden="true">·</span>
                                  )}
                                  <span>{m.d}</span>
                                </>
                              )}
                              {entry.tags && entry.tags.length > 0 && (
                                <>
                                  {(stars || entry.rw || m?.d) && (
                                    <span aria-hidden="true">·</span>
                                  )}
                                  <span>{entry.tags.join(", ")}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {safeEntryLink && (
                            <a
                              href={safeEntryLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Apri ${entry.t} su Letterboxd`}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-[#F5F7FA] text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filtered.length > visibleCap && (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setVisibleCap((c) => c + 50)}
                className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Mostra altri ({Math.min(50, filtered.length - visibleCap)} di{" "}
                {filtered.length - visibleCap})
              </button>
              <button
                type="button"
                onClick={() => setVisibleCap(filtered.length)}
                className="rounded-lg border border-slate-200 bg-transparent px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Mostra tutti ({filtered.length})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
