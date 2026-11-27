import React, { useEffect, useMemo, useState } from "react";
import { TITLE_RULES } from "./constants/filters";
import {
  canonicalLabel,
  countUnknownMetadata,
  displayLabel,
  filmKey,
  getAllSeen,
  itTitle,
  matchesDecade,
  normTitle,
  nz,
  parseFilmTitleString,
  passesFilters,
  upsertHistory,
} from "./utils/filmHelpers";
import {
  buildFilterSummary,
  buildRecentDiaryBlock,
  buildRecommendPrompt,
  buildRewatchPool,
  buildSeenList,
  buildTasteBlock,
  buildWhyBlock,
  localRecommend,
  rankedPool,
  shortlistPool,
} from "./utils/recommender";
import {
  buildFilmMatcher,
  diaryToSeenItems,
  filterNewDiaryEntries,
  mergeDiaryEntries,
  mergeSeenImports,
  parseJsonSafely,
} from "./utils/parsers";
import { enrichNewFilmsWithAI } from "./utils/peopleEnrich";
import {
  loadInitialDataState,
  loadInitialLibraryState,
  persistDataState,
  persistLibraryState,
} from "./utils/storage";
import { OUTCOMES } from "./constants/filters";
import {
  checkAIHealth,
  formatAIError,
  generateWithAI,
  syncLetterboxdDiary,
} from "./utils/aiClient";
import { useFilmPreviews } from "./hooks/useFilmPreviews";
import { HeaderBar } from "./components/HeaderBar";
import {
  EveningControls,
  type EveningPreset,
} from "./components/EveningControls";
import { RecommendationsStage } from "./components/RecommendationsStage";
import { FilmPreviewModal } from "./components/FilmPreviewModal";
import { CineSfidaView } from "./components/CineSfidaView";
import { HistoryView } from "./components/HistoryView";
import { ProfileView } from "./components/ProfileView";
import { ArchiveView } from "./components/ArchiveView";
import type {
  ActivePick,
  ActiveTab,
  DiaryEntry,
  EngineMode,
  FilmItem,
  FilmMeta,
  HistoryEntry,
  LibraryState,
  OutcomeKey,
  RawRecommendation,
  RiskMode,
  RssSyncResult,
  SeenFilmItem,
  WatchlistDataState,
} from "./types";

const THEME_KEY = "fb_theme";

function getInitialDark(): boolean {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark") return true;
    if (saved === "light") return false;
  } catch {
    // ignore
  }
  return true;
}

