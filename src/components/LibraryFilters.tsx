import React from "react";
import { LayoutGrid, List, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import type {
  LibraryDurationBucket,
  LibraryFacetOptions,
  LibraryFilterState,
  LibraryRatingFilter,
  LibrarySortKey,
  LibraryTab,
  LibraryViewMode,
} from "../utils/libraryHelpers";

interface LibraryFiltersProps {
  activeTab: LibraryTab;
  onChangeTab: (tab: LibraryTab) => void;
  watchlistCount: number;
  watchedCount: number;
  totalInTabCount: number;
  filteredCount: number;
  filters: LibraryFilterState;
  onChangeFilters: (next: LibraryFilterState) => void;
  onResetFilters: () => void;
  activeFilterCount: number;
  facets: LibraryFacetOptions;
  sortKey: LibrarySortKey;
  onChangeSortKey: (sort: LibrarySortKey) => void;
  viewMode: LibraryViewMode;
  onChangeViewMode: (mode: LibraryViewMode) => void;
  scaleMax: 5 | 10;
  filtersExpanded: boolean;
  onToggleFiltersExpanded: () => void;
}

export const LibraryFilters: React.FC<LibraryFiltersProps> = ({
  activeTab,
  onChangeTab,
  watchlistCount,
  watchedCount,
  totalInTabCount,
  filteredCount,
  filters,
  onChangeFilters,
  onResetFilters,
  activeFilterCount,
  facets,
  sortKey,
  onChangeSortKey,
  viewMode,
  onChangeViewMode,
  scaleMax,
  filtersExpanded,
  onToggleFiltersExpanded,
}) => {
  const updateField = <K extends keyof LibraryFilterState>(
    key: K,
    value: LibraryFilterState[K]
  ) => {
    onChangeFilters({ ...filters, [key]: value });
  };

  const selectClass =
    "h-9 w-full rounded-lg border border-cg-border bg-cg-bg px-2.5 text-xs text-cg-text transition-colors hover:border-cg-border-strong";

  const ratingOptions: Array<{ value: LibraryRatingFilter; label: string }> =
    scaleMax === 10
      ? [
          { value: "", label: "Tutti i voti" },
          { value: "top", label: "9–10" },
          { value: "high", label: "8 o più" },
          { value: "mid", label: "6 o più" },
          { value: "low", label: "Sotto 6" },
          ...(facets.unratedCount > 0
            ? [{ value: "unrated" as const, label: `Senza voto (${facets.unratedCount})` }]
            : []),
        ]
      : [
          { value: "", label: "Tutti i voti" },
          { value: "top", label: "4.5–5 stelle" },
          { value: "high", label: "4 stelle o più" },
          { value: "mid", label: "3 stelle o più" },
          { value: "low", label: "Sotto 3 stelle" },
          ...(facets.unratedCount > 0
            ? [{ value: "unrated" as const, label: `Senza voto (${facets.unratedCount})` }]
            : []),
        ];

  return (
    <section
      aria-label="Controlli Library"
      className="space-y-4 rounded-2xl border border-cg-border bg-cg-surface p-4 sm:p-5"
    >
      {/* Top row: Watchlist/Watched segmented tabs + Search + Sort + View switcher */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Segmented tab control */}
        <div
          role="tablist"
          aria-label="Sezione collezione"
          className="inline-flex w-full items-center gap-1 rounded-xl border border-cg-border bg-cg-bg p-1 sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "watchlist"}
            onClick={() => onChangeTab("watchlist")}
            className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 sm:flex-initial ${
              activeTab === "watchlist"
                ? "bg-cg-accent text-cg-accent-fg"
                : "text-cg-secondary hover:bg-cg-elevated hover:text-cg-text"
            }`}
          >
            Watchlist{" "}
            <span className="ml-1 font-mono tabular-nums opacity-85">
              ({watchlistCount})
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "watched"}
            onClick={() => onChangeTab("watched")}
            className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 sm:flex-initial ${
              activeTab === "watched"
                ? "bg-cg-accent text-cg-accent-fg"
                : "text-cg-secondary hover:bg-cg-elevated hover:text-cg-text"
            }`}
          >
            Watched{" "}
            <span className="ml-1 font-mono tabular-nums opacity-85">
              ({watchedCount})
            </span>
          </button>
        </div>

        {/* Search + Sort + Filter toggle + Grid/List mode */}
        <div className="flex flex-1 flex-wrap items-center gap-2.5 lg:justify-end">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cg-muted"
              aria-hidden="true"
            />
            <label htmlFor="library-search" className="sr-only">
              Cerca per titolo originale o italiano
            </label>
            <input
              id="library-search"
              type="search"
              value={filters.search}
              onChange={(e) => updateField("search", e.target.value)}
              placeholder="Cerca titolo originale o italiano…"
              className="h-9 w-full rounded-lg border border-cg-border bg-cg-bg pl-8 pr-8 text-xs text-cg-text placeholder:text-cg-muted transition-colors hover:border-cg-border-strong"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => updateField("search", "")}
                aria-label="Cancella ricerca"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-cg-muted hover:text-cg-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="library-sort" className="sr-only">
              Ordina film
            </label>
            <select
              id="library-sort"
              value={sortKey}
              onChange={(e) => onChangeSortKey(e.target.value as LibrarySortKey)}
              className="h-9 rounded-lg border border-cg-border bg-cg-bg px-2.5 text-xs font-medium text-cg-text transition-colors hover:border-cg-border-strong"
            >
              <option value="title-asc">Titolo A–Z</option>
              <option value="title-desc">Titolo Z–A</option>
              <option value="year-desc">Anno decrescente</option>
              <option value="year-asc">Anno crescente</option>
              <option value="runtime-asc">Durata crescente</option>
              <option value="runtime-desc">Durata decrescente</option>
              {activeTab === "watched" && (
                <>
                  <option value="rating-desc">Valutazione decrescente</option>
                  <option value="rating-asc">Valutazione crescente</option>
                </>
              )}
            </select>

            <button
              type="button"
              onClick={onToggleFiltersExpanded}
              aria-expanded={filtersExpanded}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filtersExpanded || activeFilterCount > 0
                  ? "border-cg-accent/50 bg-cg-accent-soft text-cg-accent-text"
                  : "border-cg-border bg-cg-bg text-cg-secondary hover:border-cg-border-strong hover:text-cg-text"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filtri</span>
              {activeFilterCount > 0 && (
                <span className="font-mono tabular-nums">
                  ({activeFilterCount})
                </span>
              )}
            </button>

            <div
              role="group"
              aria-label="Modalità visualizzazione"
              className="inline-flex h-9 items-center rounded-lg border border-cg-border bg-cg-bg p-0.5 shrink-0"
            >
              <button
                type="button"
                onClick={() => onChangeViewMode("grid")}
                aria-pressed={viewMode === "grid"}
                aria-label="Vista griglia"
                className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === "grid"
                    ? "bg-cg-elevated text-cg-text"
                    : "text-cg-muted hover:text-cg-text"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Griglia</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeViewMode("list")}
                aria-pressed={viewMode === "list"}
                aria-label="Vista elenco"
                className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === "list"
                    ? "bg-cg-elevated text-cg-text"
                    : "text-cg-muted hover:text-cg-text"
                }`}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Elenco</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable combinable metadata filters */}
      {filtersExpanded && (
        <div
          className={`grid grid-cols-1 gap-2.5 border-t border-cg-border pt-3.5 sm:grid-cols-2 lg:grid-cols-3 ${
            activeTab === "watched" ? "xl:grid-cols-6" : "xl:grid-cols-5"
          }`}
        >
          <div>
            <label
              htmlFor="lib-filter-genre"
              className="mb-1 block text-[11px] font-medium text-cg-muted"
            >
              Genere
            </label>
            <select
              id="lib-filter-genre"
              value={filters.genre}
              onChange={(e) => updateField("genre", e.target.value)}
              className={selectClass}
            >
              <option value="">Tutti i generi</option>
              {facets.genres.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label} ({g.count})
                </option>
              ))}
              {facets.missingGenreCount > 0 && (
                <option value="__missing__">
                  Genere mancante ({facets.missingGenreCount})
                </option>
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="lib-filter-director"
              className="mb-1 block text-[11px] font-medium text-cg-muted"
            >
              Regista
            </label>
            <select
              id="lib-filter-director"
              value={filters.director}
              onChange={(e) => updateField("director", e.target.value)}
              className={selectClass}
            >
              <option value="">Tutti i registi</option>
              {facets.directors.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label} ({d.count})
                </option>
              ))}
              {facets.missingDirectorCount > 0 && (
                <option value="__missing__">
                  Regista mancante ({facets.missingDirectorCount})
                </option>
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="lib-filter-country"
              className="mb-1 block text-[11px] font-medium text-cg-muted"
            >
              Paese
            </label>
            <select
              id="lib-filter-country"
              value={filters.country}
              onChange={(e) => updateField("country", e.target.value)}
              className={selectClass}
            >
              <option value="">Tutti i paesi</option>
              {facets.countries.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} ({c.count})
                </option>
              ))}
              {facets.missingCountryCount > 0 && (
                <option value="__missing__">
                  Paese mancante ({facets.missingCountryCount})
                </option>
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="lib-filter-decade"
              className="mb-1 block text-[11px] font-medium text-cg-muted"
            >
              Decennio
            </label>
            <select
              id="lib-filter-decade"
              value={filters.decade}
              onChange={(e) => updateField("decade", e.target.value)}
              className={selectClass}
            >
              <option value="">Tutti i decenni</option>
              {facets.decades.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label} ({d.count})
                </option>
              ))}
              {facets.missingYearCount > 0 && (
                <option value="__missing__">
                  Anno mancante ({facets.missingYearCount})
                </option>
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="lib-filter-duration"
              className="mb-1 block text-[11px] font-medium text-cg-muted"
            >
              Durata
            </label>
            <select
              id="lib-filter-duration"
              value={filters.duration}
              onChange={(e) =>
                updateField("duration", e.target.value as LibraryDurationBucket)
              }
              className={selectClass}
            >
              <option value="">Qualsiasi durata</option>
              <option value="short">Corti e brevi (≤ 90 min)</option>
              <option value="standard">Media durata (91–130 min)</option>
              <option value="long">Lunghi (&gt; 130 min)</option>
              {facets.missingRuntimeCount > 0 && (
                <option value="missing">
                  Durata mancante ({facets.missingRuntimeCount})
                </option>
              )}
            </select>
          </div>

          {activeTab === "watched" && (
            <div>
              <label
                htmlFor="lib-filter-rating"
                className="mb-1 block text-[11px] font-medium text-cg-muted"
              >
                Valutazione personale
              </label>
              <select
                id="lib-filter-rating"
                value={filters.rating}
                onChange={(e) =>
                  updateField("rating", e.target.value as LibraryRatingFilter)
                }
                className={selectClass}
              >
                {ratingOptions.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Results summary & reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cg-border pt-3 text-xs text-cg-muted">
        <div className="font-mono tabular-nums">
          {filteredCount === totalInTabCount ? (
            <span>
              <strong className="font-semibold text-cg-text">
                {filteredCount}
              </strong>{" "}
              {filteredCount === 1 ? "film" : "film"} in{" "}
              {activeTab === "watchlist" ? "Watchlist" : "Watched"}
            </span>
          ) : (
            <span>
              <strong className="font-semibold text-cg-text">
                {filteredCount}
              </strong>{" "}
              risultati filtrati su{" "}
              <span className="text-cg-secondary">{totalInTabCount}</span>
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cg-border bg-cg-bg px-2.5 py-1 text-xs font-medium text-cg-secondary transition-colors hover:border-cg-border-strong hover:text-cg-text whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>Azzera filtri</span>
          </button>
        )}
      </div>
    </section>
  );
};
