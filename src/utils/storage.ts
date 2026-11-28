import {
  EMB,
  FIX_META,
  OVR_META,
  PURGE_KEYS,
  SEED,
} from "../data/embeddedLibrary";
import { STORAGE_DATA_KEY, STORAGE_LIB_KEY } from "../constants/filters";
import { filmKey, safeExternalUrl } from "./filmHelpers";
import type {
  DiaryEntry,
  DiscardWhy,
  FilmItem,
  FilmMark,
  FilmMeta,
  HistoryEntry,
  LibraryState,
  SeenFilmItem,
  WatchlistDataState,
} from "../types";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function safeJsonParse(raw: string): unknown {
  return JSON.parse(raw, (key, value) =>
    FORBIDDEN_KEYS.has(key) ? undefined : value
  );
}

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}

function sanitizeFilmItem(raw: unknown): FilmItem | null {
  if (!isPlainRecord(raw)) return null;
  const t = typeof raw.t === "string" ? raw.t.trim().slice(0, 250) : "";
  if (!t) return null;
  const y =
    typeof raw.y === "string"
      ? raw.y.trim().slice(0, 10)
      : typeof raw.y === "number"
        ? String(raw.y).slice(0, 10)
        : "";
  const it = typeof raw.it === "string" ? raw.it.trim().slice(0, 250) : undefined;
  return { t, y, ...(it ? { it } : {}) };
}

function sanitizeSeenItem(raw: unknown): SeenFilmItem | null {
  const base = sanitizeFilmItem(raw);
  if (!base || !isPlainRecord(raw)) return null;
  const r =
    typeof raw.r === "number" && Number.isFinite(raw.r) && raw.r >= 0 && raw.r <= 10
      ? raw.r
      : null;
  const rw =
    typeof raw.rw === "boolean" || typeof raw.rw === "number" ? raw.rw : undefined;
  const fb =
    raw.fb === "love" ||
    raw.fb === "good" ||
    raw.fb === "meh" ||
    raw.fb === "stop"
      ? raw.fb
      : undefined;
  return {
    ...base,
    r,
    ...(rw !== undefined ? { rw } : {}),
    ...(fb ? { fb } : {}),
  };
}

function sanitizeMetaMap(raw: unknown): Record<string, FilmMeta> {
  const out: Record<string, FilmMeta> = {};
  if (!isPlainRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (FORBIDDEN_KEYS.has(k) || !isPlainRecord(v)) continue;
    out[k] = {
      g: typeof v.g === "string" ? v.g.slice(0, 120) : "",
      m: typeof v.m === "number" && Number.isFinite(v.m) && v.m > 0 ? Math.round(v.m) : 0,
      d: typeof v.d === "string" ? v.d.slice(0, 150) : "",
      c: typeof v.c === "string" ? v.c.slice(0, 120) : "",
      ...(typeof v.a === "string" && v.a ? { a: v.a.slice(0, 250) } : {}),
      ...(v.pc ? { pc: true } : {}),
      ...(v.mc ? { mc: true } : {}),
    };
  }
  return out;
}

function sanitizeMarksMap(raw: unknown): Record<string, FilmMark> {
  const out: Record<string, FilmMark> = {};
  if (!isPlainRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (FORBIDDEN_KEYS.has(k) || !isPlainRecord(v)) continue;
    if (v.s !== "seen" && v.s !== "no") continue;
    const t = typeof v.t === "string" ? v.t.trim().slice(0, 250) : "";
    if (!t) continue;
    const y = typeof v.y === "string" ? v.y.trim().slice(0, 10) : "";
    const r =
      typeof v.r === "number" && Number.isFinite(v.r) && v.r >= 0 && v.r <= 10
        ? v.r
        : v.r === null
          ? null
          : undefined;
    const fb =
      v.fb === "love" || v.fb === "good" || v.fb === "meh" || v.fb === "stop"
        ? v.fb
        : undefined;
    out[k] = {
      s: v.s,
      t,
      y,
      ...(r !== undefined ? { r } : {}),
      ...(fb ? { fb } : {}),
      ...(typeof v.ts === "number" && Number.isFinite(v.ts) ? { ts: v.ts } : {}),
    };
  }
  return out;
}

