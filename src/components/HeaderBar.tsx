import React from "react";
import { Moon, Sun } from "lucide-react";
import { ProjectorLogo } from "./ProjectorLogo";
import type { ActiveTab } from "../types";

interface HeaderBarProps {
  tab: ActiveTab;
  setTab: (tab: ActiveTab) => void;
  tonightCount: number;
  dark: boolean;
  onToggleDark: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  tab,
  setTab,
  tonightCount,
  dark,
  onToggleDark,
}) => {
  const navItems: Array<[ActiveTab, string]> = [
    ["serata", "Serata"],
    [
      "cronologia",
      tonightCount > 0 ? `Cronologia · ${tonightCount}` : "Cronologia",
    ],
    ["profilo", "Profilo"],
    ["archivio", "Archivio"],
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#F5F7FA]/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0B0E14]/85">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setTab("serata")}
          className="group inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 dark:text-white"
        >
          <ProjectorLogo className="h-7 w-11 shrink-0" />
          <span>FilmBroxd</span>
        </button>

        <nav
          aria-label="Navigazione principale"
          className="hidden items-center gap-7 md:flex"
        >
          {navItems.map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`border-b-2 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? "border-[#2563EB] text-slate-900 dark:border-[#60A5FA] dark:text-white"
                    : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onToggleDark}
            aria-label={dark ? "Passa al tema chiaro" : "Passa al tema scuro"}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-800 dark:bg-[#131722] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {dark ? (
              <>
                <Sun className="h-3.5 w-3.5" />
                <span>Chiaro</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5" />
                <span>Scuro</span>
              </>
            )}
          </button>
        </div>
      </div>

      <nav
        aria-label="Navigazione mobile"
        className="flex items-center gap-5 overflow-x-auto border-t border-slate-200/70 px-4 py-2.5 md:hidden dark:border-slate-800/70"
      >
        {navItems.map(([key, label]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`border-b-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? "border-[#2563EB] text-slate-900 dark:border-[#60A5FA] dark:text-white"
                  : "border-transparent text-slate-500 dark:text-slate-400"
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
