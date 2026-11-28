import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFilmPreview } from "../utils/aiClient";
import { getCachedPreview } from "../utils/posterCache";
import type { LibraryEntry } from "../utils/libraryHelpers";
import type { FilmItem, FilmPreviewData } from "../types";

export const LIBRARY_PREVIEW_CONCURRENCY = 3;
export const LIBRARY_PREVIEW_MAX_QUEUE = 48;

export type PreviewFetcher = (
  film: FilmItem,
  director?: string,
  options?: { fast?: boolean }
) => Promise<FilmPreviewData>;

interface QueueTask {
  entry: LibraryEntry;
  generation: number;
}

export function buildPreviewCacheKey(entry: LibraryEntry): string {
  const dir = (entry.meta?.d || "").toLowerCase();
  return `${entry.film.t.toLowerCase()}|${entry.film.y || ""}|${dir}`;
}

/**
 * Pure concurrency-limited, generation-aware queue controller used by
 * useLibraryPreviews and testable offline without React/DOM dependencies.
 */
export class LibraryPreviewQueue {
  private readonly maxConcurrent: number;
  private readonly maxQueueSize: number;
  private readonly fetcher: PreviewFetcher;
  private activeCount = 0;
  private generation = 0;
  private queue: QueueTask[] = [];
  private queuedKeys = new Set<string>();
  private inFlightKeys = new Set<string>();
  private attemptedFastKeys = new Set<string>();
  private attemptedFullKeys = new Set<string>();
  private visibleKeys = new Set<string>();

  constructor(
    fetcher: PreviewFetcher = fetchFilmPreview,
    maxConcurrent = LIBRARY_PREVIEW_CONCURRENCY,
    maxQueueSize = LIBRARY_PREVIEW_MAX_QUEUE
  ) {
    this.fetcher = fetcher;
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.maxQueueSize = Math.max(maxConcurrent, maxQueueSize);
  }

  getGeneration(): number {
    return this.generation;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getQueuedCount(): number {
    return this.queue.length;
  }

  setVisibleKeys(keys: Set<string>): void {
    this.visibleKeys = keys;
    // Prune queued tasks that are no longer part of the rendered slice
    if (this.queue.length > 0) {
      this.queue = this.queue.filter((task) => {
        const keep = this.visibleKeys.has(task.entry.key);
        if (!keep) this.queuedKeys.delete(task.entry.key);
        return keep;
      });
    }
  }

  invalidateScope(): void {
    this.generation += 1;
    this.queue = [];
    this.queuedKeys.clear();
  }

  enqueueFast(
    entry: LibraryEntry,
    callbacks: {
      onStart: (key: string) => void;
      onResolve: (key: string, data: FilmPreviewData) => void;
    }
  ): boolean {
    const key = entry.key;
    if (!this.visibleKeys.has(key)) return false;
    if (
      this.attemptedFastKeys.has(key) ||
      this.queuedKeys.has(key) ||
      this.inFlightKeys.has(key)
    ) {
      return false;
    }

    const persistKey = buildPreviewCacheKey(entry);
    const cached = getCachedPreview(persistKey);
    if (cached) {
      this.attemptedFastKeys.add(key);
      if (cached.isFull) this.attemptedFullKeys.add(key);
      callbacks.onResolve(key, {
        posterUrl: cached.posterUrl,
        description: cached.description,
        wikiUrl: cached.wikiUrl,
        loading: false,
      });
      return false;
    }

    if (this.queue.length >= this.maxQueueSize) {
      const dropped = this.queue.shift();
      if (dropped) this.queuedKeys.delete(dropped.entry.key);
    }

    this.queuedKeys.add(key);
    this.queue.push({ entry, generation: this.generation });
    this.pump(callbacks);
    return true;
  }

  private pump(callbacks: {
    onStart: (key: string) => void;
    onResolve: (key: string, data: FilmPreviewData) => void;
  }): void {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!;
      const key = task.entry.key;
      this.queuedKeys.delete(key);

      if (task.generation !== this.generation || !this.visibleKeys.has(key)) {
        continue;
      }
      if (this.attemptedFastKeys.has(key) || this.inFlightKeys.has(key)) {
        continue;
      }

      this.activeCount += 1;
      this.inFlightKeys.add(key);
      callbacks.onStart(key);

      const director = task.entry.meta?.d || "";
      this.fetcher(task.entry.film, director, { fast: true })
        .then((data) => {
          this.attemptedFastKeys.add(key);
          if (task.generation === this.generation) {
            callbacks.onResolve(key, { ...data, loading: false });
          }
        })
        .catch(() => {
          this.attemptedFastKeys.add(key);
          if (task.generation === this.generation) {
            callbacks.onResolve(key, {
              posterUrl: null,
              description: "",
              wikiUrl: null,
              loading: false,
            });
          }
        })
        .finally(() => {
          this.activeCount = Math.max(0, this.activeCount - 1);
          this.inFlightKeys.delete(key);
          this.pump(callbacks);
        });
    }
  }