export default function App() {
  const [dark, setDark] = useState<boolean>(getInitialDark);
  const [tab, setTab] = useState<ActiveTab>("serata");

  const [data, setData] = useState<WatchlistDataState>(loadInitialDataState);
  const [lib, setLib] = useState<LibraryState>(loadInitialLibraryState);

  const [aiAvailable, setAiAvailable] = useState<boolean>(true);
  const [engineMode, setEngineMode] = useState<EngineMode>("ai");
  const [rewatchMode, setRewatchMode] = useState<boolean>(false);

  // Evening controls
  const [selectedMoods, setSelectedMoods] = useState<Set<string>>(() => new Set());
  const [risk, setRisk] = useState<RiskMode>("");
  const [ctxText, setCtxText] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  // Filters
  const [durMin, setDurMin] = useState<number>(40);
  const [durMax, setDurMax] = useState<number>(210);
  const [genreSel, setGenreSel] = useState<Set<string>>(() => new Set());
  const [countrySel, setCountrySel] = useState<Set<string>>(() => new Set());
  const [decadeSel, setDecadeSel] = useState<Set<string>>(() => new Set());

  // Recommendations stage
  const [picks, setPicks] = useState<ActivePick[]>([]);
  const { previews, requestPreview } = useFilmPreviews(picks);
  const [previewPick, setPreviewPick] = useState<ActivePick | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [stageNotice, setStageNotice] = useState<string>("");
  const [stageError, setStageError] = useState<string>("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [dark]);

  useEffect(() => {
    checkAIHealth().then((ok) => {
      setAiAvailable(ok);
      if (!ok) setEngineMode("local");
    });
  }, []);

  const updateData = (updater: (prev: WatchlistDataState) => WatchlistDataState) => {
    setData((prev) => {
      const next = updater(prev);
      persistDataState(next);
      return next;
    });
  };

  const updateLib = (updater: (prev: LibraryState) => LibraryState) => {
    setLib((prev) => {
      const next = updater(prev);
      persistLibraryState(next);
      return next;
    });
  };

  const minMinutes = durMin <= 40 ? 0 : durMin;
  const maxMinutes = durMax >= 210 ? 0 : durMax;

  const filterConfig = useMemo(
    () => ({
      minMinutes,
      maxMinutes,
      genres: genreSel,
      countries: countrySel,
      decades: decadeSel,
    }),
    [minMinutes, maxMinutes, genreSel, countrySel, decadeSel]
  );

  const fullWatchlist = useMemo(
    () => data.watch.concat(lib.add || []),
    [data.watch, lib.add]
  );

  const filteredBase = useMemo(
    () => fullWatchlist.filter((x) => passesFilters(x, lib, filterConfig)),
    [fullWatchlist, lib, filterConfig]
  );

  const unknownMetaCount = useMemo(
    () => countUnknownMetadata(filteredBase, lib, filterConfig),
    [filteredBase, lib, filterConfig]
  );

  const activeFilterGroups =
    (minMinutes || maxMinutes ? 1 : 0) +
    (countrySel.size ? 1 : 0) +
    (decadeSel.size ? 1 : 0) +
    (genreSel.size ? 1 : 0);

  const durationLabel =
    minMinutes && maxMinutes
      ? `da ${minMinutes} a ${maxMinutes} min`
      : minMinutes
      ? `almeno ${minMinutes} min`
      : maxMinutes
      ? `fino a ${maxMinutes} min`
      : "qualsiasi";

  const allSeen = useMemo(
    () => getAllSeen(data.seen, lib.marks),
    [data.seen, lib.marks]
  );

  const rewatchPool = useMemo(
    () =>
      buildRewatchPool(allSeen, lib)
        .map((item) => item.film)
        .filter((x) => passesFilters(x, lib, filterConfig)),
    [allSeen, lib, filterConfig]
  );

  const tonightCount = useMemo(
    () => (lib.hist || []).filter((h) => h.o === "y").length,
    [lib.hist]
  );

  const pendingItems = useMemo(() => {
    const todayStr = new Date().toDateString();
    return (lib.hist || [])
      .filter(
        (h) =>
          h.o === "y" &&
          Date.now() - h.ts > 8 * 36e5 &&
          new Date(h.ts).toDateString() !== todayStr
      )
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 3);
  }, [lib.hist]);

  const knownCheck = useMemo(() => {
    const kT = new Set<string>();
    const kK = new Set<string>();
    const kN = new Set<string>();
    const addK = (t: string, y?: string) => {
      const n = normTitle(t);
      if (!n) return;
      kT.add(n);
      if (y) kK.add(`${n}|${y}`);
      else kN.add(n);
    };
    fullWatchlist
      .concat(allSeen, Object.values(lib.marks))
      .forEach((x) => {
        addK(x.t, x.y);
        const it = itTitle(x);
        if (it) addK(it, x.y);
      });
    (lib.hist || [])
      .filter((h) => h.o !== "x" && Date.now() - h.ts < 60 * 864e5)
      .forEach((h) => addK(h.t, h.y));

    return (x: FilmItem) => {
      const n = normTitle(x.t);
      if (!n) return false;
      if (kN.has(n)) return true;
      if (!x.y) return kT.has(n);
      const y = +x.y;
      return [y - 1, y, y + 1].some((v) => kK.has(`${n}|${v}`));
    };
  }, [fullWatchlist, allSeen, lib.marks, lib.hist]);

  const toggleSet = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const resetAllFilters = () => {
    setSelectedMoods(new Set());
    setGenreSel(new Set());
    setCountrySel(new Set());
    setDecadeSel(new Set());
    setRisk("");
    setDurMin(40);
    setDurMax(210);
    setCtxText("");
  };

  const handleSelectCompanion = (companion: string) => {
    const companions = ["Da solo", "In due", "Con amici"];
    setSelectedMoods((prev) => {
      const next = new Set(prev);
      const wasActive = next.has(companion);
      for (const c of companions) next.delete(c);
      if (!wasActive) next.add(companion);
      return next;
    });
  };

  const handleApplyPreset = (preset: EveningPreset) => {
    setSelectedMoods(new Set(preset.moods));
    setRisk(preset.risk);
    setDurMin(preset.durMin);
    setDurMax(preset.durMax);
  };

  const handleSurprisePick = () => {
    const pool = rewatchMode
      ? rewatchPool
      : filteredBase.length > 0
        ? filteredBase
        : fullWatchlist;
    if (!pool.length) {
      setStageError("Nessun film disponibile con questi filtri.");
      return;
    }
    const ranked = rankedPool(pool, allSeen, lib, selectedMoods, {
      ignoreRecentVariety: rewatchMode,
      selectedGenres: genreSel,
    });
    const topSlice = ranked.slice(0, Math.min(12, ranked.length));
    const chosen = topSlice[Math.floor(Math.random() * topSlice.length)]?.x;
    if (!chosen) return;
    const m = lib.meta[filmKey(chosen)];
    const pick = makePickObj(
      chosen,
      {
        film: canonicalLabel(chosen),
        durata: m?.m ? `${m.m} min` : "",
        regista: m?.d || "",
        perche: rewatchMode
          ? "Rewatch confortevole pescato tra i film che hai amato di più."
          : "Estratto tra i titoli della tua watchlist più in sintonia con i criteri di stasera.",
      },
      false
    );
    setStageError("");
    setStageNotice(
      rewatchMode
        ? "Rewatch a sorpresa pronto."
        : "Sorpresa dalla watchlist pronta."
    );
    setPicks([pick]);
    autoFetchMeta(chosen);
  };

  const makePickObj = (
    film: FilmItem,
    raw: RawRecommendation,
    extra: boolean
  ): ActivePick => {
    const mt = lib.meta[filmKey(film)];
    const dir = String(mt?.d || raw.regista || "").trim();
    const dur = mt?.m ? `${mt.m} min` : String(raw.durata || "");
    return {
      id: `${filmKey(film)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      film,
      extra,
      durata: dur,
      regista: dir,
      perche: raw.perche || "",
      status: "active",
    };
  };

  const autoFetchMeta = async (film: FilmItem) => {
    const existing = lib.meta[filmKey(film)];
    if (
      existing &&
      existing.m &&
      nz(existing.g) &&
      nz(existing.d) &&
      nz(existing.c)
    ) {
      return;
    }
    if (!aiAvailable) return;
    try {
      const prompt = `Dati del film ${canonicalLabel(film)}. Rispondi SOLO con un oggetto JSON: {"g":"genere, max 2, in italiano, separati da /","m":durata in minuti (numero intero),"d":"regista","c":"paese di produzione in italiano, separati da /","it":"titolo italiano ufficiale SOLO se il regista è italiano, altrimenti null"}. Se non sei sicuro di un campo metti null: non inventare.`;
      const raw = await generateWithAI(prompt, { jsonMode: "object", fast: true });
      const o = parseJsonSafely<{
        g?: string;
        m?: number;
        d?: string;
        c?: string;
        it?: string;
      }>(raw, "{");
      const ok = (v?: string) => (v && v !== "null" ? v : "");
      updateLib((prev) => {
        const k = filmKey(film);
        const cur = prev.meta[k];
        const nextAdd = (prev.add || []).map((item) => {
          if (filmKey(item) === k && ok(o.it) && ok(o.it).toLowerCase() !== item.t.toLowerCase()) {
            return { ...item, it: ok(o.it) };
          }
          return item;
        });
        return {
          ...prev,
          add: nextAdd,
          meta: {
            ...prev.meta,
            [k]: {
              g: ok(o.g) || cur?.g || "",
              m: Number(o.m) || cur?.m || 0,
              d: ok(o.d) || cur?.d || "",
              c: ok(o.c) || cur?.c || "",
            },
          },
        };
      });
    } catch {
      // silent background enrichment
    }
  };

  const handleRecommend = async () => {
    if (!rewatchMode && !data.watch.length) {
      setStageError("Carica prima la watchlist nella sezione Archivio.");
      return;
    }

    const pool = rewatchMode
      ? rewatchPool
      : fullWatchlist.filter(
          (x) =>
            passesFilters(x, lib, filterConfig) &&
            !data.shown.includes(canonicalLabel(x))
        );

    if (!pool.length) {
      setStageError(
        rewatchMode
          ? "Nessun film idoneo al rewatch trovato con questi filtri: prova ad allargarli o sincronizza i voti/diario."
          : "Nessun film in lista corrisponde a questi filtri (o li hai già visti tutti): prova ad allargare i filtri."
      );
      return;
    }

    setLoading(true);
    setStageError("");
    setStageNotice("");
    setPicks([]);

    const ctx =
      [...selectedMoods].join(", ") + (ctxText.trim() ? `. ${ctxText.trim()}` : "");
    const flt = buildFilterSummary(filterConfig);
    const duo = selectedMoods.has("In due") ? (lib.partner || "").trim() : "";
    const shownX = data.shownX || [];
    const discarded = Object.values(lib.marks)
      .filter((v) => v.s === "no")
      .slice(-40)
      .map(canonicalLabel)
      .join("; ");

    const watchlistLines = shortlistPool(pool, allSeen, lib, selectedMoods, 400)
      .map((x) => {
        const m = lib.meta[filmKey(x)];
        return (
          canonicalLabel(x) +
          (m && (m.g || m.m) ? ` | ${m.g || ""} | ${m.m || "?"} min | ${m.d || ""}` : "")
        );
      })
      .join("\n");

    let arr: RawRecommendation[] = [];
    let usedLocal = engineMode === "local" || !aiAvailable;
    let localFallbackReason = "";

    if (!usedLocal) {
      try {
        const prompt = buildRecommendPrompt({
          ctx,
          risk,
          filterSummary: flt,
          duo,
          profile: lib.profile,
          tasteBlock: buildTasteBlock(allSeen),
          discarded,
          whyBlock: buildWhyBlock(lib.why),
          recentDiaryBlock: buildRecentDiaryBlock(lib.diary, lib.meta),
          rewatchMode,
          shownExtra: shownX,
          seenList: buildSeenList(allSeen, 600),
          watchlistLines,
        });
        const text = await generateWithAI(prompt, { jsonMode: "array" });
        arr = parseJsonSafely<RawRecommendation[]>(text, "[");
      } catch (err) {
        usedLocal = true;
        localFallbackReason = formatAIError(err);
        arr = localRecommend(pool, allSeen, lib, selectedMoods, { rewatchMode });
      }
    } else {
      arr = localRecommend(pool, allSeen, lib, selectedMoods, { rewatchMode });
    }

    const lookupMap = new Map<string, FilmItem>();
    pool.forEach((x) => {
      lookupMap.set(canonicalLabel(x).toLowerCase(), x);
      const it = itTitle(x);
      if (it) lookupMap.set(`${it}${x.y ? ` (${x.y})` : ""}`.toLowerCase(), x);
    });

    const listPicks: ActivePick[] = [];
    const extraPicks: ActivePick[] = [];
    const usedKeys = new Set<string>();
    const newlyShown: string[] = [];
    const newlyShownX: string[] = [];

    for (const raw of arr) {
      const fStr = String(raw.film || "");
      const parsed = parseFilmTitleString(fStr);
      const hit =
        lookupMap.get(fStr.toLowerCase()) ||
        pool.find(
          (x) =>
            (x.t.toLowerCase() === parsed.t.toLowerCase() ||
              itTitle(x).toLowerCase() === parsed.t.toLowerCase()) &&
            (!parsed.y || Math.abs(+x.y - +parsed.y) <= 1)
        );

      if (hit && listPicks.length < 5 && !usedKeys.has(filmKey(hit))) {
        usedKeys.add(filmKey(hit));
        newlyShown.push(canonicalLabel(hit));
        listPicks.push(makePickObj(hit, raw, false));
        continue;
      }

      if (!hit && extraPicks.length < 1 && raw.tipo === "extra") {
        if (
          !parsed.t ||
          knownCheck(parsed) ||
          shownX.includes(canonicalLabel(parsed)) ||
          newlyShownX.includes(canonicalLabel(parsed)) ||
          (parsed.y && !matchesDecade(parsed, decadeSel))
        ) {
          continue;
        }
        newlyShownX.push(canonicalLabel(parsed));
        extraPicks.push(makePickObj(parsed, raw, true));
      }
    }

    let bonusErr = "";
    if (!rewatchMode && !extraPicks.length && !usedLocal) {
      try {
        const bonusPrompt = [
          `Suggerisci 10 film BONUS candidati per l'utente, in ordine di preferenza: reali e noti con certezza, NON presenti nella sua watchlist né tra i film già visti, affini ai suoi gusti e adatti al momento.`,
          `MOMENTO: ${ctx || "nessuna indicazione"}`,
          `FILTRI RIGIDI: ${flt || "nessuno"}${
            duo ? ` | SERATA IN DUE, gusti dell'altra persona: ${duo}` : ""
          }`,
          risk === "safe"
            ? "STILE: vai sul sicuro, molto vicino ai film più amati."
            : risk === "bold"
            ? "STILE: osa, fuori dalla zona di comfort ma di qualità."
            : "",
          `PROFILO GUSTI: ${lib.profile || "-"}`,
          buildTasteBlock(allSeen),
          buildWhyBlock(lib.why),
          `FILM GIÀ VISTI (non suggerirli): ${buildSeenList(allSeen, 600)}`,
          `GIÀ PROPOSTI (non riproporre): ${shownX.slice(-60).join("; ") || "nessuno"}`,
          `${TITLE_RULES}\nRispondi SOLO con un array JSON di 10 oggetti: {"film":"Titolo (Anno)","durata":"es. 112 min","regista":"nome e cognome, stringa vuota se non sei sicuro","perche":"1-2 frasi in italiano che collegano il film al momento e ai film che l'utente ha amato"}`,
        ]
          .filter(Boolean)
          .join("\n");

        const rawBonus = await generateWithAI(bonusPrompt, { jsonMode: "array" });
        const bonusArr = parseJsonSafely<RawRecommendation[]>(rawBonus, "[");
        for (const o of bonusArr) {
          const parsed = parseFilmTitleString(String(o.film || ""));
          if (
            !parsed.t ||
            knownCheck(parsed) ||
            shownX.includes(canonicalLabel(parsed)) ||
            (parsed.y && !matchesDecade(parsed, decadeSel))
          ) {
            continue;
          }
          newlyShownX.push(canonicalLabel(parsed));
          extraPicks.push(makePickObj(parsed, o, true));
          break;
        }
      } catch (err) {
        bonusErr = formatAIError(err);
      }
    }

    const combined = [...listPicks, ...extraPicks];
    setPicks(combined);

    if (!rewatchMode) {
      updateData((prev) => ({
        ...prev,
        shown: [...prev.shown, ...newlyShown],
        shownX: [...(prev.shownX || []), ...newlyShownX],
      }));
    }

    updateLib((prev) => {
      let nextHist = prev.hist;
      combined.forEach((p) => {
        nextHist = upsertHistory(nextHist, p.film, "p", p.extra);
      });
      return { ...prev, hist: nextHist };
    });

    if (usedLocal) {
      setStageNotice(
        localFallbackReason
          ? `Scelta effettuata con punteggio locale (${localFallbackReason}).`
          : rewatchMode
            ? "5 rewatch selezionati dal tuo diario/storico."
            : "Scelta effettuata con il punteggio locale. Passa ad AI Gemini per includere anche il +1 fuori lista."
      );
    } else if (!combined.length) {
      setStageError("Nessun titolo valido trovato, riprova.");
    } else if (rewatchMode) {
      setStageNotice("5 rewatch confortevoli pronti per stasera.");
    } else if (!extraPicks.length) {
      setStageNotice(
        bonusErr || "Il film bonus non è arrivato: premi di nuovo per altri 5 + 1."
      );
    } else {
      setStageNotice("Non ti convince? Premi di nuovo per altri 5 + 1.");
    }

    setLoading(false);
  };

  const fetchSingleAlternative = async (
    pick: ActivePick,
    mode: "alt" | "sim"
  ): Promise<ActivePick | null> => {
    const ctx =
      [...selectedMoods].join(", ") + (ctxText.trim() ? `. ${ctxText.trim()}` : "");
    const flt = buildFilterSummary(filterConfig);
    const duo = selectedMoods.has("In due") ? (lib.partner || "").trim() : "";
    const poolNow = fullWatchlist.filter(
      (x) =>
        passesFilters(x, lib, filterConfig) &&
        !data.shown.includes(canonicalLabel(x))
    );

    const head =
      mode === "sim"
        ? `L'utente sta valutando il film "${canonicalLabel(
            pick.film
          )}". Scegli UN solo altro film molto simile (tono, genere, regista, atmosfera), `
        : `L'utente ha messo da parte il film "${canonicalLabel(
            pick.film
          )}". Scegli UN solo altro film adatto al MOMENTO, diverso dal precedente, `;
    const tail = pick.extra
      ? "NON presente nella watchlist né tra i film già visti, reale e conosciuto con certezza."
      : "preso DALLA WATCHLIST sotto e copiato esattamente come 'Titolo (Anno)', senza i dati dopo il simbolo |.";

    const prompt = [
      head + tail,
      mode === "sim" ? "" : `MOMENTO: ${ctx || "nessuna indicazione"}`,
      `FILTRI RIGIDI: ${flt || "nessuno"}${
        duo ? ` | SERATA IN DUE, gusti dell'altra persona: ${duo}` : ""
      }`,
      `PROFILO GUSTI: ${lib.profile || "-"}`,
      mode === "sim" ? "" : buildTasteBlock(allSeen),
      buildWhyBlock(lib.why),
      `GIÀ PROPOSTI (non riproporre): ${data.shown
        .concat(data.shownX || [])
        .slice(-60)
        .join("; ")}`,
      pick.extra
        ? `FILM GIÀ VISTI (non suggerirli): ${buildSeenList(allSeen, 600)}`
        : "",
      `${TITLE_RULES}
