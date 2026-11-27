import React, { useRef, useState } from "react";
import { mergeSeenImports, parseFilmImport } from "../utils/filmLogic";
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
  onClearToEmptyUser,
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

    let combined: SeenFilmItem[] = data.custom ? [...data.seen] : [];
    let importedTotal = 0;

    for (const file of files) {
      const text = await file.text();
      const parsed = parseFilmImport(text);
      if (parsed.length > 0) {
        importedTotal += parsed.length;
        combined = mergeSeenImports(combined, parsed);
      }
    }

    if (!importedTotal) {
      setNotice("Nessun film trovato nei file caricati.");
      return;
    }

    onImportSeen(combined);
    const ratedAfter = combined.filter((x) => x.r != null).length;
    setNotice(
      data.custom
        ? `Lista visti aggiornata: ${combined.length} film totali (${ratedAfter} con voto).`
        : `Profilo personale avviato con ${combined.length} film visti (${ratedAfter} con voto). I dati precaricati sono stati rimossi.`
    );
    e.target.value = "";
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
            </p>
          </div>
          <span className="font-mono text-xs font-medium text-[#2563EB] dark:text-[#60A5FA]">
            {data.custom ? "Libreria personale attiva" : "Libreria precaricata"}
          </span>
        </div>

        <div className="mb-5 rounded-xl border border-slate-200/80 bg-[#F5F7FA] p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-[#0B0E14] dark:text-slate-400">
          {!data.custom ? (
            <p>
              Stai visualizzando la libreria precaricata. Se vuoi usare i tuoi dati Letterboxd, carica i tuoi CSV qui sotto (i dati precaricati e il profilo gusti verranno sostituiti automaticamente in automatico) oppure svuota tutto prima di iniziare.
            </p>
          ) : (
            <p>
              Stai usando la tua libreria personale salvata in questo browser. Puoi caricare contemporaneamente <span className="font-mono text-slate-800 dark:text-slate-200">watched.csv</span> e <span className="font-mono text-slate-800 dark:text-slate-200">ratings.csv</span> esportati da Letterboxd per unire automaticamente film visti e voti.
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
              2. Film visti e voti (`watched.csv` e/o `ratings.csv`, anche insieme)
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