  requestFullDetail(
    entry: LibraryEntry,
    callbacks: {
      onStart: (key: string) => void;
      onResolve: (key: string, data: FilmPreviewData) => void;
    },
    isCurrent: () => boolean
  ): void {
    const key = entry.key;
    if (this.attemptedFullKeys.has(key)) return;
    this.attemptedFullKeys.add(key);

    const director = entry.meta?.d || "";
    const persistKey = buildPreviewCacheKey(entry);
    const cached = getCachedPreview(persistKey);
    if (cached && cached.isFull) {
      this.attemptedFastKeys.add(key);
      callbacks.onResolve(key, {
        posterUrl: cached.posterUrl,
        description: cached.description,
        wikiUrl: cached.wikiUrl,
        loading: false,
      });
      return;
    }

    callbacks.onStart(key);

    this.fetcher(entry.film, director, { fast: true })
      .then((fastData) => {
        this.attemptedFastKeys.add(key);
        if (!isCurrent()) return;
        callbacks.onResolve(key, { ...fastData, loading: false });

        if (!fastData.description || fastData.description.length < 80) {
          this.fetcher(entry.film, director, { fast: false })
            .then((fullData) => {
              if (!isCurrent()) return;
              callbacks.onResolve(key, { ...fullData, loading: false });
            })
            .catch(() => {
              // keep fastData without retrying
            });
        }
      })
      .catch(() => {
        if (!isCurrent()) return;
        callbacks.onResolve(key, {
          posterUrl: null,
          description: "",
          wikiUrl: null,
          loading: false,
        });
      });
  }
}

export function useLibraryPreviews(
  visibleEntries: LibraryEntry[],
  scopeSignature: string,
  fetcher: PreviewFetcher = fetchFilmPreview
) {
  const [previews, setPreviews] = useState<Record<string, FilmPreviewData>>({});
  const mountedRef = useRef<boolean>(true);
  const queueRef = useRef<LibraryPreviewQueue | null>(null);

  if (!queueRef.current) {
    queueRef.current = new LibraryPreviewQueue(fetcher);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queueRef.current?.invalidateScope();
    };
  }, []);

  // Cancel obsolete queued requests and clear loading placeholders when filters/tab/sort change
  useEffect(() => {
    queueRef.current?.invalidateScope();
    setPreviews((prev) => {
      let changed = false;
      const next: Record<string, FilmPreviewData> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v.loading) {
          changed = true;
          continue;
        }
        next[k] = v;
      }
      return changed ? next : prev;
    });
  }, [scopeSignature]);

  // Keep queue scoped to currently rendered items and hydrate from local cache synchronously
  useEffect(() => {
    const visibleKeys = new Set(visibleEntries.map((e) => e.key));
    queueRef.current?.setVisibleKeys(visibleKeys);

    if (visibleEntries.length === 0) return;

    setPreviews((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const entry of visibleEntries) {
        if (next[entry.key] && !next[entry.key].loading) continue;
        const cached = getCachedPreview(buildPreviewCacheKey(entry));
        if (cached) {
          next[entry.key] = {
            posterUrl: cached.posterUrl,
            description: cached.description,
            wikiUrl: cached.wikiUrl,
            loading: false,
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [visibleEntries]);

  const handleStart = useCallback((key: string) => {
    if (!mountedRef.current) return;
    setPreviews((prev) => {
      if (prev[key] && !prev[key].loading) return prev;
      return {
        ...prev,
        [key]: prev[key] || { posterUrl: null, description: "", loading: true },
      };
    });
  }, []);

  const handleResolve = useCallback((key: string, data: FilmPreviewData) => {
    if (!mountedRef.current) return;
    setPreviews((prev) => ({
      ...prev,
      [key]: { ...data, loading: false },
    }));
  }, []);

  const requestLibraryPreview = useCallback(
    (entry: LibraryEntry) => {
      queueRef.current?.enqueueFast(entry, {
        onStart: handleStart,
        onResolve: handleResolve,
      });
    },
    [handleStart, handleResolve]
  );

  const requestDetailPreview = useCallback(
    (entry: LibraryEntry) => {
      queueRef.current?.requestFullDetail(
        entry,
        { onStart: handleStart, onResolve: handleResolve },
        () => mountedRef.current
      );
    },
    [handleStart, handleResolve]
  );

  return { previews, requestLibraryPreview, requestDetailPreview };
}
