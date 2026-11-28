import React, { useMemo, useState } from "react";
import {
  COUNTRY_FILTERS,
  OUTCOMES,
  canonicalFilmIdentity,
  canonicalLabel,
  displayTitle,
  filmKey,
  getAllSeen,
  itTitle,
  nz,
  parseJsonSafely,
} from "../utils/filmLogic";
import { formatAIError, generateWithAI } from "../utils/aiClient";
import { DiaryTab } from "./DiaryTab";
import type {
  DiaryEntry,
  FilmMeta,
  HistoryEntry,
  LibraryState,
  OutcomeKey,
  RssSyncResult,
  SeenFilmItem,
} from "../types";

interface HistoryViewProps {
  seen: SeenFilmItem[];
  lib: LibraryState;
  aiAvailable: boolean;
  onOutcome: (entry: HistoryEntry, outcome: OutcomeKey) => void;
  onWatchFromHistory: (entry: HistoryEntry) => void;
  onRepropose: (entry: HistoryEntry) => void;
  onUndoNever: (entry: HistoryEntry) => void;
  onMergeMeta: (updates: Record<string, FilmMeta>) => void;
  onSyncDiaryRss: (
    username: string,
    options?: { onlyNew?: boolean }
  ) => Promise<RssSyncResult>;
  onImportDiaryCsv: (entries: DiaryEntry[]) => number;
  onOpenArchive: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  p: "Proposto",
  y: "Stasera sì",
  s: "Visto",
  n: "Mai",
  l: "Rimandato",
  a: "Aggiunto alla lista",
};

type HistTab = "y" | "s" | "n" | "d";

const tabOf = (o: string): "y" | "s" | "n" | "" =>
  o === "y" ? "y" : o === "s" ? "s" : o === "n" || o === "l" ? "n" : "";