function sanitizeHistoryArray(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const validStatuses = new Set(["p", "y", "s", "n", "l", "a", "x"]);
  const out: HistoryEntry[] = [];
  for (const item of raw) {
    if (!isPlainRecord(item)) continue;
    if (
      typeof item.k !== "string" ||
      typeof item.t !== "string" ||
      !validStatuses.has(String(item.o))
    ) {
      continue;
    }
    out.push({
      k: item.k.slice(0, 260),
      t: item.t.slice(0, 250),
      y: typeof item.y === "string" ? item.y.slice(0, 10) : "",
      ts: typeof item.ts === "number" && Number.isFinite(item.ts) ? item.ts : Date.now(),
      o: item.o as HistoryEntry["o"],
      e: Boolean(item.e),
    });
  }
  return out.slice(-300);
}

function sanitizeWhyArray(raw: unknown): DiscardWhy[] {
  if (!Array.isArray(raw)) return [];
  const out: DiscardWhy[] = [];
  for (const item of raw) {
    if (!isPlainRecord(item)) continue;
    if (typeof item.k !== "string" || typeof item.t !== "string" || typeof item.w !== "string") {
      continue;
    }
    out.push({
      k: item.k.slice(0, 260),
      t: item.t.slice(0, 250),
      y: typeof item.y === "string" ? item.y.slice(0, 10) : "",
      w: item.w.slice(0, 200),
      ts: typeof item.ts === "number" && Number.isFinite(item.ts) ? item.ts : Date.now(),
    });
  }
  return out.slice(-40);
}

function sanitizeDiaryArray(raw: unknown): DiaryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: DiaryEntry[] = [];
  for (const item of raw) {
    if (!isPlainRecord(item)) continue;
    const t = typeof item.t === "string" ? item.t.trim().slice(0, 250) : "";
    const watchedDate =
      typeof item.watchedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.watchedDate)
        ? item.watchedDate
        : "";
    if (!t || !watchedDate) continue;
    const y = typeof item.y === "string" ? item.y.trim().slice(0, 10) : "";
    const k = typeof item.k === "string" && item.k ? item.k.slice(0, 260) : `${t.toLowerCase()}|${y}`;
    const id = typeof item.id === "string" && item.id ? item.id.slice(0, 280) : `${k}|${watchedDate}`;
    const loggedDate =
      typeof item.loggedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.loggedDate)
        ? item.loggedDate
        : undefined;
    const r =
      typeof item.r === "number" && Number.isFinite(item.r) && item.r >= 0 && item.r <= 10
        ? item.r
        : null;
    const tags = Array.isArray(item.tags)
      ? item.tags
          .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
          .map((tag) => tag.trim().slice(0, 60))
          .slice(0, 20)
      : undefined;
    const letterboxdUrl =
      typeof item.letterboxdUrl === "string"
        ? safeExternalUrl(item.letterboxdUrl, ["letterboxd.com", "boxd.it"]) || undefined
        : undefined;
    const posterUrl =
      typeof item.posterUrl === "string"
        ? safeExternalUrl(item.posterUrl)
        : undefined;

    out.push({
      id,
      k,
      t,
      y,
      watchedDate,
      ...(loggedDate ? { loggedDate } : {}),
      r,
      ...(item.rw ? { rw: true } : {}),
      ...(tags && tags.length ? { tags } : {}),
      ...(letterboxdUrl ? { letterboxdUrl } : {}),
      ...(posterUrl ? { posterUrl } : {}),
    });
  }
  return out;
}

