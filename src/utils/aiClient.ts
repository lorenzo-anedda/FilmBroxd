import type { FilmItem, FilmPreviewData } from "../types";

export interface AIError extends Error {
  code?: string;
}

const clientPreviewCache = new Map<
  string,
  { data: FilmPreviewData; isFull: boolean }
>();

export function preloadPosterImage(url?: string | null): void {
  if (!url || typeof Image === "undefined") return;
  try {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = url;
  } catch {
    // ignore preload errors
  }
}

export async function fetchFilmPreview(
  film: FilmItem,
  director?: string,
  options?: { fast?: boolean }
): Promise<FilmPreviewData> {
  const fast = Boolean(options?.fast);
  const key = `${film.t.toLowerCase()}|${film.y || ""}|${(director || "").toLowerCase()}`;
  const cached = clientPreviewCache.get(key);
  if (cached && (fast || cached.isFull)) {
    return cached.data;
  }

  const params = new URLSearchParams({ title: film.t });
  if (film.it) params.set("itTitle", film.it);
  if (film.y) params.set("year", film.y);
  if (director) params.set("director", director);
  if (fast) params.set("fast", "1");

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
      posterUrl: data.posterUrl || null,
      description: String(data.description || "").trim(),
      wikiUrl: data.wikiUrl || null,
      loading: false,
    };
    preloadPosterImage(result.posterUrl);
    if (!cached || !cached.isFull || !fast) {
      clientPreviewCache.set(key, { data: result, isFull: !fast });
    }
    return result;
  } catch {
    return { posterUrl: null, description: "", wikiUrl: null, loading: false };
  }
}

export async function generateWithAI(
  prompt: string,
  options?: { jsonMode?: "array" | "object" | "text"; fast?: boolean }
): Promise<string> {
  const res = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      jsonMode: options?.jsonMode ?? "text",
      fast: Boolean(options?.fast),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: AIError = new Error(data.error || `Errore server (${res.status})`);
    err.code = data.code || (res.status === 429 ? "rate_limited" : "ai_error");
    throw err;
  }

  return String(data.text || "");
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
