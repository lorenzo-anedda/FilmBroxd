import React from "react";
import { Moon, Sun } from "lucide-react";
import { CineglyphLogo } from "./CineglyphLogo";
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
    ["cinesfida", "ReelRouette"],
    [
      "cronologia",
      tonightCount > 0 ? `Cronologia · ${tonightCount}` : "Cronologia",
    ],
    ["profilo", "Profilo"],
    ["archivio", "Archivio"],
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-cg-border bg-cg-bg/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setTab("serata")}
          className="inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-cg-text whitespace-nowrap shrink-0"
          aria-label="Cineglyph — Torna alla Serata"
        >
          <CineglyphLogo
            dark={dark}
            animated={false}
            eager
            className="h-8 w-10 shrink-0"
          />
          <span>Cineglyph</span>
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
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(key)}
                className={`border-b-2 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? "border-cg-accent text-cg-text"
                    : "border-transparent text-cg-muted hover:text-cg-text"
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
            className="inline-flex items-center gap-2 rounded-lg border border-cg-border bg-cg-surface px-3.5 py-2 text-xs font-medium text-cg-secondary transition-colors hover:border-cg-border-strong hover:bg-cg-elevated hover:text-cg-text whitespace-nowrap shrink-0"
          >
            {dark ? (
              <>
                <Sun className="h-3.5 w-3.5 text-cg-accent-text" />
                <span>Chiaro</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-cg-accent-text" />
                <span>Scuro</span>
              </>
            )}
          </button>
        </div>
      </div>

      <nav
        aria-label="Navigazione mobile"
        className="flex items-center gap-5 overflow-x-auto border-t border-cg-border px-4 py-2 md:hidden"
      >
        {navItems.map(([key, label]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setTab(key)}
              className={`border-b-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? "border-cg-accent text-cg-text"
                  : "border-transparent text-cg-muted hover:text-cg-text"
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
