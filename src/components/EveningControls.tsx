import React from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import {
  COUNTRY_FILTERS,
  DECADE_FILTERS,
  GENRE_FILTERS,
  MOODS,
} from "../constants/filters";
import type { EngineMode, RiskMode } from "../types";

export interface EveningPreset {
  id: string;
  label: string;
  detail: string;
  moods: string[];
  risk: RiskMode;
  durMin: number;
  durMax: number;
}

export const EVENING_PRESETS: EveningPreset[] = [
  {
    id: "weeknight",
    label: "Infrasettimanale",
    detail: "≤ 100 min",
    moods: ["Da solo", "Leggero"],
    risk: "",
    durMin: 40,
    durMax: 100,
  },
  {
    id: "saturday",
    label: "Sabato intenso",
    detail: "Osare",
    moods: ["Intenso", "Cervellotico"],
    risk: "bold",
    durMin: 40,
    durMax: 210,
  },
  {
    id: "duo",
    label: "In due leggero",
    detail: "Sul sicuro",
    moods: ["In due", "Divertente", "Leggero"],
    risk: "safe",
    durMin: 40,
    durMax: 130,
  },
  {
    id: "classic",
    label: "Classico d’autore",
    detail: "Profondo",
    moods: ["Classico", "Commovente"],
    risk: "",
    durMin: 40,
    durMax: 210,
  },
];

const COMPANION_OPTIONS = ["Da solo", "In due", "Con amici"] as const;
const CORE_MOODS = MOODS.filter(
  (m) => !(COMPANION_OPTIONS as readonly string[]).includes(m)
);

interface EveningControlsProps {
  selectedMoods: Set<string>;
  onToggleMood: (mood: string) => void;
  onSelectCompanion: (companion: string) => void;
  onApplyPreset: (preset: EveningPreset) => void;
  partnerTaste: string;
  onChangePartnerTaste: (value: string) => void;
  risk: RiskMode;
  onChangeRisk: (risk: RiskMode) => void;
  ctxText: string;
  onChangeCtxText: (value: string) => void;
  filtersOpen: boolean;
  onToggleFiltersOpen: () => void;
  durMin: number;
  durMax: number;
  onChangeDurMin: (v: number) => void;
  onChangeDurMax: (v: number) => void;
  durationLabel: string;
  genreSel: Set<string>;
  onToggleGenre: (val: string) => void;
  countrySel: Set<string>;
  onToggleCountry: (val: string) => void;
  decadeSel: Set<string>;
  onToggleDecade: (val: string) => void;
  activeFilterGroups: number;
  filteredCount: number;
  unknownMetaCount: number;
  onResetAllFilters: () => void;
  aiAvailable: boolean;
  engineMode: EngineMode;
  onChangeEngineMode: (mode: EngineMode) => void;
  rewatchMode: boolean;
  onChangeRewatchMode: (rewatch: boolean) => void;
  rewatchCount: number;
  loading: boolean;
  onRecommend: () => void;
}

