import { generateWithAI } from "./aiClient";
import {
  canonicalFilmIdentity,
  canonicalLabel,
  filmKey,
  normTitle,
  nz,
} from "./filmHelpers";
import { parseJsonSafely } from "./parsers";
import { isAnimationFilm } from "./profileStats";
import type { FilmItem, FilmMeta } from "../types";

export function cleanPeopleValue(val: unknown): string {
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

export function resolveBatchFilm<T extends FilmItem>(
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

export async function processPeopleBatch<T extends FilmItem>(
  batch: T[],
  metaSnapshot: Record<string, FilmMeta>,
  options?: { forceOverwrite?: boolean; includeFullMeta?: boolean }
): Promise<{ updates: Record<string, FilmMeta>; omitted: T[] }> {
  const forceOverwrite = Boolean(options?.forceOverwrite);
  const includeFullMeta = Boolean(options?.includeFullMeta);

  const extraFieldsPrompt = includeFullMeta
    ? `\n- "m": durata in minuti (intero, oppure null se non sei sicuro)\n- "c": paese di produzione principale in italiano (es. Stati Uniti, Italia, Francia)`
    : "";
  const exampleObj = includeFullMeta
    ? `[{"i":0,"g":"...","m":115,"d":"Regista","c":"Paese","a":"Attore 1 / Attore 2 / Attore 3"}]`
    : `[{"i":0,"g":"...","d":"Regista","a":"Attore 1 / Attore 2 / Attore 3"}]`;

  const prompt =
    `Verifica OGNI film singolarmente. Per ciascuno indica:
- "g": genere principale in italiano (max 2 separati da /, es. "Animazione / Avventura", "Commedia", "Drammatico")
- "d": regista originale
- "a": fino a 3 ATTORI REALI IN CARNE E OSSA separati da " / ".${extraFieldsPrompt}
REGOLE RIGOROSE:
1) Per film d'animazione, anime o corti animati NON inserire mai doppiatori o voci: metti OBBLIGATORIAMENTE "a": null (indica però sempre "g" e "d").
2) Per documentari senza attori metti "a": null.
3) NON copiare né ripetere mai lo stesso regista o gli stessi attori su altri titoli della lista: se non conosci con certezza assoluta il film, metti null.

Rispondi SOLO con un array JSON valido contenente ESATTAMENTE un oggetto per ogni indice da 0 a ${batch.length - 1}: ${exampleObj}\n\n` +
    batch.map((x, j) => `${j}. ${canonicalLabel(x)}`).join("\n");

  const raw = await generateWithAI(prompt, {
    jsonMode: "array",
    fast: true,
  });

  const arr = parseJsonSafely<
    Array<{
      i?: unknown;
      t?: unknown;
      title?: unknown;
      film?: unknown;
      g?: unknown;
      m?: unknown;
      d?: unknown;
      c?: unknown;
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
      !forceOverwrite && nz(prev.g)
        ? prev.g
        : rawGenre && rawGenre.toLowerCase() !== "null"
          ? rawGenre
          : prev.g || "";

    const dir =
      !forceOverwrite && nz(prev.d)
        ? prev.d
        : cleanPeopleValue(o.d) || (!forceOverwrite ? prev.d || "" : "");

    const isAnim = /animazion|animat|anime|cartoon/i.test(genre);
    const act = isAnim
      ? ""
      : !forceOverwrite && nz(prev.a)
        ? prev.a || ""
        : cleanPeopleValue(o.a) || (!forceOverwrite ? prev.a || "" : "");

    const rawCountry = String(o.c || "").trim();
    const country =
      !forceOverwrite && nz(prev.c)
        ? prev.c
        : rawCountry && rawCountry.toLowerCase() !== "null"
          ? rawCountry
          : prev.c || "";
    const parsedRuntime = Number(o.m);
    const validRuntime =
      Number.isFinite(parsedRuntime) && parsedRuntime > 0 && parsedRuntime <= 900
        ? Math.round(parsedRuntime)
        : 0;
    const runtime =
      !forceOverwrite && prev.m > 0
        ? prev.m
        : validRuntime || prev.m || 0;

    const nextMeta: FilmMeta = {
      g: genre,
      m: runtime,
      d: dir,
      c: country,
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
}

function buildCanonMetaIndex(metaSnapshot: Record<string, FilmMeta>): Map<string, FilmMeta> {
  const index = new Map<string, FilmMeta>();
  for (const [k, m] of Object.entries(metaSnapshot)) {
    const sep = k.lastIndexOf("|");
    const t = sep >= 0 ? k.slice(0, sep) : k;
    const y = sep >= 0 ? k.slice(sep + 1) : "";
    const canon = canonicalFilmIdentity({ t, y });
    if (!index.has(canon)) {
      index.set(canon, m);
    }
  }
  return index;
}

export async function enrichNewFilmsWithAI<T extends FilmItem>(
  films: T[],
  currentMeta: Record<string, FilmMeta>,
  options?: {
    maxFilms?: number;
    skipOmittedRetry?: boolean;
    onBatchUpdates?: (updates: Record<string, FilmMeta>) => void;
  }
): Promise<{
  updates: Record<string, FilmMeta>;
  enrichedCount: number;
  partialError?: unknown;
}> {
  const metaSnapshot: Record<string, FilmMeta> = { ...currentMeta };
  const canonMetaIndex = buildCanonMetaIndex(metaSnapshot);
  const seenCanon = new Set<string>();
  const queue: T[] = [];

  for (const f of films) {
    const canon = canonicalFilmIdentity(f);
    if (seenCanon.has(canon)) continue;
    seenCanon.add(canon);

    const m = metaSnapshot[filmKey(f)] || canonMetaIndex.get(canon);
    if (m) {
      const anim = isAnimationFilm(m);
      const alreadyComplete = nz(m.d) && (anim || nz(m.a) || Boolean(m.pc));
      if (alreadyComplete) continue;
    }
    queue.push(f);
  }

  const cappedQueue =
    options?.maxFilms && options.maxFilms > 0
      ? queue.slice(0, options.maxFilms)
      : queue;

  if (!cappedQueue.length) {
    return { updates: {}, enrichedCount: 0 };
  }

  const allUpdates: Record<string, FilmMeta> = {};
  let enrichedCount = 0;
  let partialError: unknown;

  for (let i = 0; i < cappedQueue.length; i += 20) {
    const batch = cappedQueue.slice(i, i + 20);
    try {
      const firstPass = await processPeopleBatch(batch, metaSnapshot, {
        includeFullMeta: true,
      });
      Object.assign(allUpdates, firstPass.updates);
      if (Object.keys(firstPass.updates).length > 0) {
        options?.onBatchUpdates?.(firstPass.updates);
      }

      if (!options?.skipOmittedRetry && firstPass.omitted.length > 0) {
        const retryPass = await processPeopleBatch(
          firstPass.omitted.slice(0, 12),
          metaSnapshot,
          { includeFullMeta: true }
        );
        Object.assign(allUpdates, retryPass.updates);
        if (Object.keys(retryPass.updates).length > 0) {
          options?.onBatchUpdates?.(retryPass.updates);
        }
      }

      for (const f of batch) {
        const m = allUpdates[filmKey(f)] || metaSnapshot[filmKey(f)];
        if (m && (nz(m.d) || nz(m.a))) {
          enrichedCount += 1;
        }
      }
    } catch (err) {
      // Preserve any partial updates collected from previous batches/passes
      partialError = err;
      break;
    }
  }

  return {
    updates: allUpdates,
    enrichedCount,
    ...(partialError ? { partialError } : {}),
  };
}