export const HistoryView: React.FC<HistoryViewProps> = ({
  seen,
  lib,
  aiAvailable,
  onOutcome,
  onWatchFromHistory,
  onRepropose,
  onUndoNever,
  onMergeMeta,
  onSyncDiaryRss,
  onImportDiaryCsv,
  onOpenArchive,
}) => {
  const [activeTab, setActiveTab] = useState<HistTab | "">("");
  const [limits, setLimits] = useState<Record<"y" | "s" | "n", number>>({
    y: 10,
    s: 10,
    n: 10,
  });
  const [enrichMsg, setEnrichMsg] = useState("");
  const [enrichBusy, setEnrichBusy] = useState(false);

  const allSeen = useMemo(
    () => getAllSeen(seen, lib.marks),
    [seen, lib.marks]
  );

  const stats = useMemo(() => {
    const rated = allSeen.filter((x) => x.r != null);
    const maxR = rated.length ? Math.max(...rated.map((x) => x.r || 0)) : 5;
    const unit = maxR <= 5 ? 1 : 2;
    const avg = rated.length
      ? rated.reduce((acc, x) => acc + (x.r || 0), 0) / rated.length / unit
      : 0;

    const hist = lib.hist || [];
    const monthAgo = Date.now() - 30 * 864e5;
    const chosen30 = hist.filter(
      (h) => (h.o === "y" || h.o === "s") && h.ts > monthAgo
    ).length;
    const seen30 = hist.filter((h) => h.o === "s" && h.ts > monthAgo).length;

    const decades: Record<number, number> = {};
    allSeen.forEach((x) => {
      const y = +x.y;
      if (y) {
        const d = Math.floor(y / 10) * 10;
        decades[d] = (decades[d] || 0) + 1;
      }
    });

    const countries: Record<string, number> = {};
    let knownCountries = 0;
    let italianCount = 0;
    const itRegex = COUNTRY_FILTERS.find((c) => c.value === "it")!.regex;

    const missingCountryFilms: SeenFilmItem[] = [];
    allSeen.forEach((x) => {
      const m = lib.meta[filmKey(x)];
      const c = m && nz(m.c) ? String(m.c) : "";
      if (c) {
        knownCountries++;
        const primary = c.split(/[\/,]/)[0].trim();
        countries[primary] = (countries[primary] || 0) + 1;
        if (itRegex.test(c)) italianCount++;
      } else {
        missingCountryFilms.push(x);
        if (itTitle(x)) italianCount++;
      }
    });

    const topCountries = Object.entries(countries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return {
      totalSeen: allSeen.length,
      ratedCount: rated.length,
      avg,
      chosen30,
      seen30,
      decades: Object.keys(decades)
        .map(Number)
        .sort((a, b) => a - b)
        .map((d) => ({ decade: d, count: decades[d] })),
      knownCountries,
      topCountries,
      italianCount,
      missingCountryFilms,
    };
  }, [allSeen, lib.hist, lib.meta]);

  const filteredHist = useMemo(
    () =>
      (lib.hist || [])
        .filter((h) => tabOf(h.o) !== "")
        .slice()
        .reverse(),
    [lib.hist]
  );

  const diaryEntries = lib.diary || [];

  const counts = useMemo(() => {
    const c: Record<HistTab, number> = {
      y: 0,
      s: 0,
      n: 0,
      d: diaryEntries.length,
    };
    filteredHist.forEach((h) => {
      const t = tabOf(h.o);
      if (t) c[t]++;
    });
    return c;
  }, [filteredHist, diaryEntries.length]);

  const currentTab: HistTab =
    activeTab ||
    (counts.y ? "y" : counts.d ? "d" : counts.s ? "s" : counts.n ? "n" : "d");

  const visibleList =
    currentTab === "d"
      ? []
      : filteredHist.filter((h) => tabOf(h.o) === currentTab);
  const limit = currentTab === "d" ? 10 : limits[currentTab];

  const handleCompleteCountries = async () => {
    const seenCanon = new Set<string>();
    const miss = stats.missingCountryFilms.filter((f) => {
      const canon = canonicalFilmIdentity(f);
      if (seenCanon.has(canon)) return false;
      seenCanon.add(canon);
      return true;
    });
    if (!miss.length || enrichBusy) return;
    setEnrichBusy(true);
    setEnrichMsg("");
    try {
      for (let i = 0; i < miss.length; i += 80) {
        const batch = miss.slice(i, i + 80);
        setEnrichMsg(
          `Completo i paesi… ${Math.min(i + 80, miss.length)}/${miss.length}`
        );
        const prompt =
          `Per ciascun film indica il paese di produzione principale, in italiano (es. Italia, Stati Uniti, Francia). Se non conosci il film con certezza usa null: non inventare.\nRispondi SOLO con un array JSON: [{"i":0,"c":"..."}]\n\n` +
          batch.map((x, j) => `${j}. ${canonicalLabel(x)}`).join("\n");
        const raw = await generateWithAI(prompt, {
          jsonMode: "array",
          fast: true,
        });
        const arr = parseJsonSafely<Array<{ i: number; c: string | null }>>(
          raw,
          "["
        );
        const updates: Record<string, FilmMeta> = {};
        for (const o of arr) {
          const x = batch[o.i];
          if (x && o.c && o.c !== "null") {
            const k = filmKey(x);
            const existing = lib.meta[k] || { g: "", m: 0, d: "", c: "" };
            if (!nz(existing.c)) {
              updates[k] = { ...existing, c: String(o.c).trim() };
            }
          }
        }
        if (Object.keys(updates).length > 0) {
          onMergeMeta(updates);
        }
      }
      setEnrichMsg("Paesi aggiornati.");
    } catch (err) {
      setEnrichMsg(formatAIError(err));
    } finally {
      setEnrichBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#131722]">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200/80 pb-3 dark:border-slate-800">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            I tuoi numeri
          </h2>
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            Ultimi 30 giorni: {stats.chosen30} scelti · {stats.seen30} visti
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Film visti
            </div>
            <div className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
              {stats.totalSeen}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Con voto
            </div>
            <div className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
              {stats.ratedCount}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Media voti
            </div>
            <div className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
              {stats.ratedCount ? `${stats.avg.toFixed(1)}★` : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Cinema italiano
            </div>
            <div className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
              {stats.italianCount}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-2.5 border-t border-slate-200/80 pt-5 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
          <div>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Decenni:{" "}
            </span>
            <span className="font-mono text-xs tabular-nums">
              {stats.decades
                .map((d) => `${d.decade}s ${d.count}`)
                .join(" · ") || "—"}
            </span>
          </div>
          <div>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Paesi (su {stats.knownCountries} film con dato):{" "}
            </span>
            <span className="font-mono text-xs tabular-nums">
              {stats.topCountries.length
                ? stats.topCountries.map(([c, n]) => `${c} ${n}`).join(" · ")
                : "dati non ancora disponibili"}
            </span>
          </div>

          {stats.missingCountryFilms.length > 0 && aiAvailable && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={enrichBusy}
                onClick={handleCompleteCountries}
                className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {enrichBusy
                  ? enrichMsg
                  : `Completa i paesi dei film visti (~${Math.ceil(
                      stats.missingCountryFilms.length / 80
                    )} richieste)`}
              </button>
              {!enrichBusy && enrichMsg && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {enrichMsg}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#131722]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Cronologia scelte
          </h2>

          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-[#F5F7FA] p-1 dark:border-slate-800 dark:bg-[#0B0E14]">
            {(
              [
                ["y", "Da vedere"],
                ["d", "Diario"],
                ["s", "Visti"],
                ["n", "Scartati"],
              ] as const
            ).map(([key, label]) => {
              const active = currentTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-[#2563EB] text-white dark:bg-[#3B82F6]"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  {label}{" "}
                  <span className="ml-1 font-mono tabular-nums opacity-80">
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {currentTab === "d" ? (
          <DiaryTab
            diary={diaryEntries}
            letterboxdUser={lib.letterboxdUser || ""}
            diarySyncedAt={lib.diarySyncedAt}
            meta={lib.meta}
            onSyncRss={onSyncDiaryRss}
            onImportDiaryCsv={onImportDiaryCsv}
            onOpenArchive={onOpenArchive}
          />
        ) : !visibleList.length ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {currentTab === "y"
              ? "Nessun film da vedere: premi «Guardo questo» su un consiglio."
              : currentTab === "s"
              ? "Qui compariranno i film che hai visto dopo averli scelti."
              : "Qui compariranno i film che hai rimandato o scartato."}
          </p>
        ) : (
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
            {visibleList.slice(0, limit).map((h) => {
              const mark = lib.marks[h.k];
              const outcomeText =
                h.o === "s" && mark
                  ? mark.fb && OUTCOMES[mark.fb]
                    ? ` · ${OUTCOMES[mark.fb].label}`
                    : mark.r != null
                    ? ` · ${mark.r}★`
                    : ""
                  : "";
              const dateStr = new Date(h.ts).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "short",
              });

              return (
                <div
                  key={h.k}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                        {displayTitle(h)}
                      </span>
                      {h.y && (
                        <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                          {h.y}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{STATUS_LABELS[h.o] || ""}</span>
                      {outcomeText && <span>{outcomeText}</span>}
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono tabular-nums">{dateStr}</span>
                      {h.e && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>fuori lista</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {h.o === "y" && (
                      <>
                        {(Object.keys(OUTCOMES) as OutcomeKey[]).map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => onOutcome(h, k)}
                            className={
                              k === "love"
                                ? "rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap shrink-0 dark:bg-[#3B82F6]"
                                : "rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                            }
                          >
                            {OUTCOMES[k].label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => onRepropose(h)}
                          className="rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          Non più
                        </button>
                      </>
                    )}
                    {h.o === "l" && (
                      <>
                        <button
                          type="button"
                          onClick={() => onWatchFromHistory(h)}
                          className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap shrink-0 dark:bg-[#3B82F6]"
                        >
                          Guardo questo
                        </button>
                        <button
                          type="button"
                          onClick={() => onRepropose(h)}
                          className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Riproponi
                        </button>
                      </>
                    )}
                    {h.o === "n" && (
                      <button
                        type="button"
                        onClick={() => onUndoNever(h)}
                        className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Annulla
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {currentTab !== "d" && visibleList.length > limit && (
          <div className="mt-5 border-t border-slate-200/80 pt-4 text-center dark:border-slate-800">
            <button
              type="button"
              onClick={() =>
                setLimits((prev) => ({
                  ...prev,
                  [currentTab]: prev[currentTab] + 10,
                }))
              }
              className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Mostra altri ({Math.min(10, visibleList.length - limit)} di{" "}
              {visibleList.length - limit})
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
