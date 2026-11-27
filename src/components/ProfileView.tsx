import React, { useMemo, useRef, useState } from "react";
import {
  canonicalLabel,
  filmKey,
  getAllSeen,
  normTitle,
  nz,
  parseJsonSafely,
} from "../utils/filmLogic";
import { computeProfileStats, isAnimationFilm } from "../utils/profileStats";
import { formatAIError, generateWithAI } from "../utils/aiClient";
import { ProfileStats } from "./ProfileStats";
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

function cleanPeopleValue(val: unknown): string {
  if (Array.isArray(val)) {
    return val
      .map((item) => String(item || "").trim())
      .filter((item) => item.length > 1 && item.toLowerCase() !== "null")
      .slice(0, 3)
      .join(" / ");
  }
  const s = String(val || "").trim();
  if (!s || s.toLowerCase() === "null") return "";
  return s
    .split(/[\/,]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1 && p.toLowerCase() !== "null")
    .slice(0, 3)
    .join(" / ");
}

function resolveBatchFilm<T extends FilmItem>(
  batch: T[],
  item: { i?: unknown; t?: unknown; title?: unknown; film?: unknown },
  claimedIndices: Set<number>
): { film: T; idx: number } | null {
  const numIdx = Number(item.i);
  if (
    Number.isInteger(numIdx) &&
    numIdx >= 0 &&
    numIdx < batch.length &&
    !claimedIndices.has(numIdx)
  ) {
    claimedIndices.add(numIdx);
    return { film: batch[numIdx], idx: numIdx };
  }

  const rawTitle = String(item.t ?? item.title ?? item.film ?? "").trim();
  if (rawTitle) {
    const target = normTitle(rawTitle.replace(/\s*\(\d{4}\)\s*$/, ""));
    const foundIdx = batch.findIndex(
      (f, idx) => !claimedIndices.has(idx) && normTitle(f.t) === target
    );
    if (foundIdx >= 0) {
      claimedIndices.add(foundIdx);
      return { film: batch[foundIdx], idx: foundIdx };
    }
  }

  return null;
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
  const [busyPeople, setBusyPeople] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [peopleProgress, setPeopleProgress] = useState("");
  const stopPeopleRef = useRef(false);

  const allSeen = useMemo(
    () => getAllSeen(seen, lib.marks),
    [seen, lib.marks]
  );

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
    () =>
      fullWatch.filter((x) => {
        const m = lib.meta[filmKey(x)];
        return !m || (!nz(m.g) && !(m.m > 0) && !nz(m.d) && !m.mc);
      }),
    [fullWatch, lib.meta]
  );

  const handleGenerateProfile = async () => {
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
    const metaSnapshot: Record<string, FilmMeta> = { ...lib.meta };

    const processMetaBatch = async (batch: FilmItem[], fastMode: boolean) => {
      const prompt =
        `Per ciascun film dai: genere (max 2, in italiano, separati da /), durata in minuti (intero, oppure null se non sei sicuro), regista, paese. Se non conosci il film con certezza usa null: non inventare.\nRispondi SOLO con un array JSON valido contenente ESATTAMENTE un oggetto per ogni indice da 0 a ${batch.length - 1}: [{"i":0,"g":"...","m":100,"d":"...","c":"..."}]\n\n` +
        batch.map((x, j) => `${j}. ${canonicalLabel(x)}`).join("\n");

      const raw = await generateWithAI(prompt, {
        jsonMode: "array",
        fast: fastMode,
      });
      const arr = parseJsonSafely<
        Array<{
          i?: unknown;
          t?: unknown;
          title?: unknown;
          g?: string;
          m?: number;
          d?: string;
          c?: string;
        }>
      >(raw, "[");

      const claimed = new Set<number>();
      const updates: Record<string, FilmMeta> = {};

      for (const o of arr) {
        const resolved = resolveBatchFilm(batch, o, claimed);
        if (!resolved) continue;
        const k = filmKey(resolved.film);
        const prev = metaSnapshot[k];
        const nextMeta: FilmMeta = {
          g: o.g && o.g !== "null" ? o.g : prev?.g || "",
          m: Number(o.m) || prev?.m || 0,
          d: o.d && o.d !== "null" ? o.d : prev?.d || "",
          c: o.c && o.c !== "null" ? o.c : prev?.c || "",
          ...(prev?.a ? { a: prev.a } : {}),
          ...(prev?.pc ? { pc: true } : {}),
        };
        if (!nz(nextMeta.g) && !(nextMeta.m > 0) && !nz(nextMeta.d)) {
          nextMeta.mc = true;
        }
        updates[k] = nextMeta;
        metaSnapshot[k] = nextMeta;
      }

      const omitted = batch.filter((_, idx) => !claimed.has(idx));
      return { updates, omitted };
    };

    try {
      for (let i = 0; i < missingList.length; i += 45) {
        const batch = missingList.slice(i, i + 45);
        setStatusMsg(
          `Arricchisco… ${enrichedCount + done}/${fullWatch.length} film`
        );

        const firstPass = await processMetaBatch(batch, batch.length > 20);
        const combinedUpdates: Record<string, FilmMeta> = {
          ...firstPass.updates,
        };

        if (firstPass.omitted.length > 0) {
          for (let r = 0; r < firstPass.omitted.length; r += 15) {
            const sub = firstPass.omitted.slice(r, r + 15);
            const retryPass = await processMetaBatch(sub, false);
            Object.assign(combinedUpdates, retryPass.updates);
            for (const x of retryPass.omitted) {
              const k = filmKey(x);
              const prev = metaSnapshot[k];
              const marked: FilmMeta = {
                g: prev?.g || "",
                m: prev?.m || 0,
                d: prev?.d || "",
                c: prev?.c || "",
                ...(prev?.a ? { a: prev.a } : {}),
                ...(prev?.pc ? { pc: true } : {}),
                mc: true,
              };
              combinedUpdates[k] = marked;
              metaSnapshot[k] = marked;
            }
          }
        }

        if (Object.keys(combinedUpdates).length > 0) {
          onMergeMeta(combinedUpdates);
        }
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

  const runEnrichSeenPeople = async (
    overrideQueue?: SeenFilmItem[],
    options?: { forceOverwrite?: boolean }
  ) => {
    const forceOverwrite = Boolean(options?.forceOverwrite);
    const queue =
      overrideQueue ?? computeProfileStats(allSeen, lib.meta).missingPeopleFilms;
    if (!queue.length) {
      setPeopleProgress("Tutti i film visti sono già stati verificati.");
      return;
    }

    stopPeopleRef.current = false;
    setBusyPeople(true);
    let processed = 0;
    let enrichedNow = 0;
    let excludedAnimOrNoCast = 0;
    const metaSnapshot: Record<string, FilmMeta> = { ...lib.meta };

    const processPeopleBatch = async (batch: SeenFilmItem[]) => {
      const prompt =
        `Verifica OGNI film singolarmente. Per ciascuno indica:
- "g": genere principale in italiano (max 2 separati da /, es. "Animazione / Avventura", "Commedia", "Drammatico")
- "d": regista originale
- "a": fino a 3 ATTORI REALI IN CARNE E OSSA separati da " / ".
REGOLE RIGOROSE:
1) Per film d'animazione, anime o corti animati NON inserire mai doppiatori o voci: metti OBBLIGATORIAMENTE "a": null (indica però sempre "g" e "d").
2) Per documentari senza attori metti "a": null.
3) NON copiare né ripetere mai lo stesso regista o gli stessi attori su altri titoli della lista: se non conosci con certezza assoluta il film, metti null.

Rispondi SOLO con un array JSON valido contenente ESATTAMENTE un oggetto per ogni indice da 0 a ${batch.length - 1}: [{"i":0,"g":"...","d":"Regista","a":"Attore 1 / Attore 2 / Attore 3"}]\n\n` +
        batch.map((x, j) => `${j}. ${canonicalLabel(x)}`).join("\n");

      // Use ThinkingLevel.MEDIUM (fast: false) and smaller batches (25) to prevent cross-film hallucinations
      const raw = await generateWithAI(prompt, {
        jsonMode: "array",
        fast: false,
      });

      const arr = parseJsonSafely<
        Array<{
          i?: unknown;
          t?: unknown;
          title?: unknown;
          g?: unknown;
          d?: unknown;
          a?: unknown;
        }>
      >(raw, "[");

      const claimed = new Set<number>();
      const updates: Record<string, FilmMeta> = {};

      for (const o of arr) {
        const resolved = resolveBatchFilm(batch, o, claimed);
        if (!resolved) continue;
        const film = resolved.film;
        const k = filmKey(film);
        const prev = metaSnapshot[k] || { g: "", m: 0, d: "", c: "" };

        const rawGenre = String(o.g || "").trim();
        const genre =
          rawGenre && rawGenre.toLowerCase() !== "null"
            ? rawGenre
            : prev.g || "";

        const dir =
          !forceOverwrite && nz(prev.d) ? prev.d : cleanPeopleValue(o.d);

        const isAnim = /animazion|animat|anime|cartoon/i.test(genre);
        const act = isAnim
          ? ""
          : !forceOverwrite && nz(prev.a)
          ? prev.a || ""
          : cleanPeopleValue(o.a);

        const nextMeta: FilmMeta = {
          g: genre,
          m: prev.m || 0,
          d: dir,
          c: prev.c || "",
          ...(act ? { a: act } : {}),
          ...(prev.mc ? { mc: true } : {}),
        };

        if (dir && (act || isAnim)) {
          delete nextMeta.pc;
        }

        updates[k] = nextMeta;
        metaSnapshot[k] = nextMeta;
      }

      const omitted = batch.filter((_, idx) => !claimed.has(idx));
      return { updates, omitted };
    };

    try {
      for (let i = 0; i < queue.length; i += 25) {
        if (stopPeopleRef.current) {
          setPeopleProgress(
            `Analisi in pausa (${processed}/${queue.length} elaborati in questa sessione). Puoi riprendere quando vuoi.`
          );
          break;
        }

        const batch = queue.slice(i, i + 25);
        setPeopleProgress(
          `Analizzo registi e attori reali… ${processed}/${queue.length} film`
        );

        const firstPass = await processPeopleBatch(batch);
        const combinedUpdates: Record<string, FilmMeta> = {
          ...firstPass.updates,
        };

        if (firstPass.omitted.length > 0 && !stopPeopleRef.current) {
          setPeopleProgress(
            `Riprovo ${firstPass.omitted.length} titoli saltati… (${processed}/${queue.length})`
          );
          for (let r = 0; r < firstPass.omitted.length; r += 12) {
            const sub = firstPass.omitted.slice(r, r + 12);
            const retryPass = await processPeopleBatch(sub);
            Object.assign(combinedUpdates, retryPass.updates);
          }
        }

        for (const f of batch) {
          const k = filmKey(f);
          const cur = combinedUpdates[k] || metaSnapshot[k];
          const anim = isAnimationFilm(cur);
          if (!cur || !nz(cur.d) || (!anim && !nz(cur.a))) {
            const finalized: FilmMeta = {
              g: cur?.g || "",
              m: cur?.m || 0,
              d: cur?.d || "",
              c: cur?.c || "",
              ...(cur?.a && !anim ? { a: cur.a } : {}),
              ...(cur?.mc ? { mc: true } : {}),
              pc: true,
            };
            combinedUpdates[k] = finalized;
            metaSnapshot[k] = finalized;
            excludedAnimOrNoCast += 1;
          } else {
            if (anim && !nz(cur.a)) excludedAnimOrNoCast += 1;
            else enrichedNow += 1;
          }
        }

        if (Object.keys(combinedUpdates).length > 0) {
          onMergeMeta(combinedUpdates);
        }

        processed += batch.length;
      }

      if (!stopPeopleRef.current) {
        setPeopleProgress(
          excludedAnimOrNoCast > 0
            ? `Completato: ${enrichedNow} film con regista e attori reali, ${excludedAnimOrNoCast} film animati/senza cast esclusi dagli attori.`
            : `Completato: elaborati e aggiornati tutti i ${processed} film visti.`
        );
      }
    } catch (err) {
      setPeopleProgress(
        `${formatAIError(err)} (${processed}/${queue.length} elaborati finora, puoi riprendere)`
      );
    } finally {
      setBusyPeople(false);
    }
  };

  const handleEnrichSeenPeople = () => {
    void runEnrichSeenPeople();
  };

  const handleRetryCheckedPeople = () => {
    const toRetry: SeenFilmItem[] = [];
    const clearedUpdates: Record<string, FilmMeta> = {};
    for (const film of allSeen) {
      const k = filmKey(film);
      const m = lib.meta[k];
      if (m?.pc) {
        const next = { ...m };
        delete next.pc;
        clearedUpdates[k] = next;
        toRetry.push(film);
      }
    }
    if (Object.keys(clearedUpdates).length > 0) {
      onMergeMeta(clearedUpdates);
    }
    if (toRetry.length > 0) {
      void runEnrichSeenPeople(toRetry, { forceOverwrite: true });
    }
  };

  const handleReenrichFilms = (films: SeenFilmItem[]) => {
    if (!films.length || busyPeople) return;
    void runEnrichSeenPeople(films, { forceOverwrite: true });
  };

  const handleResetAndReenrichPeople = () => {
    if (busyPeople) return;
    const seenKeys = new Set(allSeen.map((f) => filmKey(f)));
    const clearedUpdates: Record<string, FilmMeta> = {};
    for (const k of seenKeys) {
      const m = lib.meta[k];
      if (m && (m.a || m.pc)) {
        const next: FilmMeta = { ...m };
        delete next.a;
        delete next.pc;
        clearedUpdates[k] = next;
      }
    }
    if (Object.keys(clearedUpdates).length > 0) {
      onMergeMeta(clearedUpdates);
    }
    const orderedQueue = [...allSeen].sort(
      (a, b) =>
        (b.r ?? 0) - (a.r ?? 0) || (Number(b.y) || 0) - (Number(a.y) || 0)
    );
    void runEnrichSeenPeople(orderedQueue, { forceOverwrite: true });
  };

  const handleStopEnrichPeople = () => {
    stopPeopleRef.current = true;
    setPeopleProgress("Arresto al termine del blocco corrente…");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <ProfileStats
        allSeen={allSeen}
        meta={lib.meta}
        diary={lib.diary}
        aiAvailable={aiAvailable}
        busyPeople={busyPeople}
        peopleProgress={peopleProgress}
        onEnrichPeople={handleEnrichSeenPeople}
        onStopEnrichPeople={handleStopEnrichPeople}
        onRetryCheckedPeople={handleRetryCheckedPeople}
        onReenrichFilms={handleReenrichFilms}
        onResetAndReenrichPeople={handleResetAndReenrichPeople}
      />

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
