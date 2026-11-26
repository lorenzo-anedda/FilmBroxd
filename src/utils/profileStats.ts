import { displayTitle, filmKey, nz } from "./filmHelpers";
import type { FilmMeta, SeenFilmItem } from "../types";

export interface RatingBucket {
  value: number;
  label: string;
  count: number;
  pct: number;
}

export interface DecadeStat {
  key: string;
  label: string;
  order: number;
  count: number;
  ratedCount: number;
  avgRating: number | null;
  pctOfMax: number;
}

export interface PersonStat {
  name: string;
  count: number;
  ratedCount: number;
  avgRating: number | null;
  affinityScore: number;
  topFilms: string[];
  pctOfMaxCount: number;
}

export interface ProfileStatsSummary {
  totalSeen: number;
  ratedCount: number;
  avgRating: number | null;
  rewatchesCount: number;
  scaleMax: 5 | 10;
  ratingBuckets: RatingBucket[];
  peakRatingBucket: RatingBucket | null;
  decades: DecadeStat[];
  mostWatchedDecade: DecadeStat | null;
  highestRatedDecade: DecadeStat | null;
  directorsByCount: PersonStat[];
  directorsByLove: PersonStat[];
  actorsByCount: PersonStat[];
  actorsByLove: PersonStat[];
  seenWithDirector: number;
  seenWithActors: number;
  missingPeopleFilms: SeenFilmItem[];
}

interface PersonAccumulator {
  name: string;
  count: number;
  ratedCount: number;
  ratingSum: number;
  films: Array<{ title: string; rating: number }>;
}

function splitPeopleNames(raw?: string): string[] {
  if (!nz(raw)) return [];
  return String(raw)
    .split(/[\/,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && part.toLowerCase() !== "null");
}

function getDecadeInfo(yearStr?: string): { key: string; label: string; order: number } | null {
  const y = Number(yearStr);
  if (!Number.isFinite(y) || y < 1880 || y > 2100) return null;
  if (y < 1960) {
    return { key: "pre1960", label: "≤ '50s", order: 1950 };
  }
  const d = Math.floor(y / 10) * 10;
  const label = d >= 2000 ? `${d}s` : `'${String(d).slice(2)}s`;
  return { key: String(d), label, order: d };
}

function finalizePeople(
  map: Map<string, PersonAccumulator>,
  limit: number,
  mode: "count" | "love",
  scaleMax: 5 | 10
): PersonStat[] {
  const mid = scaleMax === 5 ? 3.2 : 6.4;
  const all = Array.from(map.values()).map((acc) => {
    const avgRating =
      acc.ratedCount > 0 ? acc.ratingSum / acc.ratedCount : null;
    // Bayesian-smoothed score rewarding both consistency (count) and high votes
    const smoothedAvg =
      ((avgRating ?? mid) * acc.ratedCount + mid * 1.5) /
      (acc.ratedCount + 1.5);
    const affinityScore =
      smoothedAvg * 2 + Math.min(acc.count, 8) * (scaleMax === 5 ? 0.35 : 0.7);
    const topFilms = [...acc.films]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 2)
      .map((f) => f.title);

    return {
      name: acc.name,
      count: acc.count,
      ratedCount: acc.ratedCount,
      avgRating,
      affinityScore,
      topFilms,
      pctOfMaxCount: 0,
    };
  });

  const sorted =
    mode === "love"
      ? [...all].sort((a, b) => {
          const aMin = a.count >= 2 ? 1 : 0;
          const bMin = b.count >= 2 ? 1 : 0;
          if (bMin !== aMin) return bMin - aMin;
          if (Math.abs(b.affinityScore - a.affinityScore) > 0.05) {
            return b.affinityScore - a.affinityScore;
          }
          return b.count - a.count || a.name.localeCompare(b.name);
        })
      : [...all].sort(
          (a, b) =>
            b.count - a.count ||
            (b.avgRating ?? 0) - (a.avgRating ?? 0) ||
            a.name.localeCompare(b.name)
        );

  const sliced = sorted.slice(0, limit);
  const maxCount = Math.max(1, ...sliced.map((p) => p.count));
  return sliced.map((p) => ({
    ...p,
    pctOfMaxCount: Math.max(8, Math.round((p.count / maxCount) * 100)),
  }));
}

