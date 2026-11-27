import { filmKey } from "./filmHelpers";
import { shortlistPool } from "./recommender";
import type { FilmItem, LibraryState, SeenFilmItem } from "../types";

export type TournamentSource =
  | "watchlist_taste"
  | "watchlist_random"
  | "seen_cult";

export type BracketSize = 8 | 16;

export interface BracketMatch {
  id: string;
  round: number;
  index: number;
  a: FilmItem | null;
  b: FilmItem | null;
  winner: FilmItem | null;
}

export interface ChampionDefeatStep {
  roundName: string;
  opponent: FilmItem;
}

export function getRoundNames(roundCount: number): readonly string[] {
  return roundCount === 3
    ? ["Quarti di finale", "Semifinali", "Finale"]
    : ["Ottavi di finale", "Quarti di finale", "Semifinali", "Finale"];
}

export function getRoundShortNames(roundCount: number): readonly string[] {
  return roundCount === 3
    ? ["Quarti", "Semifinali", "Finale"]
    : ["Ottavi", "Quarti", "Semifinali", "Finale"];
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dedupeFilms(items: FilmItem[]): FilmItem[] {
  const seen = new Set<string>();
  const out: FilmItem[] = [];
  for (const item of items) {
    const k = filmKey(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

export function pickContenders(
  source: TournamentSource,
  count: BracketSize,
  watchlistPool: FilmItem[],
  allSeen: SeenFilmItem[],
  lib: LibraryState
): FilmItem[] {
  const cleanWatch = dedupeFilms(
    watchlistPool.filter((x) => !lib.marks[filmKey(x)])
  );

  if (source === "watchlist_taste") {
    const topCandidates = shortlistPool(
      cleanWatch,
      allSeen,
      lib,
      new Set(),
      Math.max(36, count * 2)
    );
    const picked = shuffleArray(topCandidates).slice(0, count);
    if (picked.length < count) {
      const used = new Set(picked.map(filmKey));
      const rest = shuffleArray(
        cleanWatch.filter((x) => !used.has(filmKey(x)))
      );
      return picked.concat(rest).slice(0, count);
    }
    return picked;
  }

  if (source === "seen_cult") {
    const uniqueSeen = dedupeFilms(allSeen) as SeenFilmItem[];
    const ratedTop = uniqueSeen
      .filter((x) => x.r != null && x.r > 0)
      .sort((a, b) => (b.r || 0) - (a.r || 0))
      .slice(0, 48);
    const pool = ratedTop.length >= count ? ratedTop : uniqueSeen;
    return shuffleArray(pool).slice(0, count);
  }

  return shuffleArray(cleanWatch).slice(0, count);
}

export function createBracket(
  films: FilmItem[],
  size: BracketSize
): BracketMatch[][] {
  const firstMatchCount = size / 2;
  const r0: BracketMatch[] = [];
  for (let i = 0; i < firstMatchCount; i++) {
    r0.push({
      id: `r0-m${i}`,
      round: 0,
      index: i,
      a: films[i * 2] || null,
      b: films[i * 2 + 1] || null,
      winner: null,
    });
  }

  const rounds: BracketMatch[][] = [r0];
  let matchCount = firstMatchCount / 2;
  let rIdx = 1;
  while (matchCount >= 1) {
    rounds.push(
      Array.from({ length: matchCount }, (_, i) => ({
        id: `r${rIdx}-m${i}`,
        round: rIdx,
        index: i,
        a: null,
        b: null,
        winner: null,
      }))
    );
    matchCount = Math.floor(matchCount / 2);
    rIdx += 1;
  }

  return rounds;
}

export function cloneBracketWithWinner(
  rounds: BracketMatch[][],
  roundIdx: number,
  matchIdx: number,
  winner: FilmItem
): BracketMatch[][] {
  const next = rounds.map((round) => round.map((m) => ({ ...m })));
  next[roundIdx][matchIdx].winner = winner;

  if (roundIdx < next.length - 1) {
    const targetMatch = next[roundIdx + 1][Math.floor(matchIdx / 2)];
    if (matchIdx % 2 === 0) {
      targetMatch.a = winner;
    } else {
      targetMatch.b = winner;
    }
  }

  return next;
}

export function findNextPlayableMatch(
  rounds: BracketMatch[][]
): { roundIdx: number; matchIdx: number } | null {
  for (let r = 0; r < rounds.length; r++) {
    for (let m = 0; m < rounds[r].length; m++) {
      const match = rounds[r][m];
      if (match.a && match.b && !match.winner) {
        return { roundIdx: r, matchIdx: m };
      }
    }
  }
  return null;
}

export function countCompletedMatches(rounds: BracketMatch[][]): number {
  let count = 0;
  for (const round of rounds) {
    for (const m of round) {
      if (m.winner) count += 1;
    }
  }
  return count;
}

export function getChampionPath(
  rounds: BracketMatch[][],
  champion: FilmItem
): ChampionDefeatStep[] {
  const champKey = filmKey(champion);
  const roundNames = getRoundNames(rounds.length);
  const path: ChampionDefeatStep[] = [];
  for (let r = 0; r < rounds.length; r++) {
    for (const m of rounds[r]) {
      if (m.winner && filmKey(m.winner) === champKey && m.a && m.b) {
        const opp = filmKey(m.a) === champKey ? m.b : m.a;
        path.push({
          roundName: roundNames[r],
          opponent: opp,
        });
      }
    }
  }
  return path;
}
