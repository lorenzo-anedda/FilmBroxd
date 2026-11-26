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

export const filmKey = (x: { t: string; y?: string }): string =>
  `${x.t}|${x.y || ""}`.toLowerCase();

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
  const markSeen: SeenFilmItem[] = Object.values(marks)
    .filter((v) => v.s === "seen")
    .map((v) => ({
      t: v.t,
      y: v.y,
      r: v.r ?? null,
      fb: v.fb,
    }));
  return seen.concat(markSeen);
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
