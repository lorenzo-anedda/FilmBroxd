import { safeExternalUrl } from "./filmHelpers";
import {
  getCachedPreview,
  setCachedPreview,
} from "./posterCache";
import type { DiaryEntry, FilmItem, FilmPreviewData } from "../types";

export interface AIError extends Error {
  code?: string;
}

export async function syncLetterboxdDiary(username: string): Promise<{
  user: string;
  entries: DiaryEntry[];
  fetchedAt: number;
}> {
  const clean = username.trim().replace(/^@/, "");
  const res = await fetch(
    `/api/letterboxd/diary?user=${encodeURIComponent(clean)}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Errore sincronizzazione (${res.status})`);
  }
  return {
    user: String(data.user || clean),
    entries: Array.isArray(data.entries) ? data.entries : [],
    fetchedAt: Number(data.fetchedAt) || Date.now(),
  };
}

export function preloadPosterImage(url?: string | null): void {
  const safeUrl = safeExternalUrl(url);
  if (!safeUrl || typeof Image === "undefined") return;
  try {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = safeUrl;
  } catch {
    // ignore preload errors
  }
}

const inFlightPreviewRequests = new Map<string, Promise<FilmPreviewData>>();
const inFlightAiRequests = new Map<string, Promise<string>>();

const clientMetrics = {
  cacheHits: 0,
  deduplicatedRequests: 0,
  localFallbacks: 0,
  rateLimitedErrors: 0,
};

export function recordLocalFallback(): void {
  clientMetrics.localFallbacks += 1;
}

export function getClientAIMetrics() {
  return { ...clientMetrics };
}

export function resetClientAIMetricsForTests(): void {
  clientMetrics.cacheHits = 0;
  clientMetrics.deduplicatedRequests = 0;
  clientMetrics.localFallbacks = 0;
  clientMetrics.rateLimitedErrors = 0;
  inFlightPreviewRequests.clear();
  inFlightAiRequests.clear();
}

export async function fetchFilmPreview(
  film: FilmItem,
  director?: string,
  options?: { fast?: boolean }
): Promise<FilmPreviewData> {
  const fast = Boolean(options?.fast);
  const key = `${film.t.toLowerCase()}|${film.y || ""}|${(director || "").toLowerCase()}`;
  const cached = getCachedPreview(key);
  if (cached && (fast || cached.isFull)) {
    clientMetrics.cacheHits += 1;
    return {
      posterUrl: cached.posterUrl,
      description: cached.description,
      wikiUrl: cached.wikiUrl,
      loading: false,
    };
  }

  const flightKey = `${key}|${fast ? "1" : "0"}`;
  const existingFlight = inFlightPreviewRequests.get(flightKey);
  if (existingFlight) {
    clientMetrics.deduplicatedRequests += 1;
    return existingFlight;
  }

  const params = new URLSearchParams({ title: film.t });
  if (film.it) params.set("itTitle", film.it);
  if (film.y) params.set("year", film.y);
  if (director) params.set("director", director);
  if (fast) params.set("fast", "1");

  const promise = (async (): Promise<FilmPreviewData> => {
    try {
      const res = await fetch(`/api/film/preview?${params.toString()}`);
      if (!res.ok) {
        return { posterUrl: null, description: "", wikiUrl: null, loading: false };
      }
      const data = (await res.json()) as {
        posterUrl?: string | null;
        description?: string;
        wikiUrl?: string | null;
      };
      const result: FilmPreviewData = {
        posterUrl: safeExternalUrl(data.posterUrl),
        description: String(data.description || "").trim(),
        wikiUrl: safeExternalUrl(data.wikiUrl, ["wikipedia.org"]),
        loading: false,
      };
      preloadPosterImage(result.posterUrl);
      setCachedPreview(key, result, !fast);
      return result;
    } catch {
      return { posterUrl: null, description: "", wikiUrl: null, loading: false };
    }
  })().finally(() => {
    inFlightPreviewRequests.delete(flightKey);
  });

  inFlightPreviewRequests.set(flightKey, promise);
  return promise;
}

export async function generateWithAI(
  prompt: string,
  options?: { jsonMode?: "array" | "object" | "text"; fast?: boolean }
): Promise<string> {
  const jsonMode = options?.jsonMode ?? "text";
  const fast = Boolean(options?.fast);
  const flightKey = `${fast ? "1" : "0"}|${jsonMode}|${prompt}`;
  const existingFlight = inFlightAiRequests.get(flightKey);
  if (existingFlight) {
    clientMetrics.deduplicatedRequests += 1;
    return existingFlight;
  }

  const promise = (async (): Promise<string> => {
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        jsonMode,
        fast,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data.code || (res.status === 429 ? "rate_limited" : "ai_error");
      if (code === "rate_limited" || res.status === 429) {
        clientMetrics.rateLimitedErrors += 1;
      }
      const err: AIError = new Error(data.error || `Errore server (${res.status})`);
      err.code = code;
      throw err;
    }

    return String(data.text || "");
  })().finally(() => {
    inFlightAiRequests.delete(flightKey);
  });

  inFlightAiRequests.set(flightKey, promise);
  return promise;
}

export async function checkAIHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.aiConfigured);
  } catch {
    return false;
  }
}

export function formatAIError(err: unknown): string {
  const e = err as AIError | undefined;
  if (e?.code === "no_ai") {
    return "Servizio AI non attivo sul server: uso il punteggio locale.";
  }
  if (e?.code === "rate_limited") {
    return "Limite richieste AI raggiunto, riprova tra poco.";
  }
  if (e?.code === "overloaded") {
    return "Modello AI momentaneamente sovraccarico: riprova tra qualche secondo.";
  }
  if (e?.code === "auth_error") {
    return "Verifica la chiave Gemini in Settings > Secrets.";
  }
  const msg = e?.message ? String(e.message) : "";
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(msg)) {
    return "Modello AI momentaneamente sovraccarico: riprova tra qualche secondo.";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return "Impossibile contattare il server AI in questo momento.";
  }
  return msg
    ? `Qualcosa è andato storto (${msg.slice(0, 90)}).`
    : "Qualcosa è andato storto, riprova.";
}
