import crypto from "crypto";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  AI_CACHE_MAX_ENTRIES,
  AI_CACHE_TTL_MS,
  BASE_RETRY_DELAY_MS,
  GEMINI_MODELS,
  MAX_GEMINI_ATTEMPTS,
  MAX_RETRY_WAIT_MS,
  selectGeminiModel,
  type GeminiRuntimeConfig,
} from "../config/geminiConfig.ts";
import { geminiQuota, QuotaExhaustedError } from "./geminiQuota.ts";

export { QuotaExhaustedError };

export function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

class InvalidAiResponseError extends Error {
  readonly status = 502;
  constructor(message: string) {
    super(message);
    this.name = "InvalidAiResponseError";
  }
}

export function extractErrorDetails(err: unknown): { status: number; message: string } {
  const rawMsg = err instanceof Error ? err.message : String(err);
  let status =
    typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : typeof (err as { statusCode?: number })?.statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;
  let message = rawMsg;

  if (rawMsg.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawMsg) as { error?: { code?: number; message?: string } };
      if (parsed?.error?.message) {
        message = parsed.error.message;
      }
      if (typeof parsed?.error?.code === "number") {
        status = parsed.error.code;
      }
    } catch {
      // keep rawMsg
    }
  }

  return { status, message };
}

export function extractRetryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const anyErr = err as {
    retryAfter?: unknown;
    headers?: { get?: (k: string) => string | null; [k: string]: unknown };
    response?: { headers?: { get?: (k: string) => string | null; [k: string]: unknown } };
    details?: unknown;
    message?: string;
  };

  const readHeader = (h: unknown, name: string): string | null => {
    if (!h || typeof h !== "object") return null;
    const obj = h as { get?: (k: string) => string | null; [k: string]: unknown };
    if (typeof obj.get === "function") {
      return obj.get(name) || obj.get(name.toLowerCase()) || null;
    }
    const direct = obj[name] ?? obj[name.toLowerCase()] ?? obj["Retry-After"];
    return typeof direct === "string" || typeof direct === "number"
      ? String(direct)
      : null;
  };

  const headerVal =
    (typeof anyErr.retryAfter === "string" || typeof anyErr.retryAfter === "number"
      ? String(anyErr.retryAfter)
      : null) ||
    readHeader(anyErr.headers, "retry-after") ||
    readHeader(anyErr.response?.headers, "retry-after");

  if (headerVal) {
    const trimmed = headerVal.trim();
    const asSec = Number(trimmed);
    if (Number.isFinite(asSec) && asSec >= 0) {
      return Math.round(asSec * 1000);
    }
    const asDate = Date.parse(trimmed);
    if (Number.isFinite(asDate)) {
      return Math.max(0, asDate - Date.now());
    }
  }

  const msg = typeof anyErr.message === "string" ? anyErr.message : "";
  const delayMatch = msg.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (delayMatch?.[1]) {
    const sec = Number(delayMatch[1]);
    if (Number.isFinite(sec) && sec >= 0) {
      return Math.round(sec * 1000);
    }
  }

  return null;
}

export function isDailyQuotaError(status: number, message: string): boolean {
  if (status !== 429 && !/RESOURCE_EXHAUSTED|quota/i.test(message)) {
    return false;
  }
  return /GenerateRequestsPerDay|PerDay|daily|RPD|limit:\s*0\b|quota_limit_value["']?\s*:\s*["']?0\b/i.test(
    message
  );
}

export function isNonRetryableClientError(status: number, message: string): boolean {
  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    /API_KEY_INVALID|PERMISSION_DENIED|INVALID_ARGUMENT|NOT_FOUND|UNAUTHENTICATED/i.test(
      message
    )
  );
}

export function isOverloadedOrTransient(status: number, message: string): boolean {
  return (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    status === 500 ||
    /UNAVAILABLE|high demand|overloaded|try again later|temporarily|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
      message
    )
  );
}