export function sanitizeBackupPayload(
  raw: unknown
): { L: Partial<LibraryState>; D?: Partial<WatchlistDataState> } | null {
  if (!isPlainRecord(raw) || !isPlainRecord(raw.L)) return null;
  const rawL = raw.L;
  const safeL: Partial<LibraryState> = {
    meta: sanitizeMetaMap(rawL.meta),
    marks: sanitizeMarksMap(rawL.marks),
    profile: typeof rawL.profile === "string" ? rawL.profile.slice(0, 12000) : "",
    partner: typeof rawL.partner === "string" ? rawL.partner.slice(0, 4000) : "",
    hist: sanitizeHistoryArray(rawL.hist),
    add: Array.isArray(rawL.add)
      ? rawL.add.map(sanitizeFilmItem).filter((x): x is FilmItem => Boolean(x))
      : [],
    why: sanitizeWhyArray(rawL.why),
    diary: sanitizeDiaryArray(rawL.diary),
    letterboxdUser:
      typeof rawL.letterboxdUser === "string"
        ? rawL.letterboxdUser.trim().replace(/^@/, "").slice(0, 40)
        : "",
    diarySyncedAt:
      typeof rawL.diarySyncedAt === "number" && Number.isFinite(rawL.diarySyncedAt)
        ? rawL.diarySyncedAt
        : 0,
    ts: Date.now(),
  };

  let safeD: Partial<WatchlistDataState> | undefined;
  if (isPlainRecord(raw.D)) {
    const rawD = raw.D;
    safeD = {
      custom: Boolean(rawD.custom),
      ...(Array.isArray(rawD.watch)
        ? {
            watch: rawD.watch
              .map(sanitizeFilmItem)
              .filter((x): x is FilmItem => Boolean(x)),
          }
        : {}),
      ...(Array.isArray(rawD.seen)
        ? {
            seen: rawD.seen
              .map(sanitizeSeenItem)
              .filter((x): x is SeenFilmItem => Boolean(x)),
          }
        : {}),
    };
  }

  return { L: safeL, ...(safeD ? { D: safeD } : {}) };
}

export function loadInitialDataState(): WatchlistDataState {
  const purgeSet = new Set(PURGE_KEYS);
  const baseWatch = EMB.watch
    .filter((x) => !purgeSet.has(filmKey(x)))
    .map((x) => ({ ...x }));
  if (!baseWatch.some((x) => filmKey(x) === "il bell'antonio|1960")) {
    baseWatch.push({ t: "Il bell'Antonio", y: "1960" });
  }
  const baseSeen = EMB.seen.map((x) =>
    filmKey(x) === "they live|1988" ? { ...x, rw: true } : { ...x }
  );

  try {
    const raw = localStorage.getItem(STORAGE_DATA_KEY);
    if (raw) {
      const parsed = safeJsonParse(raw);
      if (isPlainRecord(parsed) && parsed.custom) {
        const watch = Array.isArray(parsed.watch)
          ? parsed.watch
              .map(sanitizeFilmItem)
              .filter((x): x is FilmItem => Boolean(x))
              .filter((x) => !purgeSet.has(filmKey(x)))
          : [];
        const seen = Array.isArray(parsed.seen)
          ? parsed.seen
              .map(sanitizeSeenItem)
              .filter((x): x is SeenFilmItem => Boolean(x))
          : baseSeen;
        return {
          watch,
          seen,
          shown: [],
          shownX: [],
          custom: true,
        };
      }
    }
  } catch {
    // ignore corrupted local storage
  }

  return {
    watch: baseWatch,
    seen: baseSeen,
    shown: [],
    shownX: [],
    custom: false,
  };
}

