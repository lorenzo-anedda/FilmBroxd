import React, { useRef, useState } from "react";
import {
  diaryToSeenItems,
  isDiaryCSV,
  mergeDiaryEntries,
  mergeSeenImports,
  parseDiaryCSV,
  parseFilmImport,
} from "../utils/filmLogic";
import type {
  DiaryEntry,
  FilmItem,
  LibraryState,
  SeenFilmItem,
  WatchlistDataState,
} from "../types";

interface ArchiveViewProps {
  data: WatchlistDataState;
  lib: LibraryState;
  onImportWatchlist: (films: FilmItem[]) => void;
  onImportSeen: (films: SeenFilmItem[], diaryEntries?: DiaryEntry[]) => void;
  onSyncDiaryRss: (username: string) => Promise<{ added: number; total: number }>;
  onClearToEmptyUser: () => void;
  onResetOriginal: () => void;
  onImportBackup: (payload: {
    L: LibraryState;
    D?: Partial<WatchlistDataState>;
  }) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  data,
  lib,
  onImportWatchlist,
  onImportSeen,
  onSyncDiaryRss,
  onClearToEmptyUser,
  onResetOriginal,
  onImportBackup,
}) => {
  const [notice, setNotice] = useState("");
  const [rssUser, setRssUser] = useState(lib.letterboxdUser || "");
  const [rssBusy, setRssBusy] = useState(false);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const ratedCount = data.seen.filter((x) => x.r != null).length;
  const diaryCount = (lib.diary || []).length;

  const handleWatchFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseFilmImport(text);
    if (!parsed.length) {
      setNotice("Nessun film trovato nel file caricato.");
      return;
    }
    onImportWatchlist(parsed.map((x) => ({ t: x.t, y: x.y })));
    setNotice(
      data.custom
        ? `Watchlist aggiornata: ${parsed.length} film importati.`
        : `Profilo personale avviato con la tua watchlist (${parsed.length} film). I dati precaricati sono stati rimossi.`
    );
    e.target.value = "";
  };

  const handleSeenFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let combinedSeen: SeenFilmItem[] = data.custom ? [...data.seen] : [];
    let combinedDiary: DiaryEntry[] = data.custom ? [...(lib.diary || [])] : [];
    let importedTotal = 0;
    let diaryImportedCount = 0;

    for (const file of files) {
      const text = await file.text();
      if (isDiaryCSV(text)) {
        const diaryParsed = parseDiaryCSV(text);
        if (diaryParsed.length > 0) {
          diaryImportedCount += diaryParsed.length;
          importedTotal += diaryParsed.length;
          combinedDiary = mergeDiaryEntries(combinedDiary, diaryParsed);
          combinedSeen = mergeSeenImports(
            combinedSeen,
            diaryToSeenItems(diaryParsed)
          );
          continue;
        }
      }
      const parsed = parseFilmImport(text);
      if (parsed.length > 0) {
        importedTotal += parsed.length;
        combinedSeen = mergeSeenImports(combinedSeen, parsed);
      }
    }

    if (!importedTotal) {
      setNotice("Nessun film trovato nei file caricati.");
      return;
    }

    onImportSeen(combinedSeen, diaryImportedCount > 0 ? combinedDiary : undefined);
    const ratedAfter = combinedSeen.filter((x) => x.r != null).length;
    const diaryNote =
      diaryImportedCount > 0
        ? ` e ${combinedDiary.length} visioni nel Diario`
        : "";
    setNotice(
      data.custom
        ? `Lista visti aggiornata: ${combinedSeen.length} film totali (${ratedAfter} con voto)${diaryNote}.`
        : `Profilo personale avviato con ${combinedSeen.length} film visti (${ratedAfter} con voto)${diaryNote}. I dati precaricati sono stati rimossi.`
    );
    e.target.value = "";
  };

  const handleRssSync = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = rssUser.trim().replace(/^@/, "");
    if (!clean || rssBusy) return;
    setRssBusy(true);
    setNotice("");
    try {
      const res = await onSyncDiaryRss(clean);
      setNotice(
        `Sync RSS completato per @${clean}: ${res.total} log recenti letti (${res.added} nuove visioni aggiunte al Diario).`
      );
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : "Impossibile sincronizzare il feed RSS di Letterboxd."
      );
    } finally {
      setRssBusy(false);
    }
  };

  const handleExport = () => {
    const payload = {
      v: 1,
      L: lib,
      D: { custom: data.custom, watch: data.watch, seen: data.seen },
    };
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `filmbroxd-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Backup esportato.");
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !parsed.L) {
        throw new Error("file di backup non valido");
      }
      onImportBackup(parsed);
      setNotice("Backup importato con successo.");
    } catch (err) {
      setNotice(
        `Importazione non riuscita: ${
          err instanceof Error ? err.message : "errore sconosciuto"
        }`
      );
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#131722]">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Watchlist e visti
            </h2>
            <p className="mt-1 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              Watchlist: {data.watch.length} film
              {(lib.add || []).length > 0 ? ` (+${lib.add!.length} aggiunti)` : ""} · Visti:{" "}
              {data.seen.length} ({ratedCount} con voto)
              {diaryCount > 0 ? ` · Diario: ${diaryCount} log` : ""}
            </p>
          </div>
          <span className="font-mono text-xs font-medium text-[#2563EB] dark:text-[#60A5FA]">
            {data.custom ? "Libreria personale attiva" : "Libreria precaricata"}
          </span>
        </div>

        <div className="mb-5 rounded-xl border border-slate-200/80 bg-[#F5F7FA] p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-[#0B0E14] dark:text-slate-400">
          {!data.custom ? (
            <p>
              Stai visualizzando la libreria precaricata. Se vuoi usare i tuoi dati Letterboxd, carica i tuoi CSV qui sotto (i dati precaricati e il profilo gusti verranno sostituiti automaticamente) oppure svuota tutto prima di iniziare.
            </p>
          ) : (
            <p>
              Stai usando la tua libreria personale salvata in questo browser. Puoi caricare contemporaneamente <span className="font-mono text-slate-800 dark:text-slate-200">watched.csv</span>, <span className="font-mono text-slate-800 dark:text-slate-200">ratings.csv</span> e <span className="font-mono text-slate-800 dark:text-slate-200">diary.csv</span> per unire film visti, voti e calendario delle visioni.
            </p>
          )}
          <p className="mt-1.5 text-slate-500 dark:text-slate-400">
            Su Letterboxd: <span className="font-medium text-slate-700 dark:text-slate-300">Settings → Import &amp; Export → Export Your Data</span>.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="fw-upload"
              className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              1. Watchlist (`watchlist.csv` o un titolo per riga)
            </label>
            <input
              id="fw-upload"
              type="file"
              accept=".csv,.txt"
              onChange={handleWatchFile}
              className="w-full rounded-xl border border-slate-200 bg-[#F5F7FA] px-3 py-2.5 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200/70 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-200 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
            />
          </div>

          <div>
            <label
              htmlFor="fs-upload"
              className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              2. Visti, voti e diario (`watched.csv`, `ratings.csv`, `diary.csv`)
            </label>
            <input
              id="fs-upload"
              type="file"
              multiple
              accept=".csv,.txt"
              onChange={handleSeenFiles}
              className="w-full rounded-xl border border-slate-200 bg-[#F5F7FA] px-3 py-2.5 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200/70 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-200 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
            />
          </div>
        </div>

        <form
          onSubmit={handleRssSync}
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-[#F5F7FA] p-4 dark:border-slate-800 dark:bg-[#0B0E14]"
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Sync rapido Diario via RSS Letterboxd
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Aggiorna gli ultimi log (data, voto, rewatch e locandina) dal profilo pubblico senza riesportare lo zip.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={rssUser}
              onChange={(e) => setRssUser(e.target.value)}
              placeholder="username Letterboxd"
              aria-label="Username Letterboxd"
              className="w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none dark:border-slate-700 dark:bg-[#131722] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={rssBusy || !rssUser.trim()}
              className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 whitespace-nowrap shrink-0 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
            >
              {rssBusy ? "Sincronizzo…" : "Sincronizza RSS"}
            </button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              onClearToEmptyUser();
              setNotice(
                "Libreria svuotata: ora puoi caricare i tuoi CSV di Letterboxd da zero."
              );
            }}
            className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Svuota tutto (riparti da zero)
          </button>

          {data.custom && (
            <button
              type="button"
              onClick={() => {
                onResetOriginal();
                setNotice("Libreria precaricata ripristinata.");
              }}
              className="rounded-lg border border-slate-200 bg-transparent px-4 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 whitespace-nowrap shrink-0 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Ripristina libreria precaricata
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#131722]">
        <div className="mb-3 border-b border-slate-200/80 pb-3 dark:border-slate-800">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Backup locale
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            I tuoi voti, la cronologia e le preferenze restano salvati in questo browser. Esporta un file JSON per conservarli o trasferirli.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] whitespace-nowrap shrink-0 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
          >
            Esporta backup
          </button>
          <button
            type="button"
            onClick={() => backupInputRef.current?.click()}
            className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Importa backup
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportBackup}
            className="hidden"
          />
        </div>

        {notice && (
          <p className="mt-4 text-xs font-medium text-slate-700 dark:text-slate-300">
            {notice}
          </p>
        )}
      </section>
    </div>
  );
};
