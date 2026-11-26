import React, { useMemo, useState } from "react";
import {
  canonicalLabel,
  filmKey,
  getAllSeen,
  nz,
  parseJsonSafely,
} from "../utils/filmLogic";
import { formatAIError, generateWithAI } from "../utils/aiClient";
import type { FilmItem, FilmMeta, LibraryState, SeenFilmItem } from "../types";

interface ProfileViewProps {
  watch: FilmItem[];
  seen: SeenFilmItem[];
  lib: LibraryState;
  aiAvailable: boolean;
  onUpdateProfile: (profile: string) => void;
  onMergeMeta: (updates: Record<string, FilmMeta>) => void;
  onClearWhy: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  watch,
  seen,
  lib,
  aiAvailable,
  onUpdateProfile,
  onMergeMeta,
  onClearWhy,
}) => {
  const [busyProfile, setBusyProfile] = useState(false);
  const [busyEnrich, setBusyEnrich] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const fullWatch = useMemo(
    () => watch.concat(lib.add || []),
    [watch, lib.add]
  );

  const enrichedCount = useMemo(
    () =>
      fullWatch.filter((x) => {
        const m = lib.meta[filmKey(x)];
        return m && (nz(m.g) || m.m > 0 || nz(m.d));
      }).length,
    [fullWatch, lib.meta]
  );

  const missingList = useMemo(
    () => fullWatch.filter((x) => !lib.meta[filmKey(x)]),
    [fullWatch, lib.meta]
  );

  const handleGenerateProfile = async () => {
    const allSeen = getAllSeen(seen, lib.marks);
    const rated = allSeen
      .filter((x) => x.r != null)
      .sort((a, b) => (b.r || 0) - (a.r || 0));
    if (!rated.length) {
      setStatusMsg("Servono film con voto per analizzare i tuoi gusti.");
      return;
    }

    setBusyProfile(true);
    setStatusMsg("Sto analizzando i tuoi voti…");
    try {
      const f = (x: SeenFilmItem) =>
        `${canonicalLabel(x)} [${x.r}]${x.rw ? " (rivisto)" : ""}`;
      const sc =
        Math.max(...rated.map((x) => x.r || 0)) <= 5 ? "stelle 0.5-5" : "1-10";
      const prompt = `Analizza i gusti cinematografici di una persona dai suoi voti (scala ${sc}, ${rated.length} film votati).
PIÙ AMATI: ${rated.slice(0, 120).map(f).join("; ")}
MENO AMATI: ${rated.slice(-40).map(f).join("; ")}
Scrivi in italiano un profilo di massimo 150 parole: generi, toni, registi, epoche e paesi ricorrenti, cosa ama, cosa tollera poco, tolleranza per film lenti o difficili. Solo il profilo, senza titoli o preamboli.`;

      const text = await generateWithAI(prompt);
      onUpdateProfile(text.trim());
      setStatusMsg("Profilo aggiornato. Puoi modificarlo manualmente qui sopra.");
    } catch (err) {
      setStatusMsg(formatAIError(err));
    } finally {
      setBusyProfile(false);
    }
  };

  const handleEnrichList = async () => {
    if (!missingList.length) {
      setStatusMsg("Lista già arricchita.");
      return;
    }
    setBusyEnrich(true);
    setStatusMsg("");
    let done = 0;

    try {
      for (let i = 0; i < missingList.length; i += 60) {
        const batch = missingList.slice(i, i + 60);
        setStatusMsg(
          `Arricchisco… ${enrichedCount + done}/${fullWatch.length} film`
        );
        const prompt =
          `Per ciascun film dai: genere (max 2, in italiano, separati da /), durata in minuti (intero, oppure null se non sei sicuro), regista, paese. Se non conosci il film con certezza usa null: non inventare.\nRispondi SOLO con un array JSON: [{"i":0,"g":"...","m":100,"d":"...","c":"..."}]\n\n` +
          batch.map((x, j) => `${j}. ${canonicalLabel(x)}`).join("\n");

        const raw = await generateWithAI(prompt, {
          jsonMode: "array",
          fast: true,
        });
        const arr = parseJsonSafely<
          Array<{ i: number; g?: string; m?: number; d?: string; c?: string }>
        >(raw, "[");
        const updates: Record<string, FilmMeta> = {};
        for (const o of arr) {
          const x = batch[o.i];
          if (x) {
            updates[filmKey(x)] = {
              g: o.g && o.g !== "null" ? o.g : "",
              m: Number(o.m) || 0,
              d: o.d && o.d !== "null" ? o.d : "",
              c: o.c && o.c !== "null" ? o.c : "",
            };
          }
        }
        for (const x of batch) {
          const k = filmKey(x);
          if (!updates[k]) updates[k] = { g: "", m: 0, d: "", c: "" };
        }
        onMergeMeta(updates);
        done += batch.length;
      }
      setStatusMsg("Fatto: lista arricchita.");
    } catch (err) {
      setStatusMsg(
        `${formatAIError(err)} (${enrichedCount + done}/${fullWatch.length} completati, puoi riprendere)`
      );
    } finally {
      setBusyEnrich(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#131722]">
        <div className="mb-4 border-b border-slate-200/80 pb-3 dark:border-slate-800">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Profilo gusti e metadati
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Il profilo guida ogni consiglio. Puoi modificarlo liberamente a mano o rigenerarlo dai tuoi voti.
          </p>
        </div>

        <label
          htmlFor="profile-editor"
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          Il tuo profilo cinematografico
        </label>
        <textarea
          id="profile-editor"
          rows={8}
          value={lib.profile}
          onChange={(e) => onUpdateProfile(e.target.value)}
          placeholder="Premi «Rigenera profilo dai voti» per far analizzare i tuoi film votati."
          className="w-full rounded-xl border border-slate-200 bg-[#F5F7FA] p-3.5 text-sm leading-relaxed text-slate-900 focus:border-[#2563EB] focus:outline-none dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-100 dark:focus:border-[#3B82F6]"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!aiAvailable || busyProfile || busyEnrich}
            onClick={handleGenerateProfile}
            className="rounded-lg bg-[#2563EB] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 whitespace-nowrap shrink-0 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
          >
            {busyProfile ? "Analizzo i voti…" : "Rigenera profilo dai voti"}
          </button>

          <button
            type="button"
            disabled={!aiAvailable || busyEnrich || busyProfile || missingList.length === 0}
            onClick={handleEnrichList}
            className="rounded-lg border border-slate-200 bg-[#F5F7FA] px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {busyEnrich
              ? "Arricchimento in corso…"
              : missingList.length === 0
              ? "Watchlist già arricchita"
              : `Arricchisci lista (${missingList.length} mancanti)`}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono tabular-nums">
            Copertura metadati: {enrichedCount}/{fullWatch.length} film con genere, durata e regista
          </span>
          {statusMsg && (
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {statusMsg}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-[#131722]">
        <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-slate-200/80 pb-3 dark:border-slate-800">
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Motivi degli scarti recenti
          </h3>
          {(lib.why || []).length > 0 && (
            <button
              type="button"
              onClick={onClearWhy}
              className="text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
            >
              Azzera annotazioni
            </button>
          )}
        </div>

        {!(lib.why || []).length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nessun motivo annotato finora. Quando scarti o rimandi un film puoi indicare il motivo per affinare le proposte successive.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200/70 text-sm dark:divide-slate-800">
            {(lib.why || [])
              .slice(-15)
              .reverse()
              .map((item) => (
                <li
                  key={`${item.k}-${item.ts}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {item.t} {item.y ? `(${item.y})` : ""}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {item.w}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
};
