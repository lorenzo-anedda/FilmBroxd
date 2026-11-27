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
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-[#131722]">
        {/* Quick presets */}
        <div className="pb-5">
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Serate tipo
            </span>
            {hasAnyResettable && (
              <button
                type="button"
                onClick={onResetAllFilters}
                className="text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
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
                  onClick={() => onApplyPreset(preset)}
                  className={`flex items-baseline justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                    isMatch
                      ? "border-[#2563EB] bg-[#2563EB]/[0.07] text-[#1D4ED8] dark:border-[#3B82F6] dark:bg-[#3B82F6]/[0.12] dark:text-[#60A5FA]"
                      : "border-slate-200 bg-[#F5F7FA] text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700/80 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="truncate text-xs font-semibold">
                    {preset.label}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    {preset.detail}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dedicated Companion selector */}
        <div className="border-t border-slate-200/80 pt-5 dark:border-slate-800">
          <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Con chi guardi
          </span>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-[#F5F7FA] p-1 dark:border-slate-800 dark:bg-[#0B0E14]">
            {COMPANION_OPTIONS.map((comp) => {
              const active = selectedMoods.has(comp);
              return (
                <button
                  key={comp}
                  type="button"
                  onClick={() => onSelectCompanion(comp)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-[#2563EB] text-white dark:bg-[#3B82F6]"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
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
                className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Gusti dell’altra persona (salvati)
              </label>
              <textarea
                id="partner-taste"
                rows={2}
                value={partnerTaste}
                onChange={(e) => onChangePartnerTaste(e.target.value)}
                placeholder="Es. Marta: ama commedie e thriller, no horror o film troppo lenti."
                className="w-full rounded-xl border border-slate-200 bg-[#F5F7FA] p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[#3B82F6]"
              />
            </div>
          )}
        </div>

        {/* Core Mood 3x3 grid */}
        <div className="mt-5 border-t border-slate-200/80 pt-5 dark:border-slate-800">
          <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Come ti senti
          </span>
          <div className="grid grid-cols-3 gap-2">
            {CORE_MOODS.map((m) => {
              const on = selectedMoods.has(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onToggleMood(m)}
                  className={`truncate rounded-xl border px-2 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    on
                      ? "border-[#2563EB] bg-[#2563EB] text-white dark:border-[#3B82F6] dark:bg-[#3B82F6]"
                      : "border-slate-200 bg-[#F5F7FA] text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700/80 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Risk */}
        <div className="mt-5 border-t border-slate-200/80 pt-5 dark:border-slate-800">
          <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Voglia di
          </span>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-[#F5F7FA] p-1 dark:border-slate-800 dark:bg-[#0B0E14]">
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
                  onClick={() => onChangeRisk(val)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-[#2563EB] text-white dark:bg-[#3B82F6]"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Free text context */}
        <div className="mt-5 border-t border-slate-200/80 pt-5 dark:border-slate-800">
          <label
            htmlFor="evening-context"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Con parole tue
          </label>
          <textarea
            id="evening-context"
            rows={2}
            value={ctxText}
            onChange={(e) => onChangeCtxText(e.target.value)}
            placeholder="Es. Ho 2 ore, qualcosa di teso o brillante ma non pesante…"
            className="w-full rounded-xl border border-slate-200 bg-[#F5F7FA] p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[#3B82F6]"
          />
        </div>

        {/* Collapsible filters */}
        <div className="mt-5 border-t border-slate-200/80 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onToggleFiltersOpen}
            className="flex w-full items-center justify-between py-1 text-left text-sm font-medium text-slate-800 dark:text-slate-200"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Filtri avanzati</span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                ·{" "}
                {activeFilterGroups
                  ? `${activeFilterGroups} ${
                      activeFilterGroups > 1 ? "attivi" : "attivo"
                    }`
                  : "nessuno"}
              </span>
            </span>
            {filtersOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </button>

          {filtersOpen && (
            <div className="mt-4 space-y-5 border-t border-slate-200/70 pt-4 dark:border-slate-800">
              <div>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Durata
                  </span>
                  <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
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
                      className="fill-slate-200 dark:fill-slate-700"
                    />
                    <rect
                      x={`${leftPct}%`}
                      y="0"
                      width={`${fillWidthPct}%`}
                      height="4"
                      rx="2"
                      className="fill-[#2563EB] dark:fill-[#3B82F6]"
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
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Genere
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {GENRE_FILTERS.map((g) => {
                    const on = genreSel.has(g.value);
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => onToggleGenre(g.value)}
                        className={`truncate rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          on
                            ? "border-[#2563EB] bg-[#2563EB] text-white dark:border-[#3B82F6] dark:bg-[#3B82F6]"
                            : "border-slate-200 bg-[#F5F7FA] text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Cinema
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {COUNTRY_FILTERS.map((c) => {
                    const on = countrySel.has(c.value);
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => onToggleCountry(c.value)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          on
                            ? "border-[#2563EB] bg-[#2563EB] text-white dark:border-[#3B82F6] dark:bg-[#3B82F6]"
                            : "border-slate-200 bg-[#F5F7FA] text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Epoca
                </span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {DECADE_FILTERS.map((d) => {
                    const on = decadeSel.has(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => onToggleDecade(d.value)}
                        className={`truncate rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          on
                            ? "border-[#2563EB] bg-[#2563EB] text-white dark:border-[#3B82F6] dark:bg-[#3B82F6]"
                            : "border-slate-200 bg-[#F5F7FA] text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#0B0E14] dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono tabular-nums">
                  {filteredCount} film corrispondono ai filtri
                  {unknownMetaCount > 0
                    ? ` (${unknownMetaCount} senza dati completi)`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={onResetAllFilters}
                  className="font-medium text-slate-700 underline-offset-4 hover:underline dark:text-slate-300"
                >
                  Azzera filtri
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Engine switch & Primary CTA */}
        <div className="mt-6 space-y-3 border-t border-slate-200/80 pt-5 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Motore di scelta
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-[#F5F7FA] p-0.5 dark:border-slate-800 dark:bg-[#0B0E14]">
              <button
                type="button"
                disabled={!aiAvailable}
                onClick={() => onChangeEngineMode("ai")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 ${
                  engineMode === "ai" && aiAvailable
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                AI Gemini
              </button>
              <button
                type="button"
                onClick={() => onChangeEngineMode("local")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  engineMode === "local" || !aiAvailable
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400"
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
            className="w-full rounded-xl bg-[#2563EB] px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]"
          >
            {loading
              ? "Sto scegliendo dalla tua watchlist…"
              : engineMode === "ai" && aiAvailable
              ? "Suggeriscimi 5 + 1 bonus"
              : "Suggeriscimi 5 dalla lista"}
          </button>

          {!filtersOpen && (
            <p className="text-center font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {filteredCount} film disponibili in watchlist
            </p>
          )}
        </div>
      </div>
    </aside>
  );
};