export const EveningControls: React.FC<EveningControlsProps> = ({
  selectedMoods,
  onToggleMood,
  onSelectCompanion,
  onApplyPreset,
  partnerTaste,
  onChangePartnerTaste,
  risk,
  onChangeRisk,
  ctxText,
  onChangeCtxText,
  filtersOpen,
  onToggleFiltersOpen,
  durMin,
  durMax,
  onChangeDurMin,
  onChangeDurMax,
  durationLabel,
  genreSel,
  onToggleGenre,
  countrySel,
  onToggleCountry,
  decadeSel,
  onToggleDecade,
  activeFilterGroups,
  filteredCount,
  unknownMetaCount,
  onResetAllFilters,
  aiAvailable,
  engineMode,
  onChangeEngineMode,
  rewatchMode,
  onChangeRewatchMode,
  rewatchCount,
  loading,
  onRecommend,
}) => {
  const leftPct = ((durMin - 40) / 170) * 100;
  const rightPct = ((durMax - 40) / 170) * 100;
  const fillWidthPct = Math.max(0, rightPct - leftPct);

  const hasAnyResettable =
    selectedMoods.size > 0 ||
    activeFilterGroups > 0 ||
    risk !== "" ||
    ctxText.trim().length > 0;

  return (
    <aside className="lg:col-span-5 lg:sticky lg:top-20">
      <div className="rounded-2xl border border-cg-border bg-cg-surface p-5 sm:p-6">
        {/* Quick presets */}
        <div className="pb-5">
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-cg-muted">
              Serate tipo
            </span>
            {hasAnyResettable && (
              <button
                type="button"
                onClick={onResetAllFilters}
                className="text-xs font-medium text-cg-muted underline-offset-4 hover:text-cg-text hover:underline"
              >
                Azzera tutto
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {EVENING_PRESETS.map((preset) => {
              const isMatch =
                preset.risk === risk &&
                preset.durMin === durMin &&
                preset.durMax === durMax &&
                preset.moods.every((m) => selectedMoods.has(m)) &&
                selectedMoods.size === preset.moods.length;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={isMatch}
                  onClick={() => onApplyPreset(preset)}
                  className={`flex items-baseline justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                    isMatch
                      ? "border-cg-accent bg-cg-accent-soft text-cg-accent-text"
                      : "border-cg-border bg-cg-elevated text-cg-secondary hover:border-cg-border-strong hover:text-cg-text"
                  }`}
                >
                  <span className="truncate text-xs font-semibold">
                    {preset.label}
                  </span>
                  <span
                    className={`shrink-0 font-mono text-[10px] ${
                      isMatch ? "text-cg-accent-text" : "text-cg-muted"
                    }`}
                  >
                    {preset.detail}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dedicated Companion selector */}
        <div className="border-t border-cg-border pt-5">
          <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-cg-muted">
            Con chi guardi
          </span>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-cg-border bg-cg-elevated p-1">
            {COMPANION_OPTIONS.map((comp) => {
              const active = selectedMoods.has(comp);
              return (
                <button
                  key={comp}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectCompanion(comp)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-cg-accent text-cg-accent-fg font-semibold"
                      : "text-cg-muted hover:text-cg-text"
                  }`}
                >
                  {comp}
                </button>
              );
            })}
          </div>

          {selectedMoods.has("In due") && (
            <div className="mt-4">
              <label
                htmlFor="partner-taste"
                className="mb-1.5 block text-xs font-medium text-cg-muted"
              >
                Gusti dell’altra persona (salvati)
              </label>
              <textarea
                id="partner-taste"
                rows={2}
                value={partnerTaste}
                onChange={(e) => onChangePartnerTaste(e.target.value)}
                placeholder="Es. Marta: ama commedie e thriller, no horror o film troppo lenti."
                className="w-full rounded-xl border border-cg-border bg-cg-elevated p-3 text-sm text-cg-text placeholder:text-cg-muted focus:border-cg-accent focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Core Mood 3x3 grid */}
        <div className="mt-5 border-t border-cg-border pt-5">
          <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-cg-muted">
            Come ti senti
          </span>
          <div className="grid grid-cols-3 gap-2">
            {CORE_MOODS.map((m) => {
              const on = selectedMoods.has(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggleMood(m)}
                  className={`truncate rounded-xl border px-2 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    on
                      ? "border-cg-accent bg-cg-accent text-cg-accent-fg font-semibold"
                      : "border-cg-border bg-cg-elevated text-cg-secondary hover:border-cg-border-strong hover:text-cg-text"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Risk */}
        <div className="mt-5 border-t border-cg-border pt-5">
          <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-cg-muted">
            Voglia di
          </span>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-cg-border bg-cg-elevated p-1">
            {(
              [
                ["", "Equilibrata"],
                ["safe", "Sul sicuro"],
                ["bold", "Osare"],
              ] as Array<[RiskMode, string]>
            ).map(([val, label]) => {
              const active = risk === val;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangeRisk(val)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-cg-accent text-cg-accent-fg font-semibold"
                      : "text-cg-muted hover:text-cg-text"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Free text context */}
        <div className="mt-5 border-t border-cg-border pt-5">
          <label
            htmlFor="evening-context"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-cg-muted"
          >
            Con parole tue
          </label>
          <textarea
            id="evening-context"
            rows={2}
            value={ctxText}
            onChange={(e) => onChangeCtxText(e.target.value)}
            placeholder="Es. Ho 2 ore, qualcosa di teso o brillante ma non pesante…"
            className="w-full rounded-xl border border-cg-border bg-cg-elevated p-3 text-sm text-cg-text placeholder:text-cg-muted focus:border-cg-accent focus:outline-none"
          />
        </div>

        {/* Collapsible filters */}
        <div className="mt-5 border-t border-cg-border pt-4">
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={onToggleFiltersOpen}
            className="flex w-full items-center justify-between py-1 text-left text-sm font-medium text-cg-text"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-cg-muted" />
              <span>Filtri avanzati</span>
              <span className="font-mono text-xs text-cg-muted">
                ·{" "}
                {activeFilterGroups
                  ? `${activeFilterGroups} ${
                      activeFilterGroups > 1 ? "attivi" : "attivo"
                    }`
                  : "nessuno"}
              </span>
            </span>
            {filtersOpen ? (
              <ChevronUp className="h-4 w-4 text-cg-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-cg-muted" />
            )}
          </button>

          {filtersOpen && (
            <div className="mt-4 space-y-5 border-t border-cg-border pt-4">
              <div>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-cg-muted">
                    Durata
                  </span>
                  <span className="font-mono tabular-nums text-cg-text">
                    {durationLabel}
                  </span>
                </div>
                <div className="relative h-9">
                  <svg
                    className="pointer-events-none absolute inset-x-0 top-1/2 h-1 w-full -translate-y-1/2 overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <rect
                      x="0%"
                      y="0"
                      width="100%"
                      height="4"
                      rx="2"
                      className="fill-cg-border"
                    />
                    <rect
                      x={`${leftPct}%`}
                      y="0"
                      width={`${fillWidthPct}%`}
                      height="4"
                      rx="2"
                      className="fill-cg-accent"
                    />
                  </svg>
                  <input
                    type="range"
                    min={40}
                    max={210}
                    step={10}
                    value={durMin}
                    aria-label="Durata minima"
                    onChange={(e) => {
                      const v = +e.target.value;
                      onChangeDurMin(v);
                      if (v > durMax) onChangeDurMax(v);
                    }}
                    className={`dual-range-input ${durMin >= durMax ? "z-30" : "z-20"}`}
                  />
                  <input
                    type="range"
                    min={40}
                    max={210}
                    step={10}
                    value={durMax}
                    aria-label="Durata massima"
                    onChange={(e) => {
                      const v = +e.target.value;
                      onChangeDurMax(v);
                      if (v < durMin) onChangeDurMin(v);
                    }}
                    className="dual-range-input z-20"
                  />
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-cg-muted">
                  Genere
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {GENRE_FILTERS.map((g) => {
                    const on = genreSel.has(g.value);
                    return (
                      <button
                        key={g.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onToggleGenre(g.value)}
                        className={`truncate rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          on
                            ? "border-cg-accent bg-cg-accent text-cg-accent-fg font-semibold"
                            : "border-cg-border bg-cg-elevated text-cg-secondary hover:border-cg-border-strong hover:text-cg-text"
                        }`}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-cg-muted">
                  Cinema
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {COUNTRY_FILTERS.map((c) => {
                    const on = countrySel.has(c.value);
                    return (
                      <button
                        key={c.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onToggleCountry(c.value)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          on
                            ? "border-cg-accent bg-cg-accent text-cg-accent-fg font-semibold"
                            : "border-cg-border bg-cg-elevated text-cg-secondary hover:border-cg-border-strong hover:text-cg-text"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-cg-muted">
                  Epoca
                </span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {DECADE_FILTERS.map((d) => {
                    const on = decadeSel.has(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onToggleDecade(d.value)}
                        className={`truncate rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          on
                            ? "border-cg-accent bg-cg-accent text-cg-accent-fg font-semibold"
                            : "border-cg-border bg-cg-elevated text-cg-secondary hover:border-cg-border-strong hover:text-cg-text"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-cg-muted">
                <span className="font-mono tabular-nums">
                  {filteredCount} film corrispondono ai filtri
                  {unknownMetaCount > 0
                    ? ` (${unknownMetaCount} senza dati completi)`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={onResetAllFilters}
                  className="font-medium text-cg-secondary underline-offset-4 hover:text-cg-text hover:underline"
                >
                  Azzera filtri
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Source & Engine switch & Primary CTA */}
        <div className="mt-6 space-y-3 border-t border-cg-border pt-5">
          {rewatchCount > 0 && (
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-cg-muted">
                Peschiamo da
              </span>
              <div className="flex items-center gap-1 rounded-xl border border-cg-border bg-cg-elevated p-0.5">
                <button
                  type="button"
                  aria-pressed={!rewatchMode}
                  onClick={() => onChangeRewatchMode(false)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    !rewatchMode
                      ? "bg-cg-accent text-cg-accent-fg font-semibold"
                      : "text-cg-muted hover:text-cg-text"
                  }`}
                >
                  Watchlist
                </button>
                <button
                  type="button"
                  aria-pressed={rewatchMode}
                  onClick={() => onChangeRewatchMode(true)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    rewatchMode
                      ? "bg-cg-accent text-cg-accent-fg font-semibold"
                      : "text-cg-muted hover:text-cg-text"
                  }`}
                >
                  Rewatch confortevole
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-cg-muted">
              Motore di scelta
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-cg-border bg-cg-elevated p-0.5">
              <button
                type="button"
                disabled={!aiAvailable}
                aria-pressed={engineMode === "ai" && aiAvailable}
                onClick={() => onChangeEngineMode("ai")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 ${
                  engineMode === "ai" && aiAvailable
                    ? "bg-cg-text text-cg-bg font-semibold"
                    : "text-cg-muted hover:text-cg-text"
                }`}
              >
                AI Gemini
              </button>
              <button
                type="button"
                aria-pressed={engineMode === "local" || !aiAvailable}
                onClick={() => onChangeEngineMode("local")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  engineMode === "local" || !aiAvailable
                    ? "bg-cg-text text-cg-bg font-semibold"
                    : "text-cg-muted hover:text-cg-text"
                }`}
              >
                Punteggio locale
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onRecommend}
            className="w-full rounded-xl bg-cg-accent px-5 py-3.5 text-sm font-semibold text-cg-accent-fg transition-colors hover:bg-cg-accent-hover disabled:opacity-50"
          >
            {loading
              ? rewatchMode
                ? "Scelgo 5 rewatch confortevoli…"
                : "Sto scegliendo dalla tua watchlist…"
              : rewatchMode
              ? "Suggeriscimi 5 rewatch"
              : engineMode === "ai" && aiAvailable
              ? "Suggeriscimi 5 + 1 bonus"
              : "Suggeriscimi 5 dalla lista"}
          </button>

          {!filtersOpen && (
            <p className="text-center font-mono text-xs tabular-nums text-cg-muted">
              {rewatchMode
                ? `${rewatchCount} film candidati per il rewatch`
                : `${filteredCount} film disponibili in watchlist`}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
};
