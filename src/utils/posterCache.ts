import { safeExternalUrl } from "./filmHelpers";
import type { FilmPreviewData } from "../types";

const POSTER_CACHE_KEY = "fb_preview_cache_v2";
const MAX_CACHE_ENTRIES = 200;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Curated cinema tones used as immediate dominant-color placeholders before sampling
const CINEMA_PALETTE = [
  "#1E3A5F", // Cobalt noir
  "#3B2F4A", // Plum dusk
  "#27403B", // Deep emerald film
  "#523528", // Warm sepia
  "#352D26", // Warm charcoal film
  "#4A2530", // Velvet crimson
  "#1E424D", // Teal cinema
  "#3F3728", // Amber darkroom
];

export interface CachedFilmPreview extends FilmPreviewData {
  dominantColor?: string;
  isFull?: boolean;
  ts?: number;
}

const memoryCache = new Map<string, CachedFilmPreview>();
const sampledColors = new Map<string, string>();
const samplingInFlight = new Set<string>();
let storageLoaded = false;

function loadFromStorage(): void {
  if (storageLoaded || typeof window === "undefined") return;
  storageLoaded = true;
  try {
    const raw = localStorage.getItem(POSTER_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw, (k, v) =>
      k === "__proto__" || k === "constructor" || k === "prototype"
        ? undefined
        : v
    ) as Record<string, CachedFilmPreview>;
    if (!parsed || typeof parsed !== "object") return;
    const now = Date.now();
    for (const [k, v] of Object.entries(parsed)) {
      if (v && (!v.ts || now - v.ts < CACHE_TTL_MS)) {
        memoryCache.set(k, {
          ...v,
          posterUrl: safeExternalUrl(v.posterUrl),
          wikiUrl: safeExternalUrl(v.wikiUrl),
        });
        if (v.dominantColor) {
          sampledColors.set(k, v.dominantColor);
        }
      }
    }
  } catch {
    // ignore storage errors
  }
}

function flushToStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const entries = Array.from(memoryCache.entries());
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries.sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
      const trimmed = entries.slice(0, MAX_CACHE_ENTRIES);
      memoryCache.clear();
      for (const [k, v] of trimmed) {
        memoryCache.set(k, v);
      }
    }
    const obj: Record<string, CachedFilmPreview> = {};
    for (const [k, v] of memoryCache.entries()) {
      obj[k] = v;
    }
    localStorage.setItem(POSTER_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
}

export function getDeterministicCinemaColor(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return CINEMA_PALETTE[Math.abs(hash) % CINEMA_PALETTE.length];
}

export function getDominantColor(cacheKey: string): string {
  loadFromStorage();
  return (
    sampledColors.get(cacheKey) ||
    memoryCache.get(cacheKey)?.dominantColor ||
    getDeterministicCinemaColor(cacheKey)
  );
}

export function getCachedPreview(cacheKey: string): CachedFilmPreview | null {
  loadFromStorage();
  const hit = memoryCache.get(cacheKey);
  if (!hit) return null;
  if (hit.ts && Date.now() - hit.ts > CACHE_TTL_MS) {
    memoryCache.delete(cacheKey);
    return null;
  }
  return hit;
}

export function setCachedPreview(
  cacheKey: string,
  data: FilmPreviewData,
  isFull: boolean
): void {
  loadFromStorage();
  const existing = memoryCache.get(cacheKey);
  const dominantColor =
    sampledColors.get(cacheKey) || existing?.dominantColor;
  if (existing && existing.isFull && !isFull) {
    return;
  }
  memoryCache.set(cacheKey, {
    ...data,
    posterUrl: safeExternalUrl(data.posterUrl),
    wikiUrl: safeExternalUrl(data.wikiUrl),
    loading: false,
    dominantColor,
    isFull: isFull || Boolean(existing?.isFull),
    ts: Date.now(),
  });
  flushToStorage();
}

export function setCachedDominantColor(cacheKey: string, hex: string): void {
  loadFromStorage();
  sampledColors.set(cacheKey, hex);
  const existing = memoryCache.get(cacheKey);
  if (existing) {
    memoryCache.set(cacheKey, {
      ...existing,
      dominantColor: hex,
      ts: existing.ts || Date.now(),
    });
    flushToStorage();
  }
}

/**
 * Silently samples a poster image via a separate CORS probe so the visible <img>
 * is never blocked if a remote host omits Access-Control-Allow-Origin headers.
 */
export function extractDominantColor(
  posterUrl: string | null | undefined,
  cacheKey: string,
  onColorReady?: (hex: string) => void
): void {
  const safeUrl = safeExternalUrl(posterUrl);
  if (!safeUrl || typeof window === "undefined") return;
  loadFromStorage();
  const already = sampledColors.get(cacheKey);
  if (already) {
    onColorReady?.(already);
    return;
  }
  if (samplingInFlight.has(cacheKey)) return;
  samplingInFlight.add(cacheKey);

  try {
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.referrerPolicy = "no-referrer";
    probe.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 12;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(probe, 0, 0, 8, 12);
        const { data } = ctx.getImageData(0, 0, 8, 12);

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let weightSum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max > 0 ? (max - min) / max : 0;
          const lum = (r + g + b) / 3;
          // Prefer rich mid-tone pixels over pure white/black borders
          const lumWeight = lum > 22 && lum < 235 ? 1 : 0.25;
          const weight = (1 + sat * 2.5) * lumWeight;

          rSum += r * weight;
          gSum += g * weight;
          bSum += b * weight;
          weightSum += weight;
        }

        if (weightSum > 0) {
          const r = Math.round(rSum / weightSum);
          const g = Math.round(gSum / weightSum);
          const b = Math.round(bSum / weightSum);
          const hex = `#${[r, g, b]
            .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
            .join("")}`;
          setCachedDominantColor(cacheKey, hex);
          onColorReady?.(hex);
        }
      } catch {
        // Canvas tainted if host lacks CORS headers; keep deterministic fallback
      } finally {
        samplingInFlight.delete(cacheKey);
      }
    };
    probe.onerror = () => {
      samplingInFlight.delete(cacheKey);
    };
    probe.src = safeUrl;
  } catch {
    samplingInFlight.delete(cacheKey);
  }
}
