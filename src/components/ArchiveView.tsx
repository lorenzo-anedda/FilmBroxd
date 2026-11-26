import React, { useRef, useState } from "react";
import { parseFilmImport } from "../utils/filmLogic";
import type {
  FilmItem,
  LibraryState,
  SeenFilmItem,
  WatchlistDataState,
} from "../types";

interface ArchiveViewProps {
  data: WatchlistDataState;
  lib: LibraryState;
  onImportWatchlist: (films: FilmItem[]) => void;
  onImportSeen: (films: SeenFilmItem[]) => void;
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
  onResetOriginal,
  onImportBackup,
}) => {
  const [notice, setNotice] = useState("");
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const ratedCount = data.seen.filter((x) => x.r != null).length;

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
    setNotice(`Watchlist aggiornata: ${parsed.length} film importati.`);
  };

  const handleSeenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseFilmImport(text);
    if (!parsed.length) {
      setNotice("Nessun film trovato nel file caricato.");
      return;
    }
    onImportSeen(parsed);
    setNotice(`Lista visti aggiornata: ${parsed.length} film importati.`);
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
        <div className="mb-4 border-b border-slate-200/80 pb-3 dark:border-slate-800">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Watchlist e visti
          </h2>
          <p className="mt-1 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            Watchlist: {data.watch.length} film
            {(lib.add || []).length > 0 ? ` (+${lib.add!.length} aggiunti)` : ""} · Visti:{" "}
            {data.seen.length} ({ratedCount} con voto)
          </p>
        </div>

        <p className="mb-5 text-sm text-slate-600 dark:text-slate-400">
          I dati del tuo export Letterboxd sono già precaricati. Carica nuovi file CSV o TXT solo se vuoi aggiornarli.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="fw-upload"
              className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Watchlist (CSV Letterboxd o un titolo per riga)
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
              Film visti con voto (CSV Name/Year/Rating o «Titolo, voto»)
            </label>
            <input
              id="fs-upload"
              type="file"
              accept=".csv,.txt"
              onChange={handleSeenFile}
              className="w-full rounded-xl border border-slate-200 bg-[#F5F7FA] px-3 py-2.5 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200/70 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-200 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              onResetOriginal();
              setNotice("Dati originali Letterboxd ripristinati.");
            }}
            className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Ripristina dati originali
          </button>
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