function extractBalancedJsonSlice(src: string, openChar: "[" | "{"): string | null {
  const closeChar = openChar === "[" ? "]" : "}";
  const start = src.indexOf(openChar);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

export function validateJsonResponse(
  rawText: string,
  jsonMode: "array" | "object" | "text"
): string {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleaned) {
    throw new InvalidAiResponseError("Risposta vuota dal modello AI.");
  }

  if (jsonMode === "text") {
    return rawText.trim();
  }

  const expectedOpener = jsonMode === "array" ? "[" : "{";
  const candidates = [cleaned];
  const sliced = extractBalancedJsonSlice(cleaned, expectedOpener);
  if (sliced && sliced !== cleaned) {
    candidates.push(sliced);
  }

  for (const cand of candidates) {
    try {
      const parsed: unknown = JSON.parse(cand);
      if (jsonMode === "array" && Array.isArray(parsed)) {
        return cand;
      }
      if (
        jsonMode === "object" &&
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return cand;
      }
    } catch {
      // try next candidate
    }
  }

  throw new InvalidAiResponseError("Risposta AI senza JSON valido.");
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface AiCacheEntry {
  text: string;
  ts: number;
}

// RAM-only short-TTL cache keyed exclusively by SHA-256 digest (never persisted, never stores prompts)
const aiResponseCache = new Map<string, AiCacheEntry>();
const inFlightRequests = new Map<string, Promise<string>>();

export function clearAiCacheForTests(): void {
  aiResponseCache.clear();
  inFlightRequests.clear();
}

function buildRequestHash(model: string, jsonMode: string, prompt: string): string {
  return crypto
    .createHash("sha256")
    .update(`${model}|${jsonMode}|${prompt}`)
    .digest("hex");
}

function getCachedAiText(key: string, nowMs: number): string | null {
  const hit = aiResponseCache.get(key);
  if (!hit) return null;
  if (nowMs - hit.ts > AI_CACHE_TTL_MS) {
    aiResponseCache.delete(key);
    return null;
  }
  return hit.text;
}

function setCachedAiText(key: string, text: string, nowMs: number): void {
  if (aiResponseCache.size >= AI_CACHE_MAX_ENTRIES) {
    const oldestKey = aiResponseCache.keys().next().value;
    if (oldestKey) aiResponseCache.delete(oldestKey);
  }
  aiResponseCache.set(key, { text, ts: nowMs });
}

export interface GenerateOptions {
  prompt: string;
  jsonMode?: "array" | "object" | "text";
  fast?: boolean;
  clientId?: string;
  useCache?: boolean;
  sleepFn?: (ms: number) => Promise<void>;
  nowFn?: () => number;
  configOverride?: GeminiRuntimeConfig;
}

export async function generateWithRetries(
  ai: GoogleGenAI,
  {
    prompt,
    jsonMode = "text",
    fast = false,
    clientId,
    useCache,
    sleepFn = defaultSleep,
    nowFn = Date.now,
    configOverride,
  }: GenerateOptions
): Promise<string> {
  const isFast = Boolean(fast);
  const model = selectGeminiModel({ fast: isFast });
  const shouldCache = useCache ?? isFast;
  const reqHash = buildRequestHash(model, jsonMode, prompt);

  if (shouldCache) {
    const cached = getCachedAiText(reqHash, nowFn());
    if (cached !== null) {
      geminiQuota.recordCacheHit();
      return cached;
    }
  }

  const existingFlight = inFlightRequests.get(reqHash);
  if (existingFlight) {
    geminiQuota.recordDeduplicatedRequest();
    return existingFlight;
  }

  const runOperation = async (): Promise<string> => {
    let lastErr: unknown = null;

    for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt++) {
      let reservation: { release: () => void };
      try {
        reservation = geminiQuota.reserveSlot({
          model,
          clientId,
          nowMs: nowFn(),
          configOverride,
        });
      } catch (quotaErr) {
        throw quotaErr;
      }

      try {
        const config: {
          responseMimeType?: string;
          systemInstruction?: string;
          thinkingConfig?: { thinkingLevel: ThinkingLevel };
        } = {};

        if (jsonMode === "array") {
          config.responseMimeType = "application/json";
          config.systemInstruction =
            "Rispondi esclusivamente con un array JSON valido che inizia con [ e termina con ], senza markdown o testo aggiuntivo.";
        } else if (jsonMode === "object") {
          config.responseMimeType = "application/json";
          config.systemInstruction =
            "Rispondi esclusivamente con un oggetto JSON valido che inizia con { e termina con }, senza markdown o testo aggiuntivo.";
        }

        if (model === GEMINI_MODELS.HYDROGEN) {
          config.thinkingConfig = {
            thinkingLevel:
              attempt === 1 ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW,
          };
        }

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config,
        });

        const rawText = (response.text ?? "").trim();
        const validated = validateJsonResponse(rawText, jsonMode);

        if (shouldCache) {
          setCachedAiText(reqHash, validated, nowFn());
        }
        return validated;
      } catch (err: unknown) {
        lastErr = err;
        if (err instanceof QuotaExhaustedError) {
          throw err;
        }

        const { status, message } = extractErrorDetails(err);
        geminiQuota.recordUpstreamError(status);

        // Never retry auth/input errors or daily quota exhaustion
        if (
          isNonRetryableClientError(status, message) ||
          isDailyQuotaError(status, message)
        ) {
          break;
        }

        if (attempt >= MAX_GEMINI_ATTEMPTS) {
          break;
        }

        const retryable =
          err instanceof InvalidAiResponseError ||
          status === 429 ||
          isOverloadedOrTransient(status, message);

        if (!retryable) {
          break;
        }

        const retryAfterMs = extractRetryAfterMs(err);
        if (retryAfterMs !== null && retryAfterMs > MAX_RETRY_WAIT_MS) {
          // Do not stall or consume a second slot when provider requests a long cooldown
          break;
        }

        const delayMs =
          retryAfterMs !== null
            ? Math.min(MAX_RETRY_WAIT_MS, retryAfterMs)
            : Math.min(
                MAX_RETRY_WAIT_MS,
                BASE_RETRY_DELAY_MS + Math.floor(Math.random() * 200)
              );

        geminiQuota.recordRetry();
        if (delayMs > 0) {
          await sleepFn(delayMs);
        }
      } finally {
        reservation.release();
      }
    }

    throw lastErr ?? new Error("Errore AI sconosciuto.");
  };

  const promise = runOperation().finally(() => {
    inFlightRequests.delete(reqHash);
  });
  inFlightRequests.set(reqHash, promise);
  return promise;
}

