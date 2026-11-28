import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFilmPreview } from "../utils/aiClient";
import { filmKey } from "../utils/filmHelpers";
import { getCachedPreview } from "../utils/posterCache";
import type { ActivePick, FilmPreviewData } from "../types";

export function useFilmPreviews(picks: ActivePick[]) {
  const [previews, setPreviews] = useState<Record<string, FilmPreviewData>>({});
  const mountedRef = useRef<boolean>(true);
  const fastFetchedKeysRef = useRef<Set<string>>(new Set());
  const fullFetchedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Hydrate immediately from persistent localStorage cache whenever picks change
  useEffect(() => {
    const activePicks = picks.filter((p) => p.status === "active");
    if (!activePicks.length) return;

    setPreviews((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of activePicks) {
        const key = filmKey(p.film);
        if (next[key]) continue;
        const persistKey = `${p.film.t.toLowerCase()}|${p.film.y || ""}|${(
          p.regista || ""
        ).toLowerCase()}`;
        const cached = getCachedPreview(persistKey);
        if (cached) {
          next[key] = {
            posterUrl: cached.posterUrl,
            description: cached.description,
            wikiUrl: cached.wikiUrl,
            loading: false,
          };
          fastFetchedKeysRef.current.add(key);
          if (cached.isFull) {
            fullFetchedKeysRef.current.add(key);
          }
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [picks]);

  // Automatic card loading: fast mode only (posters & Wikipedia sources, zero Gemini calls)
  const requestPreview = useCallback((pick: ActivePick) => {
    const key = filmKey(pick.film);
    if (fastFetchedKeysRef.current.has(key)) return;
    fastFetchedKeysRef.current.add(key);

    setPreviews((prev) => {
      if (prev[key] && !prev[key].loading) {
        return prev;
      }
      return {
        ...prev,
        [key]: prev[key] || { posterUrl: null, description: "", loading: true },
      };
    });

    fetchFilmPreview(pick.film, pick.regista, { fast: true }).then((fastData) => {
      if (!mountedRef.current) return;
      setPreviews((cur) => ({
        ...cur,
        [key]: { ...fastData, loading: false },
      }));
    });
  }, []);

  // Explicit detail modal open: reuses fast cache and triggers AI fallback only if synopsis < 80 chars
  const requestFullPreview = useCallback((pick: ActivePick) => {
    const key = filmKey(pick.film);
    if (fullFetchedKeysRef.current.has(key)) return;
    fullFetchedKeysRef.current.add(key);

    setPreviews((prev) => ({
      ...prev,
      [key]: prev[key] || { posterUrl: null, description: "", loading: true },
    }));

    fetchFilmPreview(pick.film, pick.regista, { fast: true }).then((fastData) => {
      if (!mountedRef.current) return;
      fastFetchedKeysRef.current.add(key);
      setPreviews((cur) => ({
        ...cur,
        [key]: { ...fastData, loading: false },
      }));

      if (!fastData.description || fastData.description.length < 80) {
        fetchFilmPreview(pick.film, pick.regista, { fast: false }).then(
          (fullData) => {
            if (!mountedRef.current) return;
            setPreviews((cur) => ({
              ...cur,
              [key]: { ...fullData, loading: false },
            }));
          }
        );
      }
    });
  }, []);

  return { previews, requestPreview, requestFullPreview };
}