Rispondi SOLO con un oggetto JSON: {"film":"Titolo (Anno)","durata":"es. 112 min","regista":"nome e cognome, stringa vuota se non sei sicuro","perche":"${
        mode === "sim"
          ? "1-2 frasi su cosa lo rende simile e in cosa è diverso"
          : "1-2 frasi su perché va bene adesso"
      }"}`,
      pick.extra
        ? ""
        : `WATCHLIST:\n${poolNow
            .slice(0, 1500)
            .map((x) => {
              const m = lib.meta[filmKey(x)];
              return (
                canonicalLabel(x) +
                (m && (m.g || m.m)
                  ? ` | ${m.g || ""} | ${m.m || "?"} min | ${m.d || ""}`
                  : "")
              );
            })
            .join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n");

    let o: RawRecommendation;
    if (engineMode === "ai" && aiAvailable) {
      try {
        const raw = await generateWithAI(prompt, { jsonMode: "object" });
        o = parseJsonSafely<RawRecommendation>(raw, "{");
      } catch (err) {
        if (pick.extra) throw err;
        const h0 = rankedPool(poolNow, allSeen, lib, selectedMoods)[0];
        if (!h0) throw err;
        const m0 = lib.meta[filmKey(h0.x)];
        o = {
          film: canonicalLabel(h0.x),
          durata: m0?.m ? `${m0.m} min` : "",
          regista: m0?.d || "",
          perche: "Scelta con il punteggio locale.",
        };
      }
    } else {
      if (pick.extra) return null;
      const h0 = rankedPool(poolNow, allSeen, lib, selectedMoods)[0];
      if (!h0) return null;
      const m0 = lib.meta[filmKey(h0.x)];
      o = {
        film: canonicalLabel(h0.x),
        durata: m0?.m ? `${m0.m} min` : "",
        regista: m0?.d || "",
        perche: "Scelta con il punteggio locale.",
      };
    }

    const fStr = String(o.film || "");
    const fl = fStr.toLowerCase();

    if (!pick.extra) {
      const hit2 =
        poolNow.find(
          (x) =>
            canonicalLabel(x).toLowerCase() === fl ||
            (itTitle(x) &&
              `${itTitle(x)}${x.y ? ` (${x.y})` : ""}`.toLowerCase() === fl)
        ) || poolNow.find((x) => fl.startsWith(x.t.toLowerCase()));

      if (hit2 && filmKey(hit2) !== filmKey(pick.film)) {
        updateData((prev) => ({
          ...prev,
          shown: [...prev.shown, canonicalLabel(hit2)],
        }));
        updateLib((prev) => ({
          ...prev,
          hist: upsertHistory(prev.hist, hit2, "p", false),
        }));
        return makePickObj(hit2, o, false);
      }
      return null;
    } else {
      const parsed = parseFilmTitleString(fStr);
      if (
        parsed.t &&
        normTitle(parsed.t) !== normTitle(pick.film.t) &&
        !knownCheck(parsed) &&
        !(data.shownX || []).includes(canonicalLabel(parsed)) &&
        !(parsed.y && !matchesDecade(parsed, decadeSel))
      ) {
        updateData((prev) => ({
          ...prev,
          shownX: [...(prev.shownX || []), canonicalLabel(parsed)],
        }));
        updateLib((prev) => ({
          ...prev,
          hist: upsertHistory(prev.hist, parsed, "p", true),
        }));
        return makePickObj(parsed, o, true);
      }
      return null;
    }
  };

  const handleWatchTonight = (pick: ActivePick) => {
    updateLib((prev) => ({
      ...prev,
      hist: upsertHistory(prev.hist, pick.film, "y", pick.extra),
    }));
    setPicks((prev) =>
      prev.map((p) =>
        p.id === pick.id
          ? {
              ...p,
              status: "done",
              statusMessage: `${displayLabel(
                pick.film
              )}: buona scelta! Domani ti chiedo com’è andata. Lo trovi in Cronologia.`,
            }
          : p
      )
    );
  };

  const handleLater = (pick: ActivePick) => {
    updateLib((prev) => ({
      ...prev,
      hist: upsertHistory(prev.hist, pick.film, "l", pick.extra),
    }));
    setPicks((prev) =>
      prev.map((p) =>
        p.id === pick.id
          ? {
              ...p,
              status: "done",
              askWhy: true,
              statusMessage: `${displayLabel(pick.film)}: ne riparliamo più avanti.`,
            }
          : p
      )
    );
  };

  const handleNever = (pick: ActivePick) => {
    const k = filmKey(pick.film);
    updateLib((prev) => ({
      ...prev,
      marks: {
        ...prev.marks,
        [k]: { s: "no", t: pick.film.t, y: pick.film.y },
      },
      hist: upsertHistory(prev.hist, pick.film, "n", pick.extra),
    }));
    setPicks((prev) =>
      prev.map((p) =>
        p.id === pick.id
          ? {
              ...p,
              status: "done",
              askWhy: true,
              statusMessage: `${displayLabel(pick.film)}: non te lo proporrò più.`,
            }
          : p
      )
    );
  };

  const handleReplace = async (pick: ActivePick) => {
    setPicks((prev) =>
      prev.map((p) => (p.id === pick.id ? { ...p, altLoading: true } : p))
    );
    try {
      const replacement = await fetchSingleAlternative(pick, "alt");
      if (replacement) {
        updateLib((prev) => ({
          ...prev,
          hist: upsertHistory(prev.hist, pick.film, "l", pick.extra),
        }));
        setPicks((prev) => {
          const idx = prev.findIndex((p) => p.id === pick.id);
          if (idx < 0) return prev;
          const copy = [...prev];
          copy[idx] = {
            ...pick,
            altLoading: false,
            status: "done",
            askWhy: true,
            statusMessage: `${displayLabel(pick.film)}: sostituito.`,
          };
          copy.splice(idx + 1, 0, replacement);
          return copy;
        });
      } else {
        setStageNotice("Nessuna alternativa valida trovata con questi filtri.");
        setPicks((prev) =>
          prev.map((p) => (p.id === pick.id ? { ...p, altLoading: false } : p))
        );
      }
    } catch (err) {
      setStageNotice(formatAIError(err));
      setPicks((prev) =>
        prev.map((p) => (p.id === pick.id ? { ...p, altLoading: false } : p))
      );
    }
  };

  const handleSimilar = async (pick: ActivePick) => {
    setPicks((prev) =>
      prev.map((p) => (p.id === pick.id ? { ...p, simLoading: true } : p))
    );
    try {
      const simPick = await fetchSingleAlternative(pick, "sim");
      if (simPick) {
        setPicks((prev) => {
          const idx = prev.findIndex((p) => p.id === pick.id);
          if (idx < 0) return prev;
          const copy = [...prev];
          copy[idx] = { ...pick, simLoading: false };
          copy.splice(idx + 1, 0, simPick);
          return copy;
        });
      } else {
        setStageNotice("Nessun film simile trovato con i filtri attuali.");
        setPicks((prev) =>
          prev.map((p) => (p.id === pick.id ? { ...p, simLoading: false } : p))
        );
      }
    } catch (err) {
      setStageNotice(formatAIError(err));
      setPicks((prev) =>
        prev.map((p) => (p.id === pick.id ? { ...p, simLoading: false } : p))
      );
    }
  };

  const handleExplainWhy = async (pick: ActivePick) => {
    if (pick.deepWhy) {
      setPicks((prev) =>
        prev.map((p) =>
          p.id === pick.id ? { ...p, deepWhyOpen: !p.deepWhyOpen } : p
        )
      );
      return;
    }

    setPicks((prev) =>
      prev.map((p) =>
        p.id === pick.id
          ? { ...p, deepWhyOpen: true, deepWhyLoading: true }
          : p
      )
    );

    const ctx =
      [...selectedMoods].join(", ") + (ctxText.trim() ? `. ${ctxText.trim()}` : "");
    try {
      const prompt = `Spiega in 3-4 frasi, in italiano, perché il film "${canonicalLabel(
        pick.film
      )}" è una buona scelta per questa persona adesso. Collega il momento (${
        ctx || "nessuna indicazione"
      }) e i film che ha amato, e dì onestamente anche un possibile punto debole (durata, ritmo, tono). Non inventare dettagli che non conosci con certezza.\nPROFILO GUSTI: ${
        lib.profile || "-"
      }\n${buildTasteBlock(allSeen)}`;

      const text = await generateWithAI(prompt);
      setPicks((prev) =>
        prev.map((p) =>
          p.id === pick.id
            ? { ...p, deepWhyLoading: false, deepWhy: text.trim() }
            : p
        )
      );
    } catch (err) {
      setPicks((prev) =>
        prev.map((p) =>
          p.id === pick.id
            ? { ...p, deepWhyLoading: false, deepWhy: formatAIError(err) }
            : p
        )
      );
    }
  };

  const appendLocalDiaryLog = (
    prevDiary: DiaryEntry[] | undefined,
    film: FilmItem,
    rating: number | null
  ): DiaryEntry[] => {
    const k = filmKey(film);
    const today = new Date().toISOString().slice(0, 10);
    const alreadySeenBefore =
      allSeen.some((s) => filmKey(s) === k) ||
      (prevDiary || []).some((d) => d.k === k && d.watchedDate !== today);
    const entry: DiaryEntry = {
      id: `local-${k}|${today}`,
      k,
      t: film.t,
      y: film.y || "",
      watchedDate: today,
      loggedDate: today,
      r: rating,
      ...(alreadySeenBefore ? { rw: true } : {}),
    };
    return mergeDiaryEntries(prevDiary || [], [entry]);
  };

  const handleRateSeen = (pick: ActivePick, rating: number) => {
    if (rating < 0) {
      setPicks((prev) =>
        prev.map((p) => (p.id === pick.id ? { ...p, ratingOpen: true } : p))
      );
      return;
    }
    const k = filmKey(pick.film);
    updateLib((prev) => ({
      ...prev,
      marks: {
        ...prev.marks,
        [k]: { s: "seen", t: pick.film.t, y: pick.film.y, r: rating },
      },
      hist: upsertHistory(prev.hist, pick.film, "s", pick.extra),
      diary: appendLocalDiaryLog(prev.diary, pick.film, rating),
    }));
    setPicks((prev) =>
      prev.map((p) =>
        p.id === pick.id
          ? {
              ...p,
              status: "done",
              statusMessage: `${displayLabel(
                pick.film
              )}: segnato come visto (${rating}★).`,
            }
          : p
      )
    );
  };

  const handleAddExtraToList = (pick: ActivePick) => {
    const newItem: FilmItem = { t: pick.film.t, y: pick.film.y };
    updateLib((prev) => ({
      ...prev,
      add: [...(prev.add || []), newItem],
      hist: upsertHistory(prev.hist, pick.film, "a", true),
    }));
    setPicks((prev) =>
      prev.map((p) =>
        p.id === pick.id
          ? {
              ...p,
              status: "done",
              statusMessage: `${displayLabel(
                pick.film
              )}: aggiunto alla tua watchlist.`,
            }
          : p
      )
    );
    autoFetchMeta(newItem);
  };

  const handleNoteReason = (pick: ActivePick, reason: string) => {
    const k = filmKey(pick.film);
    updateLib((prev) => {
      const nextWhy = (prev.why || []).filter((z) => z.k !== k);
      nextWhy.push({
        k,
        t: pick.film.t,
        y: pick.film.y || "",
        w: reason,
        ts: Date.now(),
      });
      if (nextWhy.length > 40) nextWhy.splice(0, nextWhy.length - 40);
      return { ...prev, why: nextWhy };
    });
    setPicks((prev) =>
      prev.map((p) => (p.id === pick.id ? { ...p, whySaved: reason } : p))
    );
  };

  const handleOutcome = (entry: HistoryEntry, outcome: OutcomeKey) => {
    const rating = OUTCOMES[outcome].rating;
    updateLib((prev) => ({
      ...prev,
      marks: {
        ...prev.marks,
        [entry.k]: {
          s: "seen",
          t: entry.t,
          y: entry.y,
          r: rating,
          fb: outcome,
          ts: Date.now(),
        },
      },
      hist: upsertHistory(
        prev.hist,
        { t: entry.t, y: entry.y },
        "s",
        entry.e
      ),
      diary: appendLocalDiaryLog(
        prev.diary,
        { t: entry.t, y: entry.y },
        rating
      ),
    }));
  };

  const handleSyncDiaryRss = async (
    username: string,
    options?: { onlyNew?: boolean }
  ): Promise<RssSyncResult> => {
    const onlyNew = options?.onlyNew ?? true;
    const res = await syncLetterboxdDiary(username);
    const prevDiary = lib.diary || [];
    const { unseenEntries, skippedAlreadyLoaded } = filterNewDiaryEntries(
      res.entries,
      allSeen,
      prevDiary
    );

    const entriesToImport = onlyNew ? unseenEntries : res.entries;
    const nextDiary = entriesToImport.length
      ? mergeDiaryEntries(prevDiary, entriesToImport)
      : prevDiary;
    const added = Math.max(0, nextDiary.length - prevDiary.length);

    const isNewlyWatched =
      unseenEntries.length > 0 ? buildFilmMatcher(unseenEntries) : null;
    const incomingSeen = diaryToSeenItems(entriesToImport);

    updateData((prev) => ({
      ...prev,
      watch: isNewlyWatched
        ? prev.watch.filter((w) => !isNewlyWatched(w))
        : prev.watch,
      seen: incomingSeen.length
        ? mergeSeenImports(prev.seen, incomingSeen)
        : prev.seen,
      custom: prev.custom || added > 0 || incomingSeen.length > 0,
    }));

    updateLib((prev) => ({
      ...prev,
      add: isNewlyWatched
        ? (prev.add || []).filter((a) => !isNewlyWatched(a))
        : prev.add,
      diary: nextDiary,
      letterboxdUser: res.user,
      diarySyncedAt: res.fetchedAt,
      ts: Date.now(),
    }));

    let enrichedActorsCount = 0;
    if (aiAvailable && unseenEntries.length > 0) {
      try {
        const toEnrich = unseenEntries.slice(0, 25).map((e) => ({
          t: e.t,
          y: e.y,
        }));
        const enriched = await enrichNewFilmsWithAI(toEnrich, lib.meta);
        if (Object.keys(enriched.updates).length > 0) {
          updateLib((prev) => ({
            ...prev,
            meta: { ...prev.meta, ...enriched.updates },
          }));
        }
        enrichedActorsCount = enriched.enrichedCount;
      } catch {
        // Silent fallback: films are synced even if AI metadata enrichment fails
      }
    }

    return {
      added,
      skippedAlreadyLoaded,
      totalRss: res.entries.length,
      enrichedActorsCount,
      onlyNew,
    };
  };

  const handleImportDiaryCsv = (entries: DiaryEntry[]): number => {
    const nextDiary = mergeDiaryEntries(lib.diary || [], entries);
    const incomingSeen = diaryToSeenItems(entries);
    updateData((prev) => ({
      ...prev,
      seen: mergeSeenImports(prev.seen, incomingSeen),
      custom: true,
    }));
    updateLib((prev) => ({
      ...prev,
      diary: nextDiary,
      ts: Date.now(),
    }));
    return nextDiary.length;
  };

  const handleDeferPending = (entry: HistoryEntry) => {
    updateLib((prev) => ({
      ...prev,
      hist: upsertHistory(
        prev.hist,
        { t: entry.t, y: entry.y },
        "y",
        entry.e
      ),
    }));
  };

  const handleDismissHistory = (entry: HistoryEntry) => {
    updateLib((prev) => ({
      ...prev,
      hist: upsertHistory(
        prev.hist,
        { t: entry.t, y: entry.y },
        "x",
        entry.e
      ),
    }));
  };

  const handleUndoNever = (entry: HistoryEntry) => {
    updateLib((prev) => {
      const nextMarks = { ...prev.marks };
      delete nextMarks[entry.k];
      return {
        ...prev,
        marks: nextMarks,
        hist: upsertHistory(
          prev.hist,
          { t: entry.t, y: entry.y },
          "x",
          entry.e
        ),
      };
    });
  };

  const avgRating = useMemo(() => {
    const rated = allSeen.filter((x) => x.r != null);
    if (!rated.length) return 0;
    const maxR = Math.max(...rated.map((x) => x.r || 0));
    const unit = maxR <= 5 ? 1 : 2;
    return rated.reduce((s, x) => s + (x.r || 0), 0) / rated.length / unit;
  }, [allSeen]);

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900 dark:bg-[#0B0E14] dark:text-slate-100">
      <HeaderBar
        tab={tab}
        setTab={setTab}
        tonightCount={tonightCount}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {tab === "serata" && (
          <div className="space-y-8">
            <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-slate-800">
              <div>
                <div className="font-mono text-xs uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
                  {(() => {
                    const now = new Date();
                    const day = now.toLocaleDateString("it-IT", {
                      weekday: "long",
                    });
                    const hr = now.getHours();
                    const part =
                      hr < 14
                        ? "mattinata di cinema"
                        : hr < 18
                        ? "pomeriggio di cinema"
                        : "serata cinema";
                    return `${day.charAt(0).toUpperCase() + day.slice(1)} · ${part}`;
                  })()}
                </div>
                <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl dark:text-white">
                  Cosa guardiamo stasera?
                </h1>
              </div>

              {(selectedMoods.size > 0 ||
                activeFilterGroups > 0 ||
                risk !== "") && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Criteri:
                  </span>
                  <span>
                    {[
                      ...Array.from(selectedMoods),
                      ...(minMinutes || maxMinutes ? [durationLabel] : []),
                      ...(risk === "safe"
                        ? ["Sul sicuro"]
                        : risk === "bold"
                        ? ["Osare"]
                        : []),
                    ].join(" · ") || `${activeFilterGroups} filtri attivi`}
                  </span>
                </div>
              )}
            </header>

            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
              <EveningControls
                selectedMoods={selectedMoods}
                onToggleMood={(m) => toggleSet(setSelectedMoods, m)}
                onSelectCompanion={handleSelectCompanion}
                onApplyPreset={handleApplyPreset}
                partnerTaste={lib.partner || ""}
                onChangePartnerTaste={(val) =>
                  updateLib((prev) => ({ ...prev, partner: val }))
                }
                risk={risk}
                onChangeRisk={setRisk}
                ctxText={ctxText}
                onChangeCtxText={setCtxText}
                filtersOpen={filtersOpen}
                onToggleFiltersOpen={() => setFiltersOpen((o) => !o)}
                durMin={durMin}
                durMax={durMax}
                onChangeDurMin={setDurMin}
                onChangeDurMax={setDurMax}
                durationLabel={durationLabel}
                genreSel={genreSel}
                onToggleGenre={(val) => toggleSet(setGenreSel, val)}
                countrySel={countrySel}
                onToggleCountry={(val) => toggleSet(setCountrySel, val)}
                decadeSel={decadeSel}
                onToggleDecade={(val) => toggleSet(setDecadeSel, val)}
                activeFilterGroups={activeFilterGroups}
                filteredCount={filteredBase.length}
                unknownMetaCount={unknownMetaCount}
                onResetAllFilters={resetAllFilters}
                aiAvailable={aiAvailable}
                engineMode={engineMode}
                onChangeEngineMode={setEngineMode}
                rewatchMode={rewatchMode}
                onChangeRewatchMode={setRewatchMode}
                rewatchCount={rewatchPool.length}
                loading={loading}
                onRecommend={handleRecommend}
              />

              <RecommendationsStage
                pendingItems={pendingItems}
                onOutcome={handleOutcome}
                onDeferPending={handleDeferPending}
                onDismissHistory={handleDismissHistory}
                stageError={stageError}
                stageNotice={stageNotice}
                loading={loading}
                picks={picks}
                watchlistPool={fullWatchlist}
                filteredPool={filteredBase}
                metaMap={lib.meta}
                watchlistCount={fullWatchlist.length}
                seenCount={allSeen.length}
                avgRating={avgRating}
                profile={lib.profile}
                onOpenProfile={() => setTab("profilo")}
                onOpenArchive={() => setTab("archivio")}
                onSurprisePick={handleSurprisePick}
                onClearPicks={() => {
                  setPicks([]);
                  setStageNotice("");
                }}
                aiEnabled={aiAvailable && engineMode === "ai"}
                previews={previews}
                onRequestPreview={requestPreview}
                onOpenPreview={setPreviewPick}
                onWatchTonight={handleWatchTonight}
                onReplace={handleReplace}
                onLater={handleLater}
                onNever={handleNever}
                onExplainWhy={handleExplainWhy}
                onSimilar={handleSimilar}
                onRateSeen={handleRateSeen}
                onAddExtraToList={handleAddExtraToList}
                onNoteReason={handleNoteReason}
              />
            </div>
          </div>
        )}

        {tab === "cinesfida" && (
          <CineSfidaView
            watchlistPool={fullWatchlist}
            filteredPool={filteredBase}
            hasActiveFilters={
              minMinutes > 0 ||
              maxMinutes > 0 ||
              genreSel.size > 0 ||
              countrySel.size > 0 ||
              decadeSel.size > 0
            }
            allSeen={allSeen}
            lib={lib}
            onWatchTonightFilm={(film) =>
              updateLib((prev) => ({
                ...prev,
                hist: upsertHistory(prev.hist, film, "y", false),
              }))
            }
          />
        )}

        {tab === "cronologia" && (
          <HistoryView
            seen={data.seen}
            lib={lib}
            aiAvailable={aiAvailable}
            onOutcome={handleOutcome}
            onWatchFromHistory={(entry) =>
              updateLib((prev) => ({
                ...prev,
                hist: upsertHistory(
                  prev.hist,
                  { t: entry.t, y: entry.y },
                  "y",
                  entry.e
                ),
              }))
            }
            onRepropose={handleDismissHistory}
            onUndoNever={handleUndoNever}
            onMergeMeta={(updates) =>
              updateLib((prev) => ({
                ...prev,
                meta: { ...prev.meta, ...updates },
              }))
            }
            onSyncDiaryRss={handleSyncDiaryRss}
            onImportDiaryCsv={handleImportDiaryCsv}
            onOpenArchive={() => setTab("archivio")}
          />
        )}

        {tab === "profilo" && (
          <ProfileView
            watch={data.watch}
            seen={data.seen}
            lib={lib}
            aiAvailable={aiAvailable}
            onUpdateProfile={(profile) =>
              updateLib((prev) => ({ ...prev, profile }))
            }
            onMergeMeta={(updates: Record<string, FilmMeta>) =>
              updateLib((prev) => ({
                ...prev,
                meta: { ...prev.meta, ...updates },
              }))
            }
            onClearWhy={() => updateLib((prev) => ({ ...prev, why: [] }))}
          />
        )}

        {tab === "archivio" && (
          <ArchiveView
            data={data}
            lib={lib}
            onImportWatchlist={(films: FilmItem[]) => {
              const switchingFromSeed = !data.custom;
              updateData((prev) => ({
                watch: films,
                seen: switchingFromSeed ? [] : prev.seen,
                shown: [],
                shownX: [],
                custom: true,
              }));
              if (switchingFromSeed) {
                updateLib((prev) => ({
                  meta: prev.meta,
                  marks: {},
                  profile: "",
                  partner: "",
                  hist: [],
                  add: [],
                  why: [],
                  diary: [],
                  letterboxdUser: "",
                  diarySyncedAt: 0,
                  ts: Date.now(),
                }));
              }
              setPicks([]);
            }}
            onImportSeen={(films: SeenFilmItem[], diaryEntries?: DiaryEntry[]) => {
              const switchingFromSeed = !data.custom;
              updateData((prev) => ({
                watch: switchingFromSeed ? [] : prev.watch,
                seen: films,
                shown: switchingFromSeed ? [] : prev.shown,
                shownX: switchingFromSeed ? [] : prev.shownX,
                custom: true,
              }));
              updateLib((prev) => ({
                meta: prev.meta,
                marks: switchingFromSeed ? {} : prev.marks,
                profile: switchingFromSeed ? "" : prev.profile,
                partner: switchingFromSeed ? "" : prev.partner,
                hist: switchingFromSeed ? [] : prev.hist,
                add: switchingFromSeed ? [] : prev.add,
                why: switchingFromSeed ? [] : prev.why,
                diary:
                  diaryEntries !== undefined
                    ? diaryEntries
                    : switchingFromSeed
                      ? []
                      : prev.diary || [],
                letterboxdUser: switchingFromSeed ? "" : prev.letterboxdUser,
                diarySyncedAt: switchingFromSeed ? 0 : prev.diarySyncedAt,
                ts: Date.now(),
              }));
            }}
            onSyncDiaryRss={handleSyncDiaryRss}
            onImportDiaryCsv={handleImportDiaryCsv}
            onClearToEmptyUser={() => {
              const emptyData: WatchlistDataState = {
                watch: [],
                seen: [],
                shown: [],
                shownX: [],
                custom: true,
              };
              persistDataState(emptyData);
              setData(emptyData);
              updateLib((prev) => ({
                meta: prev.meta,
                marks: {},
                profile: "",
                partner: "",
                hist: [],
                add: [],
                why: [],
                diary: [],
                letterboxdUser: "",
                diarySyncedAt: 0,
                ts: Date.now(),
              }));
              setPicks([]);
            }}
            onResetOriginal={() => {
              const preservedMeta = lib.meta;
              const preservedUser = lib.letterboxdUser || "";
              localStorage.removeItem("wl_v1");
              localStorage.removeItem("wl_v2");
              const freshData = loadInitialDataState();
              const freshLib = loadInitialLibraryState();
              const restoredLib: LibraryState = {
                ...freshLib,
                meta: { ...freshLib.meta, ...preservedMeta },
                letterboxdUser: preservedUser,
              };
              persistLibraryState(restoredLib);
              setData(freshData);
              setLib(restoredLib);
              setPicks([]);
            }}
            onImportBackup={(payload) => {
              const nextLib: LibraryState = {
                ...lib,
                ...payload.L,
              };
              persistLibraryState(nextLib);
              setLib(nextLib);
              if (payload.D && payload.D.custom) {
                const nextData: WatchlistDataState = {
                  watch: payload.D.watch || data.watch,
                  seen: payload.D.seen || data.seen,
                  shown: [],
                  shownX: [],
                  custom: true,
                };
                persistDataState(nextData);
                setData(nextData);
              }
            }}
          />
        )}
      </main>

      <FilmPreviewModal
        pick={previewPick}
        preview={previewPick ? previews[filmKey(previewPick.film)] : undefined}
        meta={previewPick ? lib.meta[filmKey(previewPick.film)] : undefined}
        onRequestPreview={requestPreview}
        onClose={() => setPreviewPick(null)}
        onWatchTonight={handleWatchTonight}
      />
    </div>
  );
}