export function toSafeClientAiError(err: unknown): {
  status: number;
  code: string;
  error: string;
  retryAfterSec?: number;
} {
  if (err instanceof QuotaExhaustedError) {
    return {
      status: 429,
      code: "rate_limited",
      error: err.message,
      retryAfterSec: err.retryAfterSec,
    };
  }

  const { status, message } = extractErrorDetails(err);
  const retryAfterMs = extractRetryAfterMs(err);
  const retryAfterSec =
    retryAfterMs !== null ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : undefined;

  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate/i.test(message)) {
    return {
      status: 429,
      code: "rate_limited",
      error: "Limite richieste AI raggiunto, riprova tra poco.",
      ...(retryAfterSec ? { retryAfterSec } : {}),
    };
  }

  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    /API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)
  ) {
    return {
      status: status === 400 || status === 401 || status === 403 ? status : 401,
      code: "auth_error",
      error: "Errore di autenticazione API Gemini: verifica Settings > Secrets.",
    };
  }

  if (isOverloadedOrTransient(status, message)) {
    return {
      status: 503,
      code: "overloaded",
      error:
        "Modello AI momentaneamente sovraccarico per traffico elevato. Riprova tra qualche secondo.",
    };
  }

  return {
    status: 500,
    code: "ai_error",
    error: "Errore temporaneo del servizio AI.",
  };
}
