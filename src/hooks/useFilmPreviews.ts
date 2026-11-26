import { useEffect, useRef, useState } from "react";
import { fetchFilmPreview } from "../utils/aiClient";
import { filmKey } from "../utils/filmHelpers";
import type { ActivePick, FilmPreviewData } from "../types";

export function useFilmPreviews(picks: ActivePick[]) {
  const [previews, setPreviews] = useState<Record<string, FilmPreviewData>>({});
  const mountedRef = useRef<boolean>(true);
  const fetchedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const activePicks = picks.filter((p) => p.status === "active");
    if (!activePicks.length) return;

    const toFetch = activePicks.filter((p) => {
      const key = filmKey(p.film);
      if (fetchedKeysRef.current.has(key)) return false;
      fetchedKeysRef.current.add(key);
      return true;
    });

    if (!toFetch.length) return;

    setPreviews((prev) => {
      const next = { ...prev };
      toFetch.forEach((p) => {
        const key = filmKey(p.film);
        if (!next[key]) {
          next[key] = { posterUrl: null, description: "", loading: true };
        }
      });
      return next;
    });

    toFetch.forEach((p) => {
      const key = filmKey(p.film);
      fetchFilmPreview(p.film, p.regista).then((data) => {
        if (!mountedRef.current) return;
        setPreviews((cur) => ({ ...cur, [key]: { ...data, loading: false } }));
      });
    });
  }, [picks]);

  return previews;
}
