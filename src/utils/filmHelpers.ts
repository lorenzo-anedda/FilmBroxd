import { IT_TITLES } from "../data/embeddedLibrary";
import { COUNTRY_FILTERS, GENRE_FILTERS } from "../constants/filters";
import type {
  FilmItem,
  FilmMeta,
  HistoryEntry,
  HistoryStatus,
  LibraryState,
  SeenFilmItem,
} from "../types";

export const nz = (v?: string | null): boolean => Boolean(v && v !== "null");

export function safeExternalUrl(
  raw?: string | null,
  allowedHosts?: string[]
): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (allowedHosts && allowedHosts.length > 0) {
      const host = parsed.hostname.toLowerCase();
      if (!allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
        return null;
      }
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractLetterboxdFilmSlug(rawUrl?: string | null): string | null {
  const safe = safeExternalUrl(rawUrl, ["letterboxd.com"]);
  if (!safe) return null;
  try {
    const parsed = new URL(safe);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const filmIdx = parts.indexOf("film");
    if (filmIdx >= 0 && parts[filmIdx + 1]) {
      return parts[filmIdx + 1].toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

export const filmKey = (x: { t: string; y?: string }): string =>
  `${(x.t || "").trim()}|${(x.y || "").trim()}`.toLowerCase();

export const normTitle = (s: string): string =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|a|an|il|lo|la|le|gli|i|l|un|uno|una|les|el|los|der|die|das) /, "");

export const itTitle = (x: FilmItem): string => IT_TITLES[filmKey(x)] || x.it || "";

export function canonicalFilmIdentity(x: {
  t: string;
  y?: string;
  it?: string;
}): string {
  const nt = normTitle(x.t);
  const y = (x.y || "").trim();
  return nt ? `${nt}|${y}` : filmKey(x);
}

export type FilmMatchConfidence = "exact" | "possible" | "none";

export interface FilmMatchTarget {
  t: string;
  y?: string;
  it?: string;
  letterboxdUrl?: string;
}

export function buildFilmIdentityMatcher(
  films: ReadonlyArray<FilmMatchTarget>
): {
  match: (candidate: FilmMatchTarget) => FilmMatchConfidence;
} {
  const exactKeys = new Set<string>();
  const normYearMap = new Map<string, Set<string>>();
  const slugYearsMap = new Map<string, Set<string>>();

  const registerTitle = (title: string, year: string) => {
    const nt = normTitle(title);
    if (!nt) return;
    let set = normYearMap.get(nt);
    if (!set) {
      set = new Set<string>();
      normYearMap.set(nt, set);
    }
    set.add(year);
  };

  for (const f of films) {
    const y = (f.y || "").trim();
    exactKeys.add(filmKey({ t: f.t, y }));
    registerTitle(f.t, y);
    const it = itTitle({ t: f.t, y, it: f.it });
    if (it) {
      exactKeys.add(filmKey({ t: it, y }));
      registerTitle(it, y);
    }
    const slug = extractLetterboxdFilmSlug(f.letterboxdUrl);
    if (slug) {
      let sYears = slugYearsMap.get(slug);
      if (!sYears) {
        sYears = new Set<string>();
        slugYearsMap.set(slug, sYears);
      }
      sYears.add(y);
    }
  }

  const checkTitle = (title: string, year: string): FilmMatchConfidence => {
    const k = filmKey({ t: title, y: year });
    if (exactKeys.has(k)) {
      return "exact";
    }
    const nt = normTitle(title);
    const years = nt ? normYearMap.get(nt) : undefined;
    if (!years || years.size === 0) return "none";

    if (year) {
      if (years.has(year)) return "exact";
      const numY = Number(year);
      if (Number.isFinite(numY)) {
        if (years.has(String(numY - 1)) || years.has(String(numY + 1))) {
          return "possible";
        }
      }
      if (years.has("")) return "possible";
      return "none";
    }

    // Candidate has no year: exact only if an existing entry also has no year,
    // otherwise treat as possible (conservative)
    return years.has("") ? "exact" : "possible";
  };

  return {
    match(candidate: FilmMatchTarget): FilmMatchConfidence {
      const y = (candidate.y || "").trim();
      const candSlug = extractLetterboxdFilmSlug(candidate.letterboxdUrl);
      if (candSlug) {
        const knownSlugYears = slugYearsMap.get(candSlug);
        if (knownSlugYears) {
          if (!y || knownSlugYears.has("") || knownSlugYears.has(y)) {
            return "exact";
          }
          // Same Letterboxd slug but conflicting known years: treat conservatively
          return "possible";
        }
      }

      const primary = checkTitle(candidate.t, y);
      if (primary === "exact") return "exact";

      const candIt = candidate.it?.trim();
      if (candIt) {
        const alt = checkTitle(candIt, y);
        if (alt === "exact") return "exact";
        if (primary === "possible" || alt === "possible") return "possible";
      }

      return primary;
    },
  };
}

export const displayTitle = (x: FilmItem): string => itTitle(x) || x.t;

export const canonicalLabel = (x: FilmItem): string =>
  x.t + (x.y ? ` (${x.y})` : "");

export const displayLabel = (x: FilmItem): string =>
  displayTitle(x) + (x.y ? ` (${x.y})` : "");

export function parseFilmTitleString(f: string): FilmItem {
  const m = f.match(/^(.*?)\s*\((\d{4})\)\s*$/);
  return m ? { t: m[1].trim(), y: m[2] } : { t: f.trim(), y: "" };
}

export function isHistoryBlocked(k: string, hist?: HistoryEntry[]): boolean {
  const h = (hist || []).find((z) => z.k === k);
  if (!h) return false;
  if (h.o === "y" || h.o === "s" || h.o === "n") return true;
  if (h.o === "p" && Date.now() - h.ts < 14 * 864e5) return true;
  if (h.o === "l" && Date.now() - h.ts < 7 * 864e5) return true;
  return false;
}

export function upsertHistory(
  hist: HistoryEntry[] | undefined,
  film: FilmItem,
  o: HistoryStatus,
  e: boolean
): HistoryEntry[] {
  const list = [...(hist || [])];
  const k = filmKey(film);
  const i = list.findIndex((h) => h.k === k);
  let ee = Boolean(e);
  if (i >= 0) {
    const old = list[i];
    if (o === "p" && "ysn".includes(old.o)) return list;
    ee = ee || Boolean(old.e);
    list.splice(i, 1);
  }
  list.push({ k, t: film.t, y: film.y || "", ts: Date.now(), o, e: ee });
  if (list.length > 300) list.splice(0, list.length - 300);
  return list;
}

export function getAllSeen(
  seen: SeenFilmItem[],
  marks: Record<string, LibraryState["marks"][string]>
): SeenFilmItem[] {
  const byKey = new Map<string, SeenFilmItem>();
  const normToKey = new Map<string, string>();

  const registerItem = (item: SeenFilmItem, preferUpdate: boolean) => {
    const k = filmKey(item);
    const y = (item.y || "").trim();
    const nt = normTitle(item.t);
    const nk = nt ? `${nt}|${y}` : "";
    const alt = itTitle(item);
    const nAlt = alt ? normTitle(alt) : "";
    const altK = nAlt ? `${nAlt}|${y}` : "";

    const existingKey = byKey.has(k)
      ? k
      : (nk ? normToKey.get(nk) : undefined) ||
        (altK ? normToKey.get(altK) : undefined);

    if (!existingKey) {
      byKey.set(k, { ...item });
      if (nk) normToKey.set(nk, k);
      if (altK) normToKey.set(altK, k);
      return;
    }

    const prev = byKey.get(existingKey)!;
    if (preferUpdate) {
      byKey.set(existingKey, {
        ...prev,
        r: item.r != null ? item.r : prev.r,
        rw: prev.rw || item.rw,
        fb: item.fb || prev.fb,
      });
    }
  };

  for (const s of seen) {
    registerItem(s, true);
  }

  for (const v of Object.values(marks)) {
    if (v.s !== "seen") continue;
    registerItem(
      {
        t: v.t,
        y: v.y,
        r: v.r ?? null,
        fb: v.fb,
      },
      true
    );
  }

  return Array.from(byKey.values());
}

export interface FilterConfig {
  minMinutes: number;
  maxMinutes: number;
  genres: Set<string>;
  countries: Set<string>;
  decades: Set<string>;
}

export function matchesDecade(x: FilmItem, decades: Set<string>): boolean {
  if (!decades.size) return true;
  const y = +x.y;
  if (!y) return true;
  return [...decades].some((r) => {
    const [a, b] = r.split("-");
    return y >= +a && y <= +b;
  });
}

export function matchesCountry(
  x: FilmItem,
  countries: Set<string>,
  meta: Record<string, FilmMeta>
): boolean {
  if (!countries.size) return true;
  const m = meta[filmKey(x)];
  if (!m || !nz(m.c)) return true;
  return [...countries].some((code) => {
    const f = COUNTRY_FILTERS.find((c) => c.value === code);
    return f ? f.regex.test(m.c) : false;
  });
}

export function matchesGenre(
  x: FilmItem,
  genres: Set<string>,
  meta: Record<string, FilmMeta>
): boolean {
  if (!genres.size) return true;
  const m = meta[filmKey(x)];
  if (!m || !nz(m.g)) return true;
  return [...genres].some((code) => {
    const f = GENRE_FILTERS.find((g) => g.value === code);
    return f ? f.regex.test(m.g) : false;
  });
}

export function passesFilters(
  x: FilmItem,
  lib: LibraryState,
  filters: FilterConfig
): boolean {
  const k = filmKey(x);
  if (lib.marks[k] || isHistoryBlocked(k, lib.hist)) return false;
  const m = lib.meta[k];
  if (filters.maxMinutes && m && m.m && m.m > filters.maxMinutes) return false;
  if (filters.minMinutes && m && m.m && m.m < filters.minMinutes) return false;
  return (
    matchesDecade(x, filters.decades) &&
    matchesCountry(x, filters.countries, lib.meta) &&
    matchesGenre(x, filters.genres, lib.meta)
  );
}

export function countUnknownMetadata(
  pool: FilmItem[],
  lib: LibraryState,
  filters: FilterConfig
): number {
  return pool.filter((x) => {
    const m = lib.meta[filmKey(x)];
    return (
      (filters.countries.size && (!m || !nz(m.c))) ||
      (filters.genres.size && (!m || !nz(m.g))) ||
      ((filters.maxMinutes > 0 || filters.minMinutes > 0) && (!m || !m.m))
    );
  }).length;
}