export function loadInitialLibraryState(): LibraryState {
  const purgeSet = new Set(PURGE_KEYS);
  let lib: LibraryState = {
    meta: { ...SEED.meta },
    marks: { ...SEED.marks },
    profile: SEED.profile || "",
    partner: SEED.partner || "",
    hist: [...(SEED.hist || [])],
    add: [...(SEED.add || [])],
    why: [...(SEED.why || [])],
    diary: [],
    letterboxdUser: "",
    diarySyncedAt: 0,
    ts: SEED.ts || Date.now(),
  };

  let hasStoredLib = false;
  try {
    const raw = localStorage.getItem(STORAGE_LIB_KEY);
    if (raw) {
      const parsed = safeJsonParse(raw);
      if (isPlainRecord(parsed)) {
        hasStoredLib = true;
        lib = {
          meta: isPlainRecord(parsed.meta) ? sanitizeMetaMap(parsed.meta) : lib.meta,
          marks: isPlainRecord(parsed.marks) ? sanitizeMarksMap(parsed.marks) : lib.marks,
          profile: typeof parsed.profile === "string" ? parsed.profile : lib.profile,
          partner: typeof parsed.partner === "string" ? parsed.partner : lib.partner,
          hist: Array.isArray(parsed.hist) ? sanitizeHistoryArray(parsed.hist) : lib.hist,
          add: Array.isArray(parsed.add)
            ? parsed.add.map(sanitizeFilmItem).filter((x): x is FilmItem => Boolean(x))
            : lib.add,
          why: Array.isArray(parsed.why) ? sanitizeWhyArray(parsed.why) : lib.why,
          diary: Array.isArray(parsed.diary) ? sanitizeDiaryArray(parsed.diary) : [],
          letterboxdUser:
            typeof parsed.letterboxdUser === "string" ? parsed.letterboxdUser.slice(0, 40) : "",
          diarySyncedAt:
            typeof parsed.diarySyncedAt === "number" ? parsed.diarySyncedAt : 0,
          ts: typeof parsed.ts === "number" ? parsed.ts : lib.ts,
        };
      }
    }
  } catch {
    // ignore corrupted local storage
  }

  const bad = (v?: string) => !v || v === "null";
  for (const k in FIX_META) {
    const f = FIX_META[k];
    const c = lib.meta[k] || { g: "", m: 0, d: "", c: "" };
    lib.meta[k] = {
      g: bad(c.g) ? f[0] : c.g,
      m: c.m || f[1] || 0,
      d: bad(c.d) ? f[2] : c.d,
      c: bad(c.c) ? f[3] : c.c,
      ...(c.a ? { a: c.a } : {}),
      ...(c.pc ? { pc: true } : {}),
      ...(c.mc ? { mc: true } : {}),
    };
  }
  for (const k of purgeSet) {
    delete lib.meta[k];
  }
  if (lib.add) {
    lib.add = lib.add.filter((x) => !purgeSet.has(filmKey(x)));
  }
  for (const k in OVR_META) {
    const f = OVR_META[k];
    const prev = lib.meta[k];
    lib.meta[k] = {
      g: f[0],
      m: f[1],
      d: f[2],
      c: f[3],
      ...(prev?.a ? { a: prev.a } : {}),
      ...(prev?.pc ? { pc: true } : {}),
      ...(prev?.mc ? { mc: true } : {}),
    };
  }
  const birdKey = "the bird with the crystal plumage|1970";
  if (!hasStoredLib && !lib.marks[birdKey]) {
    lib.marks[birdKey] = {
      s: "seen",
      t: "The Bird with the Crystal Plumage",
      y: "1970",
      r: null,
    };
  }

  return lib;
}

export function persistDataState(data: WatchlistDataState): void {
  try {
    localStorage.setItem(
      STORAGE_DATA_KEY,
      JSON.stringify(data.custom ? data : { shown: data.shown })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function persistLibraryState(lib: LibraryState): void {
  try {
    localStorage.setItem(STORAGE_LIB_KEY, JSON.stringify({ ...lib, ts: Date.now() }));
  } catch {
    // ignore storage quota errors
  }
}
