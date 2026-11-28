import React, { useEffect, useMemo, useState } from "react";
import { Film, RotateCcw } from "lucide-react";
import {
  buildLibraryCollection,
  countActiveLibraryFilters,
  DEFAULT_LIBRARY_FILTERS,
  extractLibraryFilterOptions,
  filterLibraryItems,
  sortLibraryItems,
  type LibraryEntry,
  type LibraryFilterState,
  type LibrarySortKey,
  type LibraryTab,
  type LibraryViewMode,
} from "../utils/libraryHelpers";
import { useLibraryPreviews } from "../hooks/useLibraryPreviews";
import { LibraryFilters } from "./LibraryFilters";
import { LibraryFilmCard } from "./LibraryFilmCard";
import { FilmDetailModal } from "./FilmPreviewModal";
import type { FilmItem, FilmMeta, SeenFilmItem } from "../types";

export const LIBRARY_PAGE_SIZE = 36;

interface LibraryViewProps {
  fullWatchlist: FilmItem[];
  allSeen: SeenFilmItem[];
  meta: Record<string, FilmMeta>;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  fullWatchlist,
  allSeen,
  meta,
}) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>("watchlist");
  const [viewMode, setViewMode] = useState<LibraryViewMode>("grid");
  const [sortKey, setSortKey] = useState<LibrarySortKey>("title-asc");
  const [filters, setFilters] = useState<LibraryFilterState>(
    DEFAULT_LIBRARY_FILTERS
  );
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(LIBRARY_PAGE_SIZE);
  const [selectedEntry, setSelectedEntry] = useState<LibraryEntry | null>(null);

  const collection = useMemo(
    () => buildLibraryCollection(fullWatchlist, allSeen, meta),
    [fullWatchlist, allSeen, meta]
  );

  const tabEntries =
    activeTab === "watchlist" ? collection.watchlist : collection.watched;

  const facets = useMemo(
    () => extractLibraryFilterOptions(tabEntries),
    [tabEntries]
  );

  const filteredItems = useMemo(
    () =>
      filterLibraryItems(
        tabEntries,
        filters,
        activeTab,
        collection.scaleMax
      ),
    [tabEntries, filters, activeTab, collection.scaleMax]
  );

  const sortedItems = useMemo(
    () => sortLibraryItems(filteredItems, sortKey),
    [filteredItems, sortKey]
  );

  const scopeSignature = useMemo(
    () =>
      [
        activeTab,
        sortKey,
        filters.search.trim().toLowerCase(),
        filters.genre,
        filters.director,
        filters.country,
        filters.decade,
        filters.duration,
        activeTab === "watched" ? filters.rating : "",
      ].join("|"),
    [activeTab, sortKey, filters]
  );

  // Reset pagination to first 36 whenever tab, filters, or sort change
  useEffect(() => {
    setVisibleCount(LIBRARY_PAGE_SIZE);
  }, [scopeSignature]);

  const visibleItems = useMemo(
    () => sortedItems.slice(0, visibleCount),
    [sortedItems, visibleCount]
  );

  const { previews, requestLibraryPreview, requestDetailPreview } =
    useLibraryPreviews(visibleItems, scopeSignature);

  const activeFilterCount = useMemo(
    () => countActiveLibraryFilters(filters, activeTab),
    [filters, activeTab]
  );

  const handleTabChange = (nextTab: LibraryTab) => {
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
    if (nextTab === "watchlist") {
      if (sortKey === "rating-desc" || sortKey === "rating-asc") {
        setSortKey("title-asc");
      }
      if (filters.rating) {
        setFilters((prev) => ({ ...prev, rating: "" }));
      }
    }
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_LIBRARY_FILTERS);
  };

  const remainingCount = Math.max(0, sortedItems.length - visibleItems.length);
  const nextBatchSize = Math.min(LIBRARY_PAGE_SIZE, remainingCount);
  const totalUniqueCount =
    collection.watchlist.length + collection.watched.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-cg-border pb-6">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-cg-accent-text">
            Collezione personale
          </div>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-cg-text text-balance sm:text-4xl">
            Library
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-cg-muted">
            Esplora tutti i film in Watchlist e i titoli già visti, con ricerca
            istantanea, filtri combinabili e schede dettaglio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cg-muted font-mono tabular-nums">
          <span>
            Watchlist:{" "}
            <strong className="font-semibold text-cg-text">
              {collection.watchlist.length}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Watched:{" "}
            <strong className="font-semibold text-cg-text">
              {collection.watched.length}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Totale:{" "}
            <strong className="font-semibold text-cg-text">
              {totalUniqueCount}
            </strong>
          </span>
        </div>
      </header>

      {/* Filters & Controls */}
      <LibraryFilters
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        watchlistCount={collection.watchlist.length}
        watchedCount={collection.watched.length}
        totalInTabCount={tabEntries.length}
        filteredCount={sortedItems.length}
        filters={filters}
        onChangeFilters={setFilters}
        onResetFilters={handleResetFilters}
        activeFilterCount={activeFilterCount}
        facets={facets}
        sortKey={sortKey}
        onChangeSortKey={setSortKey}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        scaleMax={collection.scaleMax}
        filtersExpanded={filtersExpanded}
        onToggleFiltersExpanded={() => setFiltersExpanded((o) => !o)}
      />

      {/* Collection Empty State vs Filtered Empty State vs Results */}
      {tabEntries.length === 0 ? (
        <div className="rounded-2xl border border-cg-border bg-cg-surface px-6 py-14 text-center">
          <Film
            className="mx-auto h-9 w-9 text-cg-muted"
            aria-hidden="true"
          />
          <h2 className="mt-3 font-display text-lg font-semibold text-cg-text">
            {activeTab === "watchlist"
              ? "La tua Watchlist è vuota"
              : "Nessun film visto registrato"}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-cg-muted">
            Importa i tuoi CSV Letterboxd o sincronizza il diario dalla sezione
            Archivio per popolare la collezione.
          </p>
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="rounded-2xl border border-cg-border bg-cg-surface px-6 py-14 text-center">
          <Film
            className="mx-auto h-9 w-9 text-cg-muted"
            aria-hidden="true"
          />
          <h2 className="mt-3 font-display text-lg font-semibold text-cg-text">
            Nessun risultato trovato
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-cg-muted">
            Nessun film corrisponde alla ricerca o ai filtri selezionati in{" "}
            {activeTab === "watchlist" ? "Watchlist" : "Watched"}.
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cg-accent px-4 py-2 text-xs font-semibold text-cg-accent-fg transition-colors hover:bg-cg-accent-hover"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Azzera filtri</span>
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {visibleItems.map((entry) => (
            <LibraryFilmCard
              key={entry.id}
              entry={entry}
              mode="grid"
              scaleMax={collection.scaleMax}
              preview={previews[entry.key]}
              onVisible={requestLibraryPreview}
              onSelect={setSelectedEntry}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="hidden items-center gap-4 px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-cg-muted sm:flex">
            <div className="w-12 shrink-0" />
            <div className="min-w-0 flex-1">Titolo</div>
            <div className="flex min-w-0 flex-1 items-center gap-5 lg:max-w-lg">
              <span className="min-w-0 flex-1">Regista</span>
              <span className="min-w-0 flex-1">Genere</span>
              <span className="w-16 shrink-0 text-right">Durata</span>
            </div>
            {activeTab === "watched" && (
              <div className="w-16 shrink-0 text-right">Voto</div>
            )}
          </div>
          {visibleItems.map((entry) => (
            <LibraryFilmCard
              key={entry.id}
              entry={entry}
              mode="list"
              scaleMax={collection.scaleMax}
              preview={previews[entry.key]}
              onVisible={requestLibraryPreview}
              onSelect={setSelectedEntry}
            />
          ))}
        </div>
      )}

      {/* Progressive Pagination */}
      {sortedItems.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-cg-border pt-5 sm:flex-row">
          <div className="font-mono text-xs tabular-nums text-cg-muted">
            Visualizzati{" "}
            <strong className="font-semibold text-cg-text">
              {visibleItems.length}
            </strong>{" "}
            su{" "}
            <strong className="font-semibold text-cg-text">
              {sortedItems.length}
            </strong>{" "}
            film
          </div>

          {remainingCount > 0 && (
            <button
              type="button"
              onClick={() =>
                setVisibleCount((prev) =>
                  Math.min(sortedItems.length, prev + LIBRARY_PAGE_SIZE)
                )
              }
              className="rounded-lg border border-cg-border bg-cg-surface px-5 py-2.5 text-xs font-semibold text-cg-text transition-colors hover:border-cg-border-strong hover:bg-cg-elevated whitespace-nowrap shrink-0"
            >
              Carica altri {nextBatchSize} (rimanenti: {remainingCount})
            </button>
          )}
        </div>
      )}

      {/* Read-only Detail Modal */}
      <FilmDetailModal
        open={Boolean(selectedEntry)}
        film={selectedEntry?.film ?? null}
        preview={selectedEntry ? previews[selectedEntry.key] : undefined}
        meta={selectedEntry?.meta}
        regista={selectedEntry?.director}
        durata={
          selectedEntry?.runtime ? `${selectedEntry.runtime} min` : undefined
        }
        statusLabel={
          selectedEntry
            ? selectedEntry.status === "watched"
              ? "Watched"
              : "Watchlist"
            : undefined
        }
        personalRating={selectedEntry?.rating ?? null}
        ratingScaleMax={collection.scaleMax}
        rewatch={Boolean(selectedEntry?.rewatch)}
        onVisiblePoster={
          selectedEntry ? () => requestDetailPreview(selectedEntry) : undefined
        }
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
};

export default LibraryView;