export function computeProfileStats(
  rawSeen: SeenFilmItem[],
  meta: Record<string, FilmMeta>
): ProfileStatsSummary {
  // Deduplicate by normalized filmKey while keeping the entry with rating/rewatch info
  const uniqueMap = new Map<string, SeenFilmItem>();
  for (const item of rawSeen) {
    const k = filmKey(item);
    const existing = uniqueMap.get(k);
    if (!existing || (existing.r == null && item.r != null)) {
      uniqueMap.set(k, item);
    }
  }
  const seen = Array.from(uniqueMap.values());

  const ratedValues = seen
    .map((x) => x.r)
    .filter((r): r is number => r != null && Number.isFinite(r) && r > 0);
  const scaleMax: 5 | 10 =
    ratedValues.length && Math.max(...ratedValues) > 5 ? 10 : 5;

  const avgRating = ratedValues.length
    ? ratedValues.reduce((sum, v) => sum + v, 0) / ratedValues.length
    : null;

  const rewatchesCount = seen.filter((x) => Boolean(x.rw)).length;

  // Rating buckets
  const stepValues =
    scaleMax === 5
      ? [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const bucketCounts = new Map<number, number>(
    stepValues.map((v) => [v, 0])
  );

  for (const v of ratedValues) {
    const snapped =
      scaleMax === 5
        ? Math.min(5, Math.max(0.5, Math.round(v * 2) / 2))
        : Math.min(10, Math.max(1, Math.round(v)));
    bucketCounts.set(snapped, (bucketCounts.get(snapped) || 0) + 1);
  }

  const maxBucketCount = Math.max(1, ...Array.from(bucketCounts.values()));
  const ratingBuckets: RatingBucket[] = stepValues.map((v) => {
    const count = bucketCounts.get(v) || 0;
    const label = scaleMax === 5 ? `${v}` : `${v}`;
    return {
      value: v,
      label,
      count,
      pct: count > 0 ? Math.max(6, Math.round((count / maxBucketCount) * 100)) : 0,
    };
  });

  const peakRatingBucket =
    ratedValues.length > 0
      ? [...ratingBuckets].sort(
          (a, b) => b.count - a.count || b.value - a.value
        )[0]
      : null;

  // Decades & People accumulation
  const decadeMap = new Map<
    string,
    { key: string; label: string; order: number; count: number; ratedCount: number; ratingSum: number }
  >();
  const directorMap = new Map<string, PersonAccumulator>();
  const actorMap = new Map<string, PersonAccumulator>();

  let seenWithDirector = 0;
  let seenWithActors = 0;
  const missingPeopleFilms: SeenFilmItem[] = [];

  for (const film of seen) {
    const dec = getDecadeInfo(film.y);
    if (dec) {
      const prev = decadeMap.get(dec.key) || {
        ...dec,
        count: 0,
        ratedCount: 0,
        ratingSum: 0,
      };
      prev.count += 1;
      if (film.r != null && film.r > 0) {
        prev.ratedCount += 1;
        prev.ratingSum += film.r;
      }
      decadeMap.set(dec.key, prev);
    }

    const k = filmKey(film);
    const m = meta[k];
    const directors = splitPeopleNames(m?.d);
    const actors = splitPeopleNames(m?.a);

    if (directors.length > 0) seenWithDirector += 1;
    if (actors.length > 0) seenWithActors += 1;
    if (directors.length === 0 || actors.length === 0) {
      missingPeopleFilms.push(film);
    }

    const title = displayTitle(film);
    const ratingVal = film.r ?? 0;

    for (const dir of directors) {
      const normKey = dir.toLowerCase();
      const prev = directorMap.get(normKey) || {
        name: dir,
        count: 0,
        ratedCount: 0,
        ratingSum: 0,
        films: [],
      };
      prev.count += 1;
      if (film.r != null && film.r > 0) {
        prev.ratedCount += 1;
        prev.ratingSum += film.r;
      }
      prev.films.push({ title, rating: ratingVal });
      directorMap.set(normKey, prev);
    }

    for (const actor of actors) {
      const normKey = actor.toLowerCase();
      const prev = actorMap.get(normKey) || {
        name: actor,
        count: 0,
        ratedCount: 0,
        ratingSum: 0,
        films: [],
      };
      prev.count += 1;
      if (film.r != null && film.r > 0) {
        prev.ratedCount += 1;
        prev.ratingSum += film.r;
      }
      prev.films.push({ title, rating: ratingVal });
      actorMap.set(normKey, prev);
    }
  }

  // Prioritize highest-rated and newest missing films first so initial enrichment batches populate favorites right away
  missingPeopleFilms.sort(
    (a, b) =>
      (b.r ?? 0) - (a.r ?? 0) ||
      (Number(b.y) || 0) - (Number(a.y) || 0)
  );

  const maxDecadeCount = Math.max(
    1,
    ...Array.from(decadeMap.values()).map((d) => d.count)
  );

  const decades: DecadeStat[] = Array.from(decadeMap.values())
    .sort((a, b) => a.order - b.order)
    .map((d) => ({
      key: d.key,
      label: d.label,
      order: d.order,
      count: d.count,
      ratedCount: d.ratedCount,
      avgRating: d.ratedCount > 0 ? d.ratingSum / d.ratedCount : null,
      pctOfMax: Math.max(6, Math.round((d.count / maxDecadeCount) * 100)),
    }));

  const mostWatchedDecade =
    decades.length > 0
      ? [...decades].sort((a, b) => b.count - a.count)[0]
      : null;

  const eligibleRatedDecades = decades.filter((d) => d.ratedCount >= 5);
  const fallbackRatedDecades =
    eligibleRatedDecades.length > 0
      ? eligibleRatedDecades
      : decades.filter((d) => d.ratedCount >= 1 && d.avgRating != null);

  const highestRatedDecade =
    fallbackRatedDecades.length > 0
      ? [...fallbackRatedDecades].sort(
          (a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.count - a.count
        )[0]
      : null;

  return {
    totalSeen: seen.length,
    ratedCount: ratedValues.length,
    avgRating,
    rewatchesCount,
    scaleMax,
    ratingBuckets,
    peakRatingBucket,
    decades,
    mostWatchedDecade,
    highestRatedDecade,
    directorsByCount: finalizePeople(directorMap, 8, "count", scaleMax),
    directorsByLove: finalizePeople(directorMap, 8, "love", scaleMax),
    actorsByCount: finalizePeople(actorMap, 8, "count", scaleMax),
    actorsByLove: finalizePeople(actorMap, 8, "love", scaleMax),
    seenWithDirector,
    seenWithActors,
    missingPeopleFilms,
  };
}
