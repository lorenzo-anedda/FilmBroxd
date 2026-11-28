import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EMB, SEED } from "../src/data/embeddedLibrary";
import { getAllSeen } from "../src/utils/filmHelpers";
import {
  buildLibraryCollection,
  DEFAULT_LIBRARY_FILTERS,
  extractLibraryFilterOptions,
  filterLibraryItems,
  sortLibraryItems,
  type LibraryEntry,
} from "../src/utils/libraryHelpers";
import {
  LibraryPreviewQueue,
  type PreviewFetcher,
} from "../src/hooks/useLibraryPreviews";
import { HeaderBar } from "../src/components/HeaderBar";
import { LibraryView, LIBRARY_PAGE_SIZE } from "../src/components/LibraryView";
import { LibraryFilmCard } from "../src/components/LibraryFilmCard";
import { FilmDetailModal } from "../src/components/FilmPreviewModal";
import type { FilmItem, FilmMeta, SeenFilmItem } from "../src/types";

async function runTests() {
  // 1. Synthetic fixtures: deduplication, rewatches, homonyms with different years, metadata aliases
  const syntheticWatch: FilmItem[] = [
    { t: "Suspiria", y: "2018" },
    { t: "King Kong", y: "1933" },
    { t: "King Kong", y: "2005" },
    { t: "King Kong", y: "2005" }, // exact duplicate in watchlist
    { t: "Salò, or the 120 Days of Sodom", y: "1975" },
    { t: "The Conformist", y: "1970", it: "Il conformista" },
    { t: "Nightcrawler", y: "2014" }, // already in seen -> should move to watched only
    { t: "Mystery Without Meta", y: "" }, // missing year & metadata
  ];

  const syntheticSeen: SeenFilmItem[] = [
    { t: "Suspiria", y: "1977", r: 4.5 },
    { t: "Nightcrawler", y: "2014", r: 5, rw: true },
    { t: "Nightcrawler", y: "2014", r: 5, rw: true }, // rewatch duplicate
    { t: "The Mummy", y: "1999", r: 3.5 },
    { t: "The Mummy", y: "2017", r: 1 },
    { t: "Unrated Classic", y: "1955", r: null },
  ];

  const syntheticMeta: Record<string, FilmMeta> = {
    "suspiria|2018": {
      g: "Horror / Mistero",
      m: 152,
      d: "Luca Guadagnino",
      c: "Italia / Stati Uniti",
      a: "Dakota Johnson, Tilda Swinton",
    },
    "suspiria|1977": {
      g: "Horror",
      m: 98,
      d: "Dario Argento",
      c: "Italia",
    },
    "king kong|1933": {
      g: "Avventura / Fantasy",
      m: 100,
      d: "Merian C. Cooper",
      c: "Stati Uniti",
    },
    "king kong|2005": {
      g: "Avventura / Azione",
      m: 187,
      d: "Peter Jackson",
      c: "Stati Uniti / Nuova Zelanda",
    },
    // Alias via Italian title in meta key for The Conformist (1970)
    "il conformista|1970": {
      g: "Drammatico",
      m: 113,
      d: "Bernardo Bertolucci",
      c: "Italia / Francia",
      a: "Jean-Louis Trintignant, Stefania Sandrelli",
    },
    "nightcrawler|2014": {
      g: "Thriller / Crimine",
      m: 117,
      d: "Dan Gilroy",
      c: "Stati Uniti",
      a: "Jake Gyllenhaal",
    },
  };

  const watchSnapshot = JSON.stringify(syntheticWatch);
  const seenSnapshot = JSON.stringify(syntheticSeen);

  const collection = buildLibraryCollection(
    syntheticWatch,
    syntheticSeen,
    syntheticMeta
  );

  // Verify inputs were never mutated
  assert.equal(JSON.stringify(syntheticWatch), watchSnapshot);
  assert.equal(JSON.stringify(syntheticSeen), seenSnapshot);

  // Verify counts:
  // Watchlist: Suspiria 2018, King Kong 1933, King Kong 2005 (deduped), Salo 1975, The Conformist 1970, Mystery Without Meta (Nightcrawler moved to watched) => 6
  assert.equal(collection.watchlist.length, 6);
  // Watched: Suspiria 1977, Nightcrawler 2014 (deduped rewatch), The Mummy 1999, The Mummy 2017, Unrated Classic 1955 => 5
  assert.equal(collection.watched.length, 5);
  assert.equal(collection.scaleMax, 5);

  // Homonyms with different years remain separate and retain distinct metadata
  const kk1933 = collection.watchlist.find((x) => x.key === "king kong|1933");
  const kk2005 = collection.watchlist.find((x) => x.key === "king kong|2005");
  assert.ok(kk1933 && kk2005);
  assert.equal(kk1933.director, "Merian C. Cooper");
  assert.equal(kk2005.director, "Peter Jackson");

  const susp2018 = collection.watchlist.find((x) => x.key === "suspiria|2018");
  const susp1977 = collection.watched.find((x) => x.key === "suspiria|1977");
  assert.ok(susp2018 && susp1977);
  assert.equal(susp2018.director, "Luca Guadagnino");
  assert.equal(susp1977.director, "Dario Argento");

  // Alias metadata lookup via Italian title key
  const conformist = collection.watchlist.find(
    (x) => x.key === "the conformist|1970"
  );
  assert.ok(conformist);
  assert.equal(conformist.director, "Bernardo Bertolucci");
  assert.equal(conformist.runtime, 113);

  // 2. Accent-tolerant search on original & Italian titles
  const saloSearch = filterLibraryItems(
    collection.watchlist,
    { ...DEFAULT_LIBRARY_FILTERS, search: "salo" },
    "watchlist",
    5
  );
  assert.equal(saloSearch.length, 1);
  assert.equal(saloSearch[0].key, "salò, or the 120 days of sodom|1975");

  const origSearch = filterLibraryItems(
    collection.watchlist,
    { ...DEFAULT_LIBRARY_FILTERS, search: "THE CONFORMIST" },
    "watchlist",
    5
  );
  assert.equal(origSearch.length, 1);
  assert.equal(origSearch[0].key, "the conformist|1970");

  const itSearch = filterLibraryItems(
    collection.watchlist,
    { ...DEFAULT_LIBRARY_FILTERS, search: "conformista" },
    "watchlist",
    5
  );
  assert.equal(itSearch.length, 1);
  assert.equal(itSearch[0].key, "the conformist|1970");

  // 3. Combinable filters & explicit missing-metadata filters
  const facets = extractLibraryFilterOptions(collection.watchlist);
  assert.ok(facets.genres.some((g) => g.label === "Horror"));
  assert.ok(facets.missingGenreCount >= 2);
  assert.ok(facets.missingYearCount >= 1);

  const combined = filterLibraryItems(
    collection.watchlist,
    {
      ...DEFAULT_LIBRARY_FILTERS,
      genre: "avventura",
      country: "stati uniti",
      decade: "2000-2009",
      duration: "long",
    },
    "watchlist",
    5
  );
  assert.equal(combined.length, 1);
  assert.equal(combined[0].key, "king kong|2005");

  const missingRuntime = filterLibraryItems(
    collection.watchlist,
    { ...DEFAULT_LIBRARY_FILTERS, duration: "missing" },
    "watchlist",
    5
  );
  assert.ok(missingRuntime.some((x) => x.key === "mystery without meta|"));

  const topRated = filterLibraryItems(
    collection.watched,
    { ...DEFAULT_LIBRARY_FILTERS, rating: "top" },
    "watched",
    5
  );
  assert.deepEqual(
    topRated.map((x) => x.key).sort(),
    ["nightcrawler|2014", "suspiria|1977"]
  );

  const unratedOnly = filterLibraryItems(
    collection.watched,
    { ...DEFAULT_LIBRARY_FILTERS, rating: "unrated" },
    "watched",
    5
  );
  assert.deepEqual(
    unratedOnly.map((x) => x.key),
    ["unrated classic|1955"]
  );

  // 4. Sorting & missing values strictly at the end
  const byYearAsc = sortLibraryItems(collection.watchlist, "year-asc");
  assert.equal(byYearAsc[0].key, "king kong|1933");
  assert.equal(byYearAsc[byYearAsc.length - 1].key, "mystery without meta|");

  const byYearDesc = sortLibraryItems(collection.watchlist, "year-desc");
  assert.equal(byYearDesc[0].key, "suspiria|2018");
  assert.equal(byYearDesc[byYearDesc.length - 1].key, "mystery without meta|");

  const byRuntimeAsc = sortLibraryItems(collection.watchlist, "runtime-asc");
  assert.equal(byRuntimeAsc[0].key, "king kong|1933");
  assert.equal(byRuntimeAsc[byRuntimeAsc.length - 1].runtime, null);

  const byRatingAsc = sortLibraryItems(collection.watched, "rating-asc");
  assert.equal(byRatingAsc[0].key, "the mummy|2017");
  assert.equal(byRatingAsc[byRatingAsc.length - 1].key, "unrated classic|1955");

  const byRatingDesc = sortLibraryItems(collection.watched, "rating-desc");
  assert.equal(byRatingDesc[0].key, "nightcrawler|2014");
  assert.equal(byRatingDesc[byRatingDesc.length - 1].key, "unrated classic|1955");

  // 5. Real embedded library consistency check
  const allSeenReal = getAllSeen(EMB.seen, SEED.marks);
  const realCollection = buildLibraryCollection(EMB.watch, allSeenReal, SEED.meta);
  assert.ok(realCollection.watchlist.length > 400);
  assert.ok(realCollection.watched.length > 200);
  const watchedKeys = new Set(realCollection.watched.map((x) => x.key));
  const watchKeys = new Set(realCollection.watchlist.map((x) => x.key));
  assert.equal(watchedKeys.size, realCollection.watched.length);
  assert.equal(watchKeys.size, realCollection.watchlist.length);
  for (const k of watchedKeys) {
    assert.equal(watchKeys.has(k), false, `Overlap found for ${k}`);
  }
  // Homonyms in embedded library remain distinct
  assert.ok(watchKeys.has("king kong|1933"));
  assert.ok(watchKeys.has("king kong|2005"));
  assert.ok(watchedKeys.has("scream|1996"));
  assert.ok(watchedKeys.has("scream|2022"));

  // 6. Preview queue: concurrency <= 3, fast-only navigation (0 Gemini calls), dedup, cancellation
  let active = 0;
  let maxConcurrent = 0;
  const fetchCalls: Array<{ key: string; fast: boolean }> = [];
  const deferredResolvers: Array<() => void> = [];

  const mockFetcher: PreviewFetcher = (film, _dir, options) => {
    const fast = Boolean(options?.fast);
    fetchCalls.push({ key: `${film.t}|${film.y}`, fast });
    active += 1;
    maxConcurrent = Math.max(maxConcurrent, active);
    return new Promise((resolve) => {
      deferredResolvers.push(() => {
        active -= 1;
        resolve({
          posterUrl: "https://example.com/poster.jpg",
          description: fast ? "Short" : "Full synopsis returned on explicit modal open.",
          wikiUrl: null,
          loading: false,
        });
      });
    });
  };

  const queue = new LibraryPreviewQueue(mockFetcher, 3, 48);
  const fakeEntries: LibraryEntry[] = Array.from({ length: 12 }, (_, idx) => ({
    id: `watchlist:film${idx}|2020`,
    key: `film${idx}|2020`,
    film: { t: `Film ${idx}`, y: "2020" },
    title: `Film ${idx}`,
    originalTitle: `Film ${idx}`,
    italianTitle: "",
    year: "2020",
    yearNum: 2020,
    status: "watchlist",
    rating: null,
    rewatch: false,
    director: "",
    directors: [],
    genres: [],
    countries: [],
    cast: [],
    runtime: null,
    decadeValue: "2020-2029",
    searchOriginal: `film ${idx}`,
    searchItalian: "",
    searchDisplay: `film ${idx}`,
  }));

  queue.setVisibleKeys(new Set(fakeEntries.map((e) => e.key)));
  const resolvedEvents: string[] = [];
  for (const entry of fakeEntries) {
    queue.enqueueFast(entry, {
      onStart: () => {},
      onResolve: (k) => resolvedEvents.push(k),
    });
  }
  // Duplicate enqueue should be ignored
  const dupAccepted = queue.enqueueFast(fakeEntries[0], {
    onStart: () => {},
    onResolve: () => {},
  });
  assert.equal(dupAccepted, false);
  assert.equal(maxConcurrent, 3);
  assert.equal(queue.getActiveCount(), 3);
  assert.equal(queue.getQueuedCount(), 9);

  // Resolve first batch, then invalidate scope (simulate filter change)
  while (deferredResolvers.length > 0 && resolvedEvents.length < 3) {
    const fn = deferredResolvers.shift()!;
    fn();
    await Promise.resolve();
  }
  assert.ok(fetchCalls.every((c) => c.fast === true), "Navigation must only issue fast:true");

  const beforeInvalidateCount = fetchCalls.length;
  queue.invalidateScope();
  assert.equal(queue.getQueuedCount(), 0);
  // Drain remaining active requests from obsolete scope
  while (deferredResolvers.length > 0) {
    deferredResolvers.shift()!();
    await Promise.resolve();
  }
  assert.equal(
    fetchCalls.length,
    beforeInvalidateCount,
    "Cancelled queued items must not fire after invalidateScope"
  );

  // 7. SSR Render checks: HeaderBar order, LibraryView pagination=36, Grid & List cards, Detail Modal
  const headerHtml = renderToStaticMarkup(
    React.createElement(HeaderBar, {
      tab: "library",
      setTab: () => {},
      tonightCount: 2,
      dark: true,
      onToggleDark: () => {},
    })
  );
  const navOrder = [
    "Serata",
    "ReelRouette",
    "Library",
    "Cronologia",
    "Profilo",
    "Archivio",
  ];
  let prevIdx = -1;
  for (const label of navOrder) {
    const idx = headerHtml.indexOf(label);
    assert.ok(idx > prevIdx, `HeaderBar order failed at ${label}`);
    prevIdx = idx;
  }

  // Build 80 synthetic watchlist items to verify initial 36 pagination
  const eightyFilms: FilmItem[] = Array.from({ length: 80 }, (_, i) => ({
    t: `Archive Movie ${String(i + 1).padStart(2, "0")}`,
    y: String(1950 + (i % 70)),
  }));
  const libraryHtml = renderToStaticMarkup(
    React.createElement(LibraryView, {
      fullWatchlist: eightyFilms,
      allSeen: syntheticSeen,
      meta: syntheticMeta,
    })
  );
  assert.ok(libraryHtml.includes("Library"));
  assert.ok(libraryHtml.includes("grid-cols-4 gap-1.5 sm:gap-4"));
  assert.ok(libraryHtml.includes(`Visualizzati`));
  assert.ok(
    libraryHtml.includes(`Carica altri ${LIBRARY_PAGE_SIZE} (rimanenti: ${80 - LIBRARY_PAGE_SIZE})`)
  );
  assert.ok(libraryHtml.includes("Archive Movie 36"));
  assert.equal(libraryHtml.includes("Archive Movie 37"), false);

  const watchedGridCardHtml = renderToStaticMarkup(
    React.createElement(LibraryFilmCard, {
      entry: susp1977,
      mode: "grid",
      scaleMax: 5,
      onVisible: () => {},
      onSelect: () => {},
    })
  );
  assert.ok(watchedGridCardHtml.includes('aria-label="Suspiria · 1977 · Valutazione 4.5/5"'));
  assert.ok(watchedGridCardHtml.includes("hidden sm:flex"));
  assert.ok(watchedGridCardHtml.includes("sm:hidden"));
  assert.ok(watchedGridCardHtml.includes("4.5/5"));

  const watchlistGridCardHtml = renderToStaticMarkup(
    React.createElement(LibraryFilmCard, {
      entry: conformist,
      mode: "grid",
      scaleMax: 5,
      onVisible: () => {},
      onSelect: () => {},
    })
  );
  assert.ok(
    watchlistGridCardHtml.includes('aria-label="Il conformista · The Conformist · 1970"')
  );
  assert.ok(watchlistGridCardHtml.includes("hidden sm:flex"));
  assert.equal(watchlistGridCardHtml.includes("sm:hidden"), false);

  const listCardHtml = renderToStaticMarkup(
    React.createElement(LibraryFilmCard, {
      entry: conformist,
      mode: "list",
      scaleMax: 5,
      onVisible: () => {},
      onSelect: () => {},
    })
  );
  assert.ok(listCardHtml.includes("Il conformista"));
  assert.ok(listCardHtml.includes("The Conformist"));
  assert.ok(listCardHtml.includes("Bernardo Bertolucci"));
  assert.ok(listCardHtml.includes("113 min"));

  const detailHtml = renderToStaticMarkup(
    React.createElement(FilmDetailModal, {
      open: true,
      film: conformist.film,
      meta: conformist.meta,
      regista: conformist.director,
      durata: "113 min",
      statusLabel: "Watched",
      personalRating: 4.5,
      ratingScaleMax: 5,
      rewatch: true,
      preview: {
        posterUrl: null,
        description: "Un giovane professore aderisce al fascismo.",
        wikiUrl: "https://it.wikipedia.org/wiki/Il_conformista",
      },
      onClose: () => {},
    })
  );
  assert.ok(detailHtml.includes("Il conformista"));
  assert.ok(detailHtml.includes("The Conformist"));
  assert.ok(detailHtml.includes("Jean-Louis Trintignant, Stefania Sandrelli"));
  assert.ok(detailHtml.includes("4.5/5"));
  assert.ok(detailHtml.includes("Watched"));
  assert.ok(detailHtml.includes("Un giovane professore aderisce al fascismo."));
  assert.equal(detailHtml.includes("Guardo questo"), false);

  console.log("ALL_LIBRARY_TESTS_PASSED");
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
