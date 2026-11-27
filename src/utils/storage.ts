import {
  EMB,
  FIX_META,
  OVR_META,
  PURGE_KEYS,
  SEED,
} from "../data/embeddedLibrary";
import { STORAGE_DATA_KEY, STORAGE_LIB_KEY } from "../constants/filters";
import { filmKey } from "./filmHelpers";
import type { FilmItem, LibraryState, WatchlistDataState } from "../types";

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
      const parsed = JSON.parse(raw);
      if (parsed && parsed.custom) {
        return {
          watch: (parsed.watch || []).filter(
            (x: FilmItem) => !purgeSet.has(filmKey(x))
          ),
          seen: parsed.seen || baseSeen,
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
      const parsed = JSON.parse(raw);
      if (parsed) {
        hasStoredLib = true;
        lib = {
          meta: parsed.meta || lib.meta,
          marks: parsed.marks || lib.marks,
          profile: typeof parsed.profile === "string" ? parsed.profile : lib.profile,
          partner: typeof parsed.partner === "string" ? parsed.partner : lib.partner,
          hist: Array.isArray(parsed.hist) ? parsed.hist : lib.hist,
          add: Array.isArray(parsed.add) ? parsed.add : lib.add,
          why: Array.isArray(parsed.why) ? parsed.why : lib.why,
          diary: Array.isArray(parsed.diary) ? parsed.diary : [],
          letterboxdUser:
            typeof parsed.letterboxdUser === "string" ? parsed.letterboxdUser : "",
          diarySyncedAt:
            typeof parsed.diarySyncedAt === "number" ? parsed.diarySyncedAt : 0,
          ts: parsed.ts || lib.ts,
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
