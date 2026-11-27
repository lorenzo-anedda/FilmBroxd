export interface FilmItem {
  t: string;
  y: string;
  it?: string;
}

export interface SeenFilmItem extends FilmItem {
  r: number | null;
  rw?: number | boolean;
  fb?: OutcomeKey;
}

export interface FilmMeta {
  g: string; // Generi separati da /
  m: number; // Durata in minuti
  d: string; // Regista
  c: string; // Paese in italiano
  a?: string; // Attori principali separati da /
}

export interface FilmMark {
  s: "seen" | "no";
  t: string;
  y: string;
  r?: number | null;
  fb?: OutcomeKey;
  ts?: number;
}

export type OutcomeKey = "love" | "good" | "meh" | "stop";
export type HistoryStatus = "p" | "y" | "s" | "n" | "l" | "a" | "x";

export interface HistoryEntry {
  k: string;
  t: string;
  y: string;
  ts: number;
  o: HistoryStatus;
  e: boolean;
}

export interface DiscardWhy {
  k: string;
  t: string;
  y: string;
  w: string;
  ts: number;
}

export interface LibraryState {
  meta: Record<string, FilmMeta>;
  marks: Record<string, FilmMark>;
  profile: string;
  partner?: string;
  hist?: HistoryEntry[];
  add?: FilmItem[];
  why?: DiscardWhy[];
  ts?: number;
}

export interface WatchlistDataState {
  watch: FilmItem[];
  seen: SeenFilmItem[];
  shown: string[];
  shownX?: string[];
  custom: boolean;
}

export interface RawRecommendation {
  tipo?: "lista" | "extra";
  film: string;
  durata?: string;
  regista?: string;
  perche: string;
}

export interface ActivePick {
  id: string;
  film: FilmItem;
  extra: boolean;
  durata: string;
  regista: string;
  perche: string;
  status: "active" | "done";
  statusMessage?: string;
  askWhy?: boolean;
  whySaved?: string;
  deepWhy?: string;
  deepWhyLoading?: boolean;
  deepWhyOpen?: boolean;
  ratingOpen?: boolean;
  altLoading?: boolean;
  simLoading?: boolean;
}

export interface FilmPreviewData {
  posterUrl: string | null;
  description: string;
  wikiUrl?: string | null;
  loading?: boolean;
}

export type ActiveTab = "serata" | "cinesfida" | "cronologia" | "profilo" | "archivio";
export type RiskMode = "" | "safe" | "bold";
export type EngineMode = "ai" | "local";
