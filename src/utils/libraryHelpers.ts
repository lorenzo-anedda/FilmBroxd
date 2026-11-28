import { DECADE_FILTERS } from "../constants/filters";
import {
  canonicalFilmIdentity,
  displayTitle,
  filmKey,
  itTitle,
  normTitle,
  nz,
} from "./filmHelpers";
import type { FilmItem, FilmMeta, SeenFilmItem } from "../types";

export type LibraryTab = "watchlist" | "watched";
export type LibraryViewMode = "grid" | "list";
export type LibrarySortKey =
  | "title-asc"
  | "title-desc"
  | "year-asc"
  | "year-desc"
  | "runtime-asc"
  | "runtime-desc"
  | "rating-desc"
  | "rating-asc";

export type LibraryDurationBucket = "" | "short" | "standard" | "long" | "missing";

export type LibraryRatingFilter =
  | ""
  | "top"
  | "high"
  | "mid"
  | "low"
  | "unrated";

export interface LibraryFilterState {
  search: string;
  genre: string;
  director: string;
  country: string;
  decade: string;
  duration: LibraryDurationBucket;
  rating: LibraryRatingFilter;
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilterState = {
  search: "",
  genre: "",
  director: "",
  country: "",
  decade: "",
  duration: "",
  rating: "",
};

export interface LibraryEntry {
  id: string;
  key: string;
  film: FilmItem;
  title: string;
  originalTitle: string;
  italianTitle: string;
  year: string;
  yearNum: number | null;
  status: LibraryTab;
  rating: number | null;
  rewatch: boolean;
  meta?: FilmMeta;
  director: string;
  directors: string[];
  genres: string[];
  countries: string[];
  cast: string[];
  runtime: number | null;
  decadeValue: string;
  searchOriginal: string;
  searchItalian: string;
  searchDisplay: string;
}

export interface LibraryCollection {
  watchlist: LibraryEntry[];
  watched: LibraryEntry[];
  scaleMax: 5 | 10;
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface LibraryFacetOptions {
  genres: FacetOption[];
  directors: FacetOption[];
  countries: FacetOption[];
  decades: FacetOption[];
  missingGenreCount: number;
  missingDirectorCount: number;
  missingCountryCount: number;
  missingYearCount: number;
  missingRuntimeCount: number;
  unratedCount: number;
}

export function normalizeSearchText(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitMetaList(raw?: string | null): string[] {
  if (!nz(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw).split(/[/,]/)) {
    const clean = part.trim();
    if (!clean || clean.toLowerCase() === "null") continue;
    const norm = clean.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(clean);
  }
  return out;
}

function scoreMetaCompleteness(meta?: FilmMeta): number {
  if (!meta) return 0;
  let score = 0;
  if (nz(meta.g)) score += 2;
  if (meta.m > 0) score += 2;
  if (nz(meta.d)) score += 2;
  if (nz(meta.c)) score += 1;
  if (nz(meta.a)) score += 1;
  return score;
}

export function buildMetaIndex(
  meta: Record<string, FilmMeta>
): (film: FilmItem) => FilmMeta | undefined {
  const byCanon = new Map<string, FilmMeta>();

  for (const [rawKey, value] of Object.entries(meta)) {
    if (!value) continue;
    const sepIdx = rawKey.lastIndexOf("|");
    const t = sepIdx >= 0 ? rawKey.slice(0, sepIdx) : rawKey;
    const y = sepIdx >= 0 ? rawKey.slice(sepIdx + 1) : "";
    const canon = canonicalFilmIdentity({ t, y });
    const prev = byCanon.get(canon);
    if (!prev || scoreMetaCompleteness(value) > scoreMetaCompleteness(prev)) {
      byCanon.set(canon, value);
    }
  }

  return (film: FilmItem): FilmMeta | undefined => {
    const direct = meta[filmKey(film)];
    const canonMatch = byCanon.get(canonicalFilmIdentity(film));
    const it = itTitle(film);
    const itDirect = it ? meta[filmKey({ t: it, y: film.y })] : undefined;
    const itCanon = it
      ? byCanon.get(canonicalFilmIdentity({ t: it, y: film.y }))
      : undefined;

    const candidates = [direct, canonMatch, itDirect, itCanon].filter(
      (m): m is FilmMeta => Boolean(m)
    );
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];

    let best = candidates[0];
    let bestScore = scoreMetaCompleteness(best);
    for (let i = 1; i < candidates.length; i++) {
      const sc = scoreMetaCompleteness(candidates[i]);
      if (sc > bestScore) {
        best = candidates[i];
        bestScore = sc;
      }
    }
    return best;
  };
}

function getDecadeValue(yearNum: number | null): string {
  if (yearNum == null) return "";
  for (const dec of DECADE_FILTERS) {
    const [aStr, bStr] = dec.value.split("-");
    const a = Number(aStr);
    const b = Number(bStr);
    if (yearNum >= a && yearNum <= b) return dec.value;
  }
  return "";
}

function getFilmIdentityKeys(film: FilmItem): string[] {
  const y = (film.y || "").trim();
  const keys = new Set<string>();
  const fk = filmKey({ t: film.t, y });
  if (fk) keys.add(fk);

  const nt = normTitle(film.t);
  if (nt) keys.add(`${nt}|${y}`);

  const it = itTitle(film);
  if (it) {
    const itFk = filmKey({ t: it, y });
    if (itFk) keys.add(itFk);
    const nIt = normTitle(it);
    if (nIt) keys.add(`${nIt}|${y}`);
  }

  return Array.from(keys);
}

function toLibraryEntry(
  film: FilmItem,
  status: LibraryTab,
  resolveMeta: (film: FilmItem) => FilmMeta | undefined,
  rating: number | null,
  rewatch: boolean
): LibraryEntry {
  const y = (film.y || "").trim();
  const parsedY = /^\d{4}$/.test(y) ? Number(y) : NaN;
  const yearNum =
    Number.isFinite(parsedY) && parsedY >= 1880 && parsedY <= 2100
      ? parsedY
      : null;

  const meta = resolveMeta(film);
  const italian = itTitle(film);
  const title = displayTitle(film);
  const directors = splitMetaList(meta?.d);
  const genres = splitMetaList(meta?.g);
  const countries = splitMetaList(meta?.c);
  const cast = splitMetaList(meta?.a);
  const runtime =
    meta && typeof meta.m === "number" && Number.isFinite(meta.m) && meta.m > 0
      ? Math.round(meta.m)
      : null;

  return {
    id: `${status}:${canonicalFilmIdentity(film)}`,
    key: filmKey({ t: film.t, y }),
    film: {
      t: film.t,
      y,
      ...(italian && !film.it ? { it: italian } : film.it ? { it: film.it } : {}),
    },
    title,
    originalTitle: film.t,
    italianTitle: italian,
    year: y,
    yearNum,
    status,
    rating: rating != null && Number.isFinite(rating) && rating > 0 ? rating : null,
    rewatch,
    meta,
    director: directors.join(", "),
    directors,
    genres,
    countries,
    cast,
    runtime,
    decadeValue: getDecadeValue(yearNum),
    searchOriginal: normalizeSearchText(film.t),
    searchItalian: normalizeSearchText(italian),
    searchDisplay: normalizeSearchText(title),
  };
}

export function buildLibraryCollection(
  fullWatchlist: FilmItem[],
  allSeen: SeenFilmItem[],
  meta: Record<string, FilmMeta>
): LibraryCollection {
  const resolveMeta = buildMetaIndex(meta);

  // 1. Deduplicate watched films strictly by exact title+year identity (no +/-1 year merge)
  const watchedEntries: LibraryEntry[] = [];
  const watchedIndexByIdKey = new Map<string, number>();

  for (const item of allSeen) {
    const idKeys = getFilmIdentityKeys(item);
    let existingIdx: number | undefined;
    for (const k of idKeys) {
      const hit = watchedIndexByIdKey.get(k);
      if (hit !== undefined) {
        existingIdx = hit;
        break;
      }
    }

    if (existingIdx !== undefined) {
      const prev = watchedEntries[existingIdx];
      const nextRating =
        prev.rating != null
          ? prev.rating
          : item.r != null && Number.isFinite(item.r) && item.r > 0
            ? item.r
            : null;
      const nextRewatch = prev.rewatch || Boolean(item.rw);
      if (nextRating !== prev.rating || nextRewatch !== prev.rewatch) {
        watchedEntries[existingIdx] = {
          ...prev,
          rating: nextRating,
          rewatch: nextRewatch,
        };
      }
      for (const k of idKeys) {
        watchedIndexByIdKey.set(k, existingIdx);
      }
      continue;
    }

    const entry = toLibraryEntry(
      item,
      "watched",
      resolveMeta,
      item.r ?? null,
      Boolean(item.rw)
    );
    const idx = watchedEntries.length;
    watchedEntries.push(entry);
    for (const k of idKeys) {
      watchedIndexByIdKey.set(k, idx);
    }
  }

  // 2. Deduplicate watchlist films, excluding any exact match already in watched
  const watchlistEntries: LibraryEntry[] = [];
  const watchlistSeenIdKeys = new Set<string>();

  for (const item of fullWatchlist) {
    const idKeys = getFilmIdentityKeys(item);
    if (idKeys.some((k) => watchedIndexByIdKey.has(k))) {
      continue;
    }
    if (idKeys.some((k) => watchlistSeenIdKeys.has(k))) {
      continue;
    }

    watchlistEntries.push(toLibraryEntry(item, "watchlist", resolveMeta, null, false));
    for (const k of idKeys) {
      watchlistSeenIdKeys.add(k);
    }
  }

  let maxRating = 0;
  for (const entry of watchedEntries) {
    if (entry.rating != null && entry.rating > maxRating) {
      maxRating = entry.rating;
    }
  }
  const scaleMax: 5 | 10 = maxRating > 5 ? 10 : 5;

  return {
    watchlist: watchlistEntries,
    watched: watchedEntries,
    scaleMax,
  };
}

export function extractLibraryFilterOptions(
  entries: LibraryEntry[]
): LibraryFacetOptions {
  const genreCounts = new Map<string, { label: string; count: number }>();
  const directorCounts = new Map<string, { label: string; count: number }>();
  const countryCounts = new Map<string, { label: string; count: number }>();
  const decadeCounts = new Map<string, number>();

  let missingGenreCount = 0;
  let missingDirectorCount = 0;
  let missingCountryCount = 0;
  let missingYearCount = 0;
  let missingRuntimeCount = 0;
  let unratedCount = 0;

  const incFacet = (
    map: Map<string, { label: string; count: number }>,
    label: string
  ) => {
    const k = label.toLowerCase();
    const prev = map.get(k);
    if (prev) {
      prev.count += 1;
    } else {
      map.set(k, { label, count: 1 });
    }
  };

  for (const entry of entries) {
    if (entry.genres.length === 0) missingGenreCount += 1;
    else for (const g of entry.genres) incFacet(genreCounts, g);

    if (entry.directors.length === 0) missingDirectorCount += 1;
    else for (const d of entry.directors) incFacet(directorCounts, d);

    if (entry.countries.length === 0) missingCountryCount += 1;
    else for (const c of entry.countries) incFacet(countryCounts, c);

    if (!entry.decadeValue) missingYearCount += 1;
    else decadeCounts.set(entry.decadeValue, (decadeCounts.get(entry.decadeValue) || 0) + 1);

    if (entry.runtime == null) missingRuntimeCount += 1;
    if (entry.rating == null) unratedCount += 1;
  }

  const toSortedAlpha = (
    map: Map<string, { label: string; count: number }>
  ): FacetOption[] =>
    Array.from(map.values())
      .map((v) => ({ value: v.label.toLowerCase(), label: v.label, count: v.count }))
      .sort((a, b) => a.label.localeCompare(b.label, "it", { sensitivity: "base" }));

  const toSortedByCountThenAlpha = (
    map: Map<string, { label: string; count: number }>
  ): FacetOption[] =>
    Array.from(map.values())
      .map((v) => ({ value: v.label.toLowerCase(), label: v.label, count: v.count }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.label.localeCompare(b.label, "it", { sensitivity: "base" })
      );

  const decades: FacetOption[] = DECADE_FILTERS.filter(
    (d) => (decadeCounts.get(d.value) || 0) > 0
  ).map((d) => ({
    value: d.value,
    label: d.label,
    count: decadeCounts.get(d.value) || 0,
  }));

  return {
    genres: toSortedAlpha(genreCounts),
    directors: toSortedByCountThenAlpha(directorCounts),
    countries: toSortedAlpha(countryCounts),
    decades,
    missingGenreCount,
    missingDirectorCount,
    missingCountryCount,
    missingYearCount,
    missingRuntimeCount,
    unratedCount,
  };
}

function matchesRatingFilter(
  rating: number | null,
  filter: LibraryRatingFilter,
  scaleMax: 5 | 10
): boolean {
  if (!filter) return true;
  if (filter === "unrated") return rating == null;
  if (rating == null) return false;
  const topThreshold = scaleMax === 10 ? 9 : 4.5;
  const highThreshold = scaleMax === 10 ? 8 : 4;
  const midThreshold = scaleMax === 10 ? 6 : 3;

  switch (filter) {
    case "top":
      return rating >= topThreshold;
    case "high":
      return rating >= highThreshold;
    case "mid":
      return rating >= midThreshold;
    case "low":
      return rating < midThreshold;
    default:
      return true;
  }
}

export function filterLibraryItems(
  entries: LibraryEntry[],
  filters: LibraryFilterState,
  tab: LibraryTab,
  scaleMax: 5 | 10
): LibraryEntry[] {
  const q = normalizeSearchText(filters.search);
  const genreTarget = filters.genre.toLowerCase();
  const directorTarget = filters.director.toLowerCase();
  const countryTarget = filters.country.toLowerCase();

  return entries.filter((entry) => {
    if (q) {
      const hit =
        entry.searchOriginal.includes(q) ||
        entry.searchItalian.includes(q) ||
        entry.searchDisplay.includes(q);
      if (!hit) return false;
    }

    if (genreTarget) {
      if (genreTarget === "__missing__") {
        if (entry.genres.length > 0) return false;
      } else if (!entry.genres.some((g) => g.toLowerCase() === genreTarget)) {
        return false;
      }
    }

    if (directorTarget) {
      if (directorTarget === "__missing__") {
        if (entry.directors.length > 0) return false;
      } else if (!entry.directors.some((d) => d.toLowerCase() === directorTarget)) {
        return false;
      }
    }

    if (countryTarget) {
      if (countryTarget === "__missing__") {
        if (entry.countries.length > 0) return false;
      } else if (!entry.countries.some((c) => c.toLowerCase() === countryTarget)) {
        return false;
      }
    }

    if (filters.decade) {
      if (filters.decade === "__missing__") {
        if (entry.decadeValue) return false;
      } else if (entry.decadeValue !== filters.decade) {
        return false;
      }
    }

    if (filters.duration) {
      const m = entry.runtime;
      if (filters.duration === "missing") {
        if (m != null) return false;
      } else {
        if (m == null) return false;
        if (filters.duration === "short" && m > 90) return false;
        if (filters.duration === "standard" && (m <= 90 || m > 130)) return false;
        if (filters.duration === "long" && m <= 130) return false;
      }
    }

    if (tab === "watched" && filters.rating) {
      if (!matchesRatingFilter(entry.rating, filters.rating, scaleMax)) {
        return false;
      }
    }

    return true;
  });
}

function compareTitleDeterministic(a: LibraryEntry, b: LibraryEntry): number {
  const titleCmp = a.title.localeCompare(b.title, "it", { sensitivity: "base" });
  if (titleCmp !== 0) return titleCmp;
  if (a.yearNum != null && b.yearNum != null && a.yearNum !== b.yearNum) {
    return a.yearNum - b.yearNum;
  }
  if (a.yearNum != null && b.yearNum == null) return -1;
  if (a.yearNum == null && b.yearNum != null) return 1;
  return a.key.localeCompare(b.key);
}

function compareNullableNumber(
  aVal: number | null,
  bVal: number | null,
  direction: "asc" | "desc",
  a: LibraryEntry,
  b: LibraryEntry
): number {
  if (aVal == null && bVal == null) return compareTitleDeterministic(a, b);
  if (aVal == null) return 1; // Missing values always at the end
  if (bVal == null) return -1;
  if (aVal !== bVal) {
    return direction === "asc" ? aVal - bVal : bVal - aVal;
  }
  return compareTitleDeterministic(a, b);
}

export function sortLibraryItems(
  entries: LibraryEntry[],
  sortKey: LibrarySortKey
): LibraryEntry[] {
  const copy = [...entries];
  copy.sort((a, b) => {
    switch (sortKey) {
      case "title-asc":
        return compareTitleDeterministic(a, b);
      case "title-desc": {
        const titleCmp = b.title.localeCompare(a.title, "it", {
          sensitivity: "base",
        });
        if (titleCmp !== 0) return titleCmp;
        return compareNullableNumber(a.yearNum, b.yearNum, "desc", a, b);
      }
      case "year-asc":
        return compareNullableNumber(a.yearNum, b.yearNum, "asc", a, b);
      case "year-desc":
        return compareNullableNumber(a.yearNum, b.yearNum, "desc", a, b);
      case "runtime-asc":
        return compareNullableNumber(a.runtime, b.runtime, "asc", a, b);
      case "runtime-desc":
        return compareNullableNumber(a.runtime, b.runtime, "desc", a, b);
      case "rating-asc":
        return compareNullableNumber(a.rating, b.rating, "asc", a, b);
      case "rating-desc":
        return compareNullableNumber(a.rating, b.rating, "desc", a, b);
      default:
        return compareTitleDeterministic(a, b);
    }
  });
  return copy;
}

export function formatPersonalRating(
  rating: number | null,
  scaleMax: 5 | 10
): string {
  if (rating == null || !Number.isFinite(rating) || rating <= 0) return "";
  const formatted = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
  return scaleMax === 10 ? `${formatted}/10` : `${formatted}/5`;
}

export function countActiveLibraryFilters(
  filters: LibraryFilterState,
  tab: LibraryTab
): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.genre) count += 1;
  if (filters.director) count += 1;
  if (filters.country) count += 1;
  if (filters.decade) count += 1;
  if (filters.duration) count += 1;
  if (tab === "watched" && filters.rating) count += 1;
  return count;
}
